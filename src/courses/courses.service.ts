import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus, ParticipantType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CoursesRepository } from './courses.repository';
import { EnrollmentsRepository } from './enrollments.repository';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesRepository: CoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
  ) { }

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

    return this.coursesRepository.findMany({
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
    const enrollments = await this.enrollmentsRepository.findMany({
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
    const course = await this.coursesRepository.findUnique({
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
      throw new NotFoundException('Curso nao encontrado');
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
      throw new NotFoundException('Curso nao encontrado');
    }

    if (course.status !== 'ACTIVE') {
      throw new NotFoundException('Curso nao esta disponivel');
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

  async findEnrollmentContextByCpf(courseId: string, cpf: string) {
    const normalizedCpf = cpf.replace(/\D/g, '');

    const existingEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        courseId,
        cpf: normalizedCpf,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const latestEnrollmentWithCpf =
      existingEnrollment ||
      (await this.prisma.enrollment.findFirst({
        where: {
          cpf: normalizedCpf,
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }));

    const userFromCpf =
      latestEnrollmentWithCpf?.user ||
      (await this.prisma.user.findFirst({
        where: { cpf: normalizedCpf },
      }));

    if (!latestEnrollmentWithCpf && !userFromCpf) {
      return {
        profile: null,
        existingEnrollment: null,
      };
    }

    const profileSource = latestEnrollmentWithCpf || userFromCpf;
    const profileUser = latestEnrollmentWithCpf?.user || userFromCpf;

    return {
      profile: {
        name: profileUser?.name || null,
        email: profileUser?.email || null,
        whatsappNumber:
          latestEnrollmentWithCpf?.whatsappNumber || profileUser?.phone || null,
        cpf: normalizedCpf,
        birthDate:
          profileSource?.birthDate instanceof Date
            ? profileSource.birthDate.toISOString()
            : profileSource?.birthDate || profileUser?.birthDate?.toISOString?.() || profileUser?.birthDate || null,
        participantType: profileSource?.participantType || profileUser?.participantType || null,
        schoolOrUniversity:
          profileSource?.schoolOrUniversity || profileUser?.schoolOrUniversity || null,
        hectares: profileSource?.hectares ?? profileUser?.hectares ?? null,
        waterArea: profileSource?.waterArea ?? profileUser?.waterArea ?? null,
        ponds: profileSource?.ponds ?? profileUser?.ponds ?? null,
        state: profileSource?.state || profileUser?.state || null,
        city: profileSource?.city || profileUser?.city || null,
      },
      existingEnrollment: existingEnrollment
        ? {
            id: existingEnrollment.id,
            status: existingEnrollment.status,
            createdAt: existingEnrollment.createdAt,
          }
        : null,
    };
  }

  async enrollInCourse(
    userId: string,
    courseId: string,
    body: {
      cpf?: string;
      birthDate?: string;
      participantType?: string;
      schoolOrUniversity?: string;
      hectares?: any;
      waterArea?: any;
      ponds?: any;
      state?: string;
      city?: string;
      whatsappNumber?: string;
    },
  ) {
    const {
      cpf,
      birthDate,
      participantType,
      schoolOrUniversity,
      hectares,
      waterArea,
      ponds,
      state,
      city,
      whatsappNumber,
    } = body;

    if (!whatsappNumber || typeof whatsappNumber !== 'string') {
      return {
        error: {
          message: 'Numero de WhatsApp obrigatorio',
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
            message: 'Curso nao encontrado ou inativo',
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
            message: 'Voce ja esta inscrito neste curso',
            status: 409,
            existingEnrollment: {
              id: existingEnrollment.id,
              status: existingEnrollment.status,
              createdAt: existingEnrollment.createdAt,
            },
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
            eligibilityReason = 'Participante fora das regioes prioritarias';
            regionQuotaId = null;
          } else {
            enrollmentStatus = EnrollmentStatus.PENDING_REGION;
            eligibilityReason = 'Regiao nao elegivel para este curso';
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

      const parsedWaterArea =
        participantType === 'PRODUTOR' && waterArea
          ? parseFloat(waterArea)
          : null;

      const parsedPonds =
        participantType === 'PRODUTOR' && ponds ? parseInt(ponds) : null;

      // Buscar ou criar turma ativa para o curso
      let activeCourseClass: any = null;
      if (enrollmentStatus === EnrollmentStatus.CONFIRMED) {
        activeCourseClass = await (tx as any).courseClass.findFirst({
          where: {
            courseId,
            status: 'ACTIVE',
          },
          orderBy: {
            classNumber: 'desc',
          },
        });

        // Se nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o hÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ turma ativa, criar uma nova
        if (!activeCourseClass) {
          const lastClass = await (tx as any).courseClass.findFirst({
            where: { courseId },
            orderBy: { classNumber: 'desc' },
          });
          const nextClassNumber = lastClass ? lastClass.classNumber + 1 : 1;
          const classLimit = course.maxEnrollments || 50;

          activeCourseClass = await (tx as any).courseClass.create({
            data: {
              courseId,
              classNumber: nextClassNumber,
              limit: classLimit,
              currentCount: 0,
              status: 'ACTIVE',
            },
          });
        }

        // Se a turma atingiu o limite, fechar e criar nova
        if (activeCourseClass.currentCount >= activeCourseClass.limit) {
          await (tx as any).courseClass.update({
            where: { id: activeCourseClass.id },
            data: {
              status: 'CLOSED',
              closedAt: new Date(),
            },
          });

          const lastClass = await (tx as any).courseClass.findFirst({
            where: { courseId },
            orderBy: { classNumber: 'desc' },
          });
          const nextClassNumber = lastClass ? lastClass.classNumber + 1 : 1;
          const classLimit = course.maxEnrollments || 50;

          activeCourseClass = await (tx as any).courseClass.create({
            data: {
              courseId,
              classNumber: nextClassNumber,
              limit: classLimit,
              currentCount: 0,
              status: 'ACTIVE',
            },
          });
        }

        // Incrementar contador da turma
        await (tx as any).courseClass.update({
          where: { id: activeCourseClass.id },
          data: {
            currentCount: { increment: 1 },
          },
        });
      }

      const enrollment = await tx.enrollment.create({
        data: {
          userId,
          courseId,
          courseClassId: activeCourseClass?.id || null,
          progress: 0,
          cpf: cpf || null,
          birthDate: birthDate ? new Date(birthDate) : null,
          participantType: (participantType as any) || null,
          schoolOrUniversity:
            participantType === 'PROFESSOR' && schoolOrUniversity
              ? schoolOrUniversity
              : null,
          hectares: parsedHectares,
          waterArea: parsedWaterArea,
          ponds: parsedPonds,
          state: formattedState,
          city: formattedCity,
          status: enrollmentStatus,
          waitlistPosition,
          regionQuotaId,
          eligibilityReason,
          whatsappNumber,
        } as any,
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
          ...(parsedHectares !== null ? { hectares: parsedHectares } : {}),
          ...(parsedWaterArea !== null ? { waterArea: parsedWaterArea } : {}),
          ...(parsedPonds !== null ? { ponds: parsedPonds } : {}),
          ...(participantType
            ? { participantType: participantType as any }
            : {}),
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

      let notificationTitle = 'Inscricao confirmada!';
      let notificationMessage = `Voce foi inscrito no curso "${course.title}"`;

      if (enrollmentStatus === EnrollmentStatus.WAITLIST) {
        notificationTitle = 'Inscricao em lista de espera';
        notificationMessage = `Voce entrou na lista de espera do curso "${course.title}". Aguarde a confirmacao do administrador.`;
      } else if (enrollmentStatus === EnrollmentStatus.PENDING_REGION) {
        notificationTitle = 'Inscricao pendente';
        notificationMessage = `Sua inscricao no curso "${course.title}" foi registrada, mas ainda nao esta elegivel. Motivo: ${eligibilityReason}.`;
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

  async enrollInCourseByEmail(
    courseId: string,
    body: {
      email: string;
      name?: string;
      cpf?: string;
      birthDate?: string;
      participantType?: string;
      schoolOrUniversity?: string;
      hectares?: any;
      waterArea?: any;
      ponds?: any;
      state?: string;
      city?: string;
      whatsappNumber?: string;
    },
  ) {
    const {
      email,
      name,
      cpf,
      birthDate,
      participantType,
      schoolOrUniversity,
      hectares,
      waterArea,
      ponds,
      state,
      city,
      whatsappNumber,
    } = body;

    // Valida email
    if (!email || typeof email !== 'string') {
      return {
        error: {
          message: 'Email obrigatorio',
          status: 400,
        },
      };
    }

    // Busca o usuÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rio pelo email
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Se nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o existe, cria conta com senha padrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o 123456
    if (!user) {
      if (!name) {
        return {
          error: {
            message: 'Nome obrigatorio para criar nova conta.',
            status: 400,
          },
        };
      }

      // Cria usuÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rio com senha padrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o
      const hashedPassword = await bcrypt.hash('123456', 10);

      try {
        user = await this.prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role: 'USER',
            cpf: cpf || null,
            birthDate: birthDate ? new Date(birthDate) : null,
            participantType: participantType
              ? (participantType as ParticipantType)
              : null,
            schoolOrUniversity:
              participantType === 'PROFESSOR' && schoolOrUniversity
                ? schoolOrUniversity
                : null,
            hectares:
              participantType === 'PRODUTOR' && hectares
                ? parseFloat(hectares)
                : null,
            waterArea:
              participantType === 'PRODUTOR' && waterArea
                ? parseFloat(waterArea)
                : null,
            ponds:
              participantType === 'PRODUTOR' && ponds ? parseInt(ponds) : null,
            state: state || null,
            city: city || null,
            phone: whatsappNumber || null,
          },
        });
      } catch (error) {
        return {
          error: {
            message: 'Erro ao criar conta do usuario',
            status: 500,
          },
        };
      }
    }

    // Verifica se o curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return {
        error: {
          message: 'Curso nao encontrado',
          status: 404,
        },
      };
    }

    // Usa o mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©todo existente de inscriÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o com o userId encontrado/criado
    try {
      const result = await this.enrollInCourse(user.id, courseId, {
        cpf,
        birthDate,
        participantType,
        schoolOrUniversity,
        hectares,
        waterArea,
        ponds,
        state,
        city,
        whatsappNumber,
      });

      return result;
    } catch (error) {
      return {
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Erro ao processar inscricao',
          status: 500,
        },
      };
    }
  }
}
