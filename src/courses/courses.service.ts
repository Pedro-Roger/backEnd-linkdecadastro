import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCourses(filter?: string) {
    const now = new Date();

    let whereClause: any = { status: 'ACTIVE' };

    if (filter === 'available') {
      whereClause = {
        status: 'ACTIVE',
        OR: [
          { startDate: null },
          { startDate: { gte: now } },
          {
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        ],
      };
    } else if (filter === 'ongoing') {
      whereClause = {
        status: 'ACTIVE',
        AND: [
          {
            OR: [{ startDate: null }, { startDate: { lte: now } }],
          },
          {
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        ],
      };
    }

    return this.prisma.course.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        bannerUrl: true,
        status: true,
        type: true,
        maxEnrollments: true,
        waitlistEnabled: true,
        waitlistLimit: true,
        regionRestrictionEnabled: true,
        allowAllRegions: true,
        startDate: true,
        endDate: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        creator: {
          select: {
            name: true,
          },
        },
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            lessons: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMyCourses(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                order: true,
              },
            },
            _count: {
              select: {
                lessons: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const coursesWithProgress = await Promise.all(
      enrollments.map(async (enrollment) => {
        const completedLessons = await this.prisma.lessonProgress.count({
          where: {
            userId,
            completed: true,
            lesson: {
              courseId: enrollment.courseId,
            },
          },
        });

        return {
          ...enrollment.course,
          progress: enrollment.progress,
          completedLessons,
          totalLessons: enrollment.course._count.lessons,
        };
      }),
    );

    return coursesWithProgress;
  }

  async getCourseById(courseId: string, userId?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        lessons: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: {
                comments: true,
              },
            },
          },
        },
        regionQuotas: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    if (!userId) {
      return course;
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      include: {
        course: {
          include: {
            lessons: {
              include: {
                progress: {
                  where: {
                    userId,
                  },
                },
              },
            },
            regionQuotas: true,
          },
        },
      },
    });

    if (enrollment) {
      return {
        ...course,
        enrollment,
        progress: enrollment.progress,
      };
    }

    return course;
  }

  async getCourseBySlug(slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            videoUrl: true,
            bannerUrl: true,
            duration: true,
            order: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            lessons: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    if (course.status !== 'ACTIVE') {
      throw new NotFoundException('Curso não está disponível');
    }

    return course;
  }

  async checkEnrollment(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    return {
      enrolled: !!enrollment,
      status: enrollment?.status ?? null,
      waitlistPosition: enrollment?.waitlistPosition ?? null,
      eligibilityReason: enrollment?.eligibilityReason ?? null,
    };
  }

  async enrollInCourse(
    userId: string,
    courseId: string,
    body: {
      cpf?: string;
      birthDate?: string;
      participantType?: string;
      hectares?: any;
      state?: string;
      city?: string;
      whatsappNumber?: string;
    },
  ) {
    const {
      cpf,
      birthDate,
      participantType,
      hectares,
      state,
      city,
      whatsappNumber,
    } = body;

    if (!whatsappNumber || typeof whatsappNumber !== 'string') {
      return {
        error: {
          message: 'Número de WhatsApp é obrigatório',
          status: 400,
        },
      };
    }

    const formattedState = state?.toString().trim() || null;
    const formattedCity = city?.toString().trim() || null;

    const result = await this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: courseId },
        include: {
          regionQuotas: true,
        },
      });

      if (!course || course.status !== 'ACTIVE') {
        return {
          error: {
            message: 'Curso não encontrado ou inativo',
            status: 404,
          },
        };
      }

      const existingEnrollment = await tx.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
      });

      if (existingEnrollment) {
        return {
          error: {
            message: 'Você já possui uma inscrição para este curso',
            status: 409,
          },
        };
      }

      const confirmedCount = await tx.enrollment.count({
        where: {
          courseId,
          status: EnrollmentStatus.CONFIRMED,
        },
      });

      const waitlistCount = await tx.enrollment.count({
        where: {
          courseId,
          status: EnrollmentStatus.WAITLIST,
        },
      });

      const regionQuota = course.regionQuotas.find((quota) => {
        if (!formattedState) return false;

        const sameState =
          quota.state.toLowerCase() === formattedState.toLowerCase();
        if (!sameState) return false;

        if (!quota.city) {
          return true;
        }

        if (!formattedCity) return false;
        return quota.city.toLowerCase() === formattedCity.toLowerCase();
      });

      let regionConfirmedCount = 0;
      let regionWaitlistCount = 0;

      if (regionQuota) {
        regionConfirmedCount = await tx.enrollment.count({
          where: {
            courseId,
            status: EnrollmentStatus.CONFIRMED,
            regionQuotaId: regionQuota.id,
          },
        });

        regionWaitlistCount = await tx.enrollment.count({
          where: {
            courseId,
            status: EnrollmentStatus.WAITLIST,
            regionQuotaId: regionQuota.id,
          },
        });
      }

      const courseIsFull =
        !!course.maxEnrollments && confirmedCount >= course.maxEnrollments;
      const regionIsFull =
        !!regionQuota && regionConfirmedCount >= regionQuota.limit;

      const waitlistAvailable =
        course.waitlistEnabled &&
        (!course.waitlistLimit || waitlistCount < course.waitlistLimit);

      const regionWaitlistAvailable =
        !!regionQuota &&
        regionQuota.waitlistLimit > 0 &&
        regionWaitlistCount < regionQuota.waitlistLimit;

      let enrollmentStatus: EnrollmentStatus = EnrollmentStatus.CONFIRMED;
      let eligibilityReason: string | null = null;
      let waitlistPosition: number | null = null;
      let regionQuotaId: string | null = regionQuota ? regionQuota.id : null;

      if (course.regionRestrictionEnabled) {
        if (!regionQuota) {
          if (course.allowAllRegions) {
            enrollmentStatus = EnrollmentStatus.PENDING_REGION;
            eligibilityReason = 'Participante fora das regiões prioritárias';
            regionQuotaId = null;
          } else {
            enrollmentStatus = EnrollmentStatus.PENDING_REGION;
            eligibilityReason = 'Região não elegível para este curso';
            regionQuotaId = null;
          }
        }
      }

      if (
        enrollmentStatus === EnrollmentStatus.CONFIRMED &&
        (courseIsFull || regionIsFull)
      ) {
        if (waitlistAvailable) {
          enrollmentStatus = EnrollmentStatus.WAITLIST;
          waitlistPosition = waitlistCount + 1;
          if (regionQuota && regionIsFull && regionWaitlistAvailable) {
            waitlistPosition = regionWaitlistCount + 1;
          }
        } else {
          enrollmentStatus = EnrollmentStatus.PENDING_REGION;
          eligibilityReason = courseIsFull
            ? 'Curso atingiu o limite de vagas'
            : 'Limite regional atingido';
        }
      }

      const parsedHectares =
        participantType === 'PRODUTOR' && hectares
          ? parseFloat(hectares)
          : null;

      const enrollment = await tx.enrollment.create({
        data: {
          userId,
          courseId,
          progress: 0,
          cpf: cpf || null,
          birthDate: birthDate ? new Date(birthDate) : null,
          participantType: (participantType as any) || null,
          hectares: parsedHectares,
          state: formattedState,
          city: formattedCity,
          status: enrollmentStatus,
          waitlistPosition,
          regionQuotaId,
          eligibilityReason,
          whatsappNumber,
        },
        include: {
          course: true,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          phone: whatsappNumber,
          ...(formattedState ? { state: formattedState } : {}),
          ...(formattedCity ? { city: formattedCity } : {}),
        },
      });

      if (regionQuota && enrollmentStatus === EnrollmentStatus.CONFIRMED) {
        await tx.courseRegionQuota.update({
          where: { id: regionQuota.id },
          data: {
            currentCount: { increment: 1 },
          },
        });
      }

      if (regionQuota && enrollmentStatus === EnrollmentStatus.WAITLIST) {
        await tx.courseRegionQuota.update({
          where: { id: regionQuota.id },
          data: {
            waitlistCount: { increment: 1 },
          },
        });
      }

      let notificationTitle = 'Inscrição confirmada!';
      let notificationMessage = `Você foi inscrito no curso "${course.title}"`;

      if (enrollmentStatus === EnrollmentStatus.WAITLIST) {
        notificationTitle = 'Inscrição em lista de espera';
        notificationMessage = `Você entrou na lista de espera do curso "${course.title}". Aguarde a confirmação do administrador.`;
      } else if (enrollmentStatus === EnrollmentStatus.PENDING_REGION) {
        notificationTitle = 'Inscrição pendente';
        notificationMessage = `Sua inscrição no curso "${course.title}" foi registrada, mas ainda não está elegível. Motivo: ${eligibilityReason}.`;
      }

      return {
        course,
        enrollment,
        metadata: {
          courseIsFull,
          waitlistAvailable,
          regionQuota,
          waitlistPosition,
        },
        notification: {
          title: notificationTitle,
          message: notificationMessage,
        },
      };
    });

    if ('error' in result && result.error) {
      return result;
    }

    const { enrollment, notification, metadata, course } = result;

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'COURSE_ENROLLED',
        title: notification.title,
        message: notification.message,
        link: `/course/${courseId}`,
      },
    });

    return {
      enrollment,
      metadata: {
        isFull: metadata.courseIsFull,
        waitlistPosition: metadata.waitlistPosition,
        regionQuotaId: metadata.regionQuota?.id || null,
      },
      course: {
        id: course.id,
        title: course.title,
        waitlistEnabled: course.waitlistEnabled,
      },
    };
  }
}


