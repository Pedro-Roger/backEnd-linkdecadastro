import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

// Enum de status das turmas
const CourseClassStatus = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
} as const;

type CourseClassStatus = 'ACTIVE' | 'CLOSED';
import * as XLSX from 'xlsx';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - pdfkit não possui tipos completos
import PDFDocument from 'pdfkit';
// Podemos usar toLocaleString para datas nos relatórios de exportação

@Injectable()
export class AdminCoursesService {
  constructor(private readonly prisma: PrismaService) { }

  private assertAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Não autorizado');
    }
  }

  async listCourses(userRole?: string) {
    this.assertAdmin(userRole);

    return this.prisma.course.findMany({
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
            order: true,
          },
        },
        regionQuotas: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllEnrollmentsForWhatsApp(
    userRole?: string,
    filters?: {
      city?: string;
      state?: string;
      participantType?: string;
    },
  ) {
    this.assertAdmin(userRole);

    try {
      console.log('listAllEnrollmentsForWhatsApp filters:', filters); // Debug log
      // Construction do filtro do Prisma
      const where: any = {};

      if (filters) {
        if (filters.city) {
          where.city = {
            contains: filters.city,
          };
        }
        if (filters.state) {
          where.state = {
            contains: filters.state,
          };
        }
        if (filters.participantType) {
          where.participantType = filters.participantType;
        }
      }

      // Filtro adicional para buscar APENAS inscritos num curso/evento específico
      // Isso muda a lógica de buscar "todos os usuários" para "usuários inscritos neste curso"
      // Se não houver courseId ou eventId, mantém a lógica de buscar todos

      let users: any[] = [];

      const courseId = (filters as any).courseId;
      const eventId = (filters as any).eventId;

      if (courseId) {
        // Buscar inscrições deste curso
        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            courseId: courseId,
            user: {
              phone: { not: null },
              ...where
            }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                city: true,
                state: true,
                participantType: true,
              }
            }
          }
        });
        users = enrollments.map(e => e.user);
      }
      else if (eventId) {
        // Buscar inscrições deste evento
        console.log('[DEBUG] Buscando registrations para eventId:', eventId);
        const registrations = await this.prisma.registration.findMany({
          where: {
            eventId: eventId,
            // Aplicar filtros de cidade/estado diretamente no registro se disponíveis
            ...(filters?.city ? { city: { contains: filters.city } } : {}),
            ...(filters?.state ? { state: { contains: filters.state } } : {}),
            ...(filters?.participantType ? { participantType: filters.participantType as any } : {})
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            state: true,
            participantType: true,
          }
        });
        console.log('[DEBUG] Registrations encontrados:', registrations.length);
        console.log('[DEBUG] Primeiros 3 registros:', registrations.slice(0, 3));
        users = registrations;
      }
      else {
        // Comportamento padrão: buscar todos os usuários E todas as inscrições em eventos
        // Isso garante que alunos que só se inscreveram em eventos (e não criaram conta) também apareçam

        const [dbUsers, dbRegistrations] = await Promise.all([
          this.prisma.user.findMany({
            where: {
              ...where,
              phone: { not: null }, // Só queremos quem tem telefone
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              city: true,
              state: true,
              participantType: true,
            },
            orderBy: { name: 'asc' },
          }),
          this.prisma.registration.findMany({
             where: {
               // Reutilizar os mesmos filtros de cidade/estado/tipo
               ...where,
               phone: { not: null }
             },
             select: {
               id: true,
               name: true,
               email: true,
               phone: true,
               city: true,
               state: true,
               participantType: true,
             }
          })
        ]);

        // Combinar ambas as listas
        users = [...dbUsers, ...dbRegistrations];
      }

      // Processar e normalizar
      console.log('[DEBUG] Total de users antes de processar:', users.length);
      const participants = users
        .map((user) => {
          const phone = user.phone;
          if (!phone) return null;

          // Formatar telefone para WhatsApp
          const cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone.length < 10) {
            return null; // Telefone inválido
          }

          const whatsappId = `${cleanPhone}@c.us`;

          return {
            id_contato: whatsappId,
            nome: user.name || 'Sem nome',
            email: user.email,
            telefone: phone,
            cidade: user.city || '',
            estado: user.state || '',
            participante_tipo: user.participantType || '',
            produtor: user.participantType === 'PRODUTOR',
            professor: user.participantType === 'PROFESSOR',
            estudante: user.participantType === 'ESTUDANTE',
          };
        })
        .filter((p) => p !== null);

      console.log('[DEBUG] Participantes após processar:', participants.length);

      // Remover duplicatas por telefone/id_contato
      const uniqueParticipants = Array.from(
        new Map(participants.map((p) => [p!.id_contato, p!])).values(),
      );

      console.log('[DEBUG] Participantes únicos:', uniqueParticipants.length);
      console.log('[DEBUG] Retornando resposta...');

      return {
        total: uniqueParticipants.length,
        participantes: uniqueParticipants,
      };
    } catch (error) {
      console.error('Error ANY in listAllEnrollmentsForWhatsApp:', error);
      throw error;
    }
  }

  async getCourseById(courseId: string, userId: string, userRole?: string) {
    this.assertAdmin(userRole);

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
        regionQuotas: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    // Admins podem ver qualquer curso - removida restrição de createdBy

    return course;
  }

  private extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  async createCourse(userId: string, userRole: string | undefined, body: CreateCourseDto) {
    try {
      this.assertAdmin(userRole);
    } catch (error) {
      throw error;
    }

    const {
      title,
      description,
      bannerUrl,
      status,
      type,
      maxEnrollments,
      waitlistEnabled,
      waitlistLimit,
      regionRestrictionEnabled,
      allowAllRegions,
      defaultRegionLimit,
      regionQuotas,
      startDate,
      endDate,
      slug,
      firstLesson,
    } = body;

    // Validation is now handled by DTO

    // Normalizar e validar slug - tratar strings vazias como null
    let normalizedSlug: string | null = null;
    if (slug !== undefined && slug !== null) {
      const slugStr = String(slug).trim();
      if (slugStr.length > 0) {
        normalizedSlug = slugStr.toLowerCase();
        // Regex validation handled by DTO

        // Verificar se já existe
        const existingCourse = await this.prisma.course.findFirst({
          where: { slug: normalizedSlug },
        });
        if (existingCourse) {
          throw new ForbiddenException('URL personalizada já está em uso');
        }
      }
    }

    let finalBannerUrl: string | null = null;

    if (!bannerUrl || !bannerUrl.trim()) {
      if (firstLesson?.videoUrl) {
        const youtubeId = this.extractYouTubeId(firstLesson.videoUrl);
        if (youtubeId) {
          finalBannerUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        }
      }
    } else {
      finalBannerUrl = bannerUrl.trim();
    }

    const courseData: any = {
      title,
      description: description || null,
      bannerUrl: finalBannerUrl,
      status: status ?? 'ACTIVE',
      type: type ?? 'ONLINE',
      maxEnrollments: maxEnrollments || null,
      waitlistEnabled: waitlistEnabled ?? false,
      waitlistLimit: waitlistLimit ?? 0,
      regionRestrictionEnabled: regionRestrictionEnabled ?? false,
      allowAllRegions: allowAllRegions ?? true,
      defaultRegionLimit:
        defaultRegionLimit !== undefined ? defaultRegionLimit : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdBy: userId,
    };

    // Usar o slug normalizado (já validado acima) - usar undefined em vez de null para evitar problemas
    courseData.slug = normalizedSlug || undefined;

    const normalizedRegionQuotas =
      regionQuotas?.map((quota) => ({
        state: quota.state.trim().toUpperCase(),
        city: quota.city ? quota.city.trim() : null,
        limit: quota.limit,
        waitlistLimit: quota.waitlistLimit ?? 0,
      })) ?? [];

    try {
      const course = await this.prisma.$transaction(async (tx) => {
        const newCourse = await tx.course.create({
          data: courseData,
        });

        if (normalizedRegionQuotas.length > 0) {
          await tx.courseRegionQuota.createMany({
            data: normalizedRegionQuotas.map((quota) => ({
              courseId: newCourse.id,
              state: quota.state,
              city: quota.city,
              limit: quota.limit,
              waitlistLimit: quota.waitlistLimit,
            })),
          });
        }

        if (firstLesson) {
          const youtubeId = this.extractYouTubeId(firstLesson.videoUrl);
          if (!youtubeId) {
            throw new Error('URL do YouTube inválida');
          }

          const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;

          await tx.lesson.create({
            data: {
              courseId: newCourse.id,
              title: firstLesson.title,
              description: firstLesson.description || null,
              videoUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
              bannerUrl: thumbnailUrl,
              order: firstLesson.order || 0,
            },
          });
        }

        return tx.course.findUnique({
          where: { id: newCourse.id },
          include: {
            creator: {
              select: {
                name: true,
                email: true,
              },
            },
            lessons: {
              orderBy: { order: 'asc' },
            },
            regionQuotas: true,
            _count: {
              select: {
                enrollments: true,
              },
            },
          },
        });
      });

      if (!course) {
        throw new NotFoundException('Falha ao carregar curso recém-criado');
      }

      return course;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ForbiddenException('URL personalizada já está em uso');
      }
      throw error;
    }
  }

  async deleteCourse(
    courseId: string,
    userId: string,
    userRole?: string,
  ): Promise<void> {
    this.assertAdmin(userRole);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    // Admins podem deletar qualquer curso - removida restrição de createdBy

    await this.prisma.course.delete({
      where: { id: courseId },
    });
  }

  async updateCourse(
    courseId: string,
    userId: string,
    userRole: string | undefined,
    body: UpdateCourseDto,
  ) {
    this.assertAdmin(userRole);

    const existingCourse = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!existingCourse) {
      throw new NotFoundException('Curso não encontrado');
    }

    // Admins podem editar qualquer curso - removida restrição de createdBy

    const {
      title,
      description,
      bannerUrl,
      status,
      type,
      maxEnrollments,
      waitlistEnabled,
      waitlistLimit,
      regionRestrictionEnabled,
      allowAllRegions,
      defaultRegionLimit,
      regionQuotas,
      startDate,
      endDate,
      slug,
    } = body;

    let finalBannerUrl: string | null | undefined = undefined;
    if (bannerUrl !== undefined) {
      if (bannerUrl && bannerUrl.trim()) {
        finalBannerUrl = bannerUrl.trim();
      } else {
        finalBannerUrl = null;
      }
    }

    const normalizedRegionQuotas = regionQuotas
      ? regionQuotas.map((quota) => ({
        id: quota.id ?? null,
        state: quota.state.trim().toUpperCase(),
        city: quota.city ? quota.city.trim() : null,
        limit: quota.limit,
        waitlistLimit: quota.waitlistLimit ?? 0,
      }))
      : null;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (finalBannerUrl !== undefined) updateData.bannerUrl = finalBannerUrl;
    if (status !== undefined) updateData.status = status;
    if (type !== undefined) updateData.type = type;
    if (maxEnrollments !== undefined)
      updateData.maxEnrollments = maxEnrollments || null;
    if (waitlistEnabled !== undefined)
      updateData.waitlistEnabled = waitlistEnabled;
    if (waitlistLimit !== undefined) updateData.waitlistLimit = waitlistLimit;
    if (regionRestrictionEnabled !== undefined)
      updateData.regionRestrictionEnabled = regionRestrictionEnabled;
    if (allowAllRegions !== undefined)
      updateData.allowAllRegions = allowAllRegions;
    if (defaultRegionLimit !== undefined)
      updateData.defaultRegionLimit = defaultRegionLimit ?? null;
    if (startDate !== undefined)
      updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined)
      updateData.endDate = endDate ? new Date(endDate) : null;
    if (slug !== undefined) {
      updateData.slug =
        slug && slug.trim() ? slug.trim().toLowerCase() : null;
    }

    const updatedCourse = await this.prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: courseId },
        data: updateData,
      });

      if (normalizedRegionQuotas) {
        const existingQuotas = await tx.courseRegionQuota.findMany({
          where: { courseId },
        });

        const payloadIds = normalizedRegionQuotas
          .map((quota) => quota.id)
          .filter((id): id is string => !!id);

        const quotasToDelete = existingQuotas
          .filter((quota) => !payloadIds.includes(quota.id))
          .map((quota) => quota.id);

        if (quotasToDelete.length > 0) {
          await tx.courseRegionQuota.deleteMany({
            where: { id: { in: quotasToDelete } },
          });
        }

        for (const quota of normalizedRegionQuotas) {
          if (quota.id) {
            await tx.courseRegionQuota.update({
              where: { id: quota.id },
              data: {
                state: quota.state,
                city: quota.city,
                limit: quota.limit,
                waitlistLimit: quota.waitlistLimit,
              },
            });
          } else {
            await tx.courseRegionQuota.create({
              data: {
                courseId,
                state: quota.state,
                city: quota.city,
                limit: quota.limit,
                waitlistLimit: quota.waitlistLimit,
              },
            });
          }
        }
      }

      return tx.course.findUnique({
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
          },
          regionQuotas: true,
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      });
    });

    if (!updatedCourse) {
      throw new NotFoundException('Curso não encontrado após atualização');
    }

    return updatedCourse;
  }

  async listLessons(courseId: string, userRole?: string) {
    this.assertAdmin(userRole);

    return this.prisma.lesson.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            comments: true,
            progress: true,
          },
        },
      },
    });
  }

  async createLesson(
    courseId: string,
    userId: string,
    userRole: string | undefined,
    body: any,
  ) {
    this.assertAdmin(userRole);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    // Admins podem criar aulas em qualquer curso - removida restrição de createdBy

    const youtubeId = this.extractYouTubeId(body.videoUrl);
    if (!youtubeId) {
      throw new ForbiddenException('URL do YouTube inválida');
    }

    let finalBannerUrl =
      body.bannerUrl && body.bannerUrl.trim() ? body.bannerUrl.trim() : null;
    if (!finalBannerUrl) {
      finalBannerUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    }

    const lesson = await this.prisma.lesson.create({
      data: {
        title: body.title,
        description: body.description || null,
        videoUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
        bannerUrl: finalBannerUrl,
        duration: body.duration || null,
        order: body.order,
        courseId,
      },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      select: { userId: true },
    });

    if (enrollments.length > 0) {
      await this.prisma.notification.createMany({
        data: enrollments.map((enrollment) => ({
          userId: enrollment.userId,
          type: 'COURSE_UPDATED',
          title: 'Nova aula disponível',
          message: `Uma nova aula foi adicionada ao curso "${course.title}": ${body.title}`,
          link: `/course/${courseId}`,
        })),
      });
    }

    return lesson;
  }

  async getLesson(
    courseId: string,
    lessonId: string,
    userId: string,
    userRole?: string,
  ) {
    this.assertAdmin(userRole);

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            createdBy: true,
          },
        },
      },
    });

    if (!lesson || lesson.courseId !== courseId) {
      throw new NotFoundException('Aula não encontrada');
    }

    // Admins podem ver qualquer aula - removida restrição de createdBy

    return lesson;
  }

  async updateLesson(
    courseId: string,
    lessonId: string,
    userId: string,
    userRole: string | undefined,
    body: any,
  ) {
    this.assertAdmin(userRole);

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            createdBy: true,
          },
        },
      },
    });

    if (!lesson || lesson.courseId !== courseId) {
      throw new NotFoundException('Aula não encontrada');
    }

    // Admins podem editar qualquer aula - removida restrição de createdBy

    const youtubeId = this.extractYouTubeId(body.videoUrl);
    if (!youtubeId) {
      throw new ForbiddenException('URL do YouTube inválida');
    }

    let finalBannerUrl =
      body.bannerUrl && body.bannerUrl.trim() ? body.bannerUrl.trim() : null;
    if (!finalBannerUrl) {
      finalBannerUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    }

    const updatedLesson = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: body.title,
        description: body.description || null,
        videoUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
        bannerUrl: finalBannerUrl,
        duration: body.duration || null,
        order: body.order,
      },
    });

    return updatedLesson;
  }

  async deleteLesson(
    courseId: string,
    lessonId: string,
    userId: string,
    userRole?: string,
  ) {
    this.assertAdmin(userRole);

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          select: {
            id: true,
            createdBy: true,
          },
        },
      },
    });

    if (!lesson || lesson.courseId !== courseId) {
      throw new NotFoundException('Aula não encontrada');
    }

    // Admins podem deletar qualquer aula - removida restrição de createdBy

    await this.prisma.lesson.delete({
      where: { id: lessonId },
    });
  }

  async listEnrollments(courseId: string, userRole?: string) {
    this.assertAdmin(userRole);

    try {
      // Primeiro, busca os enrollments sem o include do user para evitar erro
      const enrollmentsData = await this.prisma.enrollment.findMany({
        where: { courseId },
        include: {
          course: {
            select: {
              title: true,
              waitlistEnabled: true,
              waitlistLimit: true,
              maxEnrollments: true,
            },
          },
          regionQuota: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Busca os users separadamente para evitar erro quando user não existe
      const userIds = enrollmentsData.map((e) => e.userId).filter(Boolean);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          state: true,
          city: true,
          phone: true,
        },
      });

      // Cria um mapa de users por id
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Busca informações das turmas
      const courseClassIds = enrollmentsData
        .map((e: any) => e.courseClassId)
        .filter(Boolean);
      const courseClasses = courseClassIds.length > 0
        ? await (this.prisma as any).courseClass.findMany({
          where: { id: { in: courseClassIds } },
          select: { id: true, classNumber: true },
        })
        : [];
      const classMap = new Map(courseClasses.map((c: any) => [c.id, c]));

      // Combina os dados, filtrando apenas enrollments com user válido
      const enrollments = enrollmentsData
        .map((enrollment: any) => {
          const user = userMap.get(enrollment.userId);
          if (!user) {
            return null;
          }
          let courseClassData: { classNumber: number } | null = null;
          if (enrollment.courseClassId) {
            const foundClass = classMap.get(enrollment.courseClassId) as { id: string; classNumber: number } | undefined;
            if (foundClass) {
              courseClassData = { classNumber: foundClass.classNumber };
            }
          }
          return {
            ...enrollment,
            user,
            courseClass: courseClassData,
          };
        })
        .filter((e) => e !== null) as any[];

      return enrollments;
    } catch (error) {
      throw error;
    }
  }

  private statusLabels: Record<EnrollmentStatus, string> = {
    CONFIRMED: 'Confirmada',
    WAITLIST: 'Lista de Espera',
    PENDING_REGION: 'Pendente',
    REJECTED: 'Rejeitada',
  };

  async exportEnrollments(
    courseId: string,
    userRole: string | undefined,
    formatParam?: string,
    fieldsParam?: string[],
  ) {
    this.assertAdmin(userRole);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    let enrollments: any[] = [];

    try {
      // Primeiro, busca os enrollments sem o include do user para evitar erro
      const enrollmentsData = await this.prisma.enrollment.findMany({
        where: { courseId },
        include: {
          regionQuota: {
            select: {
              state: true,
              city: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Busca os users separadamente para evitar erro quando user não existe
      const userIds = enrollmentsData.map((e) => e.userId).filter(Boolean);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          phone: true,
          state: true,
          city: true,
        },
      });

      // Cria um mapa de users por id
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Combina os dados, filtrando apenas enrollments com user válido
      enrollments = enrollmentsData
        .map((enrollment) => {
          const user = userMap.get(enrollment.userId);
          if (!user) {
            return null;
          }
          return {
            ...enrollment,
            user,
          };
        })
        .filter((e) => e !== null) as any[];
    } catch (error) {
      throw error;
    }

    const availableFields = {
      number: {
        label: 'Nº',
        getter: (_e: any) => 0, // será sobrescrito no momento da geração da linha
      },
      name: {
        label: 'Nome',
        getter: (e: any) => e.user.name,
      },
      email: {
        label: 'Email',
        getter: (e: any) => e.user.email,
      },
      whatsapp: {
        label: 'WhatsApp',
        getter: (e: any) =>
          e.whatsappNumber || e.user.phone || '-',
      },
      status: {
        label: 'Status',
        getter: (e: any) =>
          this.statusLabels[e.status as EnrollmentStatus] || e.status,
      },
      progress: {
        label: 'Progresso (%)',
        getter: (e: any) => e.progress ?? 0,
      },
      participantType: {
        label: 'Tipo de Participante',
        getter: (e: any) => e.participantType || '-',
      },
      cpf: {
        label: 'CPF',
        getter: (e: any) => e.cpf || '-',
      },
      state: {
        label: 'Estado',
        getter: (e: any) => e.state || e.user.state || '-',
      },
      city: {
        label: 'Cidade',
        getter: (e: any) => e.city || e.user.city || '-',
      },
      region: {
        label: 'Região do Curso',
        getter: (e: any) => {
          if (e.regionQuota) {
            return e.regionQuota.city
              ? `${e.regionQuota.state} - ${e.regionQuota.city}`
              : e.regionQuota.state;
          }
          return '-';
        },
      },
      eligible: {
        label: 'Elegível para Região',
        getter: (e: any) => {
          if (e.status === 'PENDING_REGION') {
            return 'Não';
          }
          if (e.regionQuota) {
            return 'Sim';
          }
          return e.status === 'CONFIRMED' ? 'Sim' : 'Não';
        },
      },
      createdAt: {
        label: 'Data de Inscrição',
        getter: (e: any) =>
          new Date(e.createdAt).toLocaleString(),
      },
      completedAt: {
        label: 'Data de Conclusão',
        getter: (e: any) =>
          e.completedAt
            ? new Date(e.completedAt).toLocaleString()
            : '-',
      },
      waitlistPosition: {
        label: 'Posição na Lista de Espera',
        getter: (e: any) => e.waitlistPosition ?? '-',
      },
      eligibilityReason: {
        label: 'Observações',
        getter: (e: any) => e.eligibilityReason || '-',
      },
    } as const;

    const defaultFields = [
      'number',
      'name',
      'email',
      'whatsapp',
      'status',
      'region',
      'eligible',
      'progress',
      'createdAt',
    ] as const;
    type FieldKey = keyof typeof availableFields;

    function parseFields(fields?: string[]): FieldKey[] {
      if (!fields || fields.length === 0) {
        return [...defaultFields] as FieldKey[];
      }
      const parsed = fields
        .map((field) => field.trim())
        .filter((field): field is FieldKey => field in availableFields);
      return parsed.length > 0 ? parsed : ([...defaultFields] as FieldKey[]);
    }

    const selectedFields = parseFields(fieldsParam);

    const headerRow = selectedFields.map((key) => availableFields[key].label);
    const dataRows = enrollments.map((enrollment, index) =>
      selectedFields.map((key) => {
        const value =
          key === 'number'
            ? index + 1
            : availableFields[key].getter(enrollment);
        return value === null || value === undefined ? '' : value;
      }),
    );

    const sanitizedTitle = course.title
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();

    const formatType =
      formatParam === 'csv' || formatParam === 'pdf' ? formatParam : 'xlsx';

    if (formatType === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', margin: 40 }) as PDFKit.PDFDocument;
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      const pdfPromise = new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      doc.fontSize(16).text(`Relatório de Inscrições - ${course.title}`);
      doc.moveDown();

      if (enrollments.length === 0) {
        doc.fontSize(12).text('Nenhum inscrito encontrado.');
      } else {
        enrollments.forEach((enrollment, index) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`Participante ${index + 1}`);
          doc.moveDown(0.2);

          selectedFields.forEach((fieldKey) => {
            if (fieldKey === 'number') return;
            const descriptor = availableFields[fieldKey];
            const value = descriptor.getter(enrollment);
            doc
              .font('Helvetica')
              .fontSize(11)
              .text(`${descriptor.label}: ${value ?? '-'}`);
          });

          doc.moveDown();
        });
      }

      doc.end();

      const pdfBuffer = await pdfPromise;

      return {
        buffer: pdfBuffer,
        contentType: 'application/pdf',
        filename: `inscritos-${sanitizedTitle}.pdf`,
      };
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscritos');

    if (formatType === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
      const csvBuffer = Buffer.from(csv, 'utf-8');
      return {
        buffer: csvBuffer,
        contentType: 'text/csv; charset=utf-8',
        filename: `inscritos-${sanitizedTitle}.csv`,
      };
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `inscritos-${sanitizedTitle}.xlsx`,
    };
  }

  // ========== GESTÃO DE TURMAS (COURSE CLASSES) ==========

  async listCourseClasses(courseId: string, userRole: string | undefined) {
    this.assertAdmin(userRole);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        maxEnrollments: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    const classes = await (this.prisma as any).courseClass.findMany({
      where: { courseId },
      orderBy: { classNumber: 'asc' },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
    }) as any[];

    const classesWithCounts = classes.map((classItem: any) => {
      const confirmedCount = enrollments.filter(
        (e: any) =>
          e.courseClassId === classItem.id &&
          e.status === EnrollmentStatus.CONFIRMED,
      ).length;

      return {
        id: classItem.id,
        classNumber: classItem.classNumber,
        limit: classItem.limit,
        currentCount: confirmedCount,
        status: classItem.status,
        createdAt: classItem.createdAt,
        closedAt: classItem.closedAt,
        totalEnrollments: classItem._count.enrollments,
      };
    });

    const activeClass = classes.find(
      (c: any) => c.status === CourseClassStatus.ACTIVE,
    );

    return {
      course: {
        id: course.id,
        title: course.title,
        maxEnrollments: course.maxEnrollments,
      },
      classes: classesWithCounts,
      activeClassNumber: activeClass?.classNumber ?? null,
      activeClassLimit: activeClass?.limit ?? null,
      activeClassCount: activeClass
        ? enrollments.filter(
          (e: any) =>
            e.courseClassId === activeClass.id &&
            e.status === EnrollmentStatus.CONFIRMED,
        ).length
        : null,
    };
  }

  async createCourseClass(
    courseId: string,
    userRole: string | undefined,
    body: { limit: number },
  ) {
    this.assertAdmin(userRole);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    // Buscar a última turma para determinar o próximo número
    const lastClass = await (this.prisma as any).courseClass.findFirst({
      where: { courseId },
      orderBy: { classNumber: 'desc' },
    });

    const nextClassNumber = lastClass ? lastClass.classNumber + 1 : 1;

    // Se não há limite específico, usar o maxEnrollments do curso
    const limit = body.limit || course.maxEnrollments || 50;

    return await this.prisma.$transaction(async (tx) => {
      // Criar a nova turma
      const newClass = await (tx as any).courseClass.create({
        data: {
          courseId,
          classNumber: nextClassNumber,
          limit,
          currentCount: 0,
          status: CourseClassStatus.ACTIVE,
        },
      });

      // Buscar pessoas na lista de espera (status WAITLIST) ordenadas por waitlistPosition
      const waitlistEnrollments = await tx.enrollment.findMany({
        where: {
          courseId,
          status: EnrollmentStatus.WAITLIST,
        },
        orderBy: {
          waitlistPosition: 'asc',
        },
        take: limit, // Pegar até o limite da turma
      });

      // Mover pessoas da lista de espera para a nova turma
      let allocatedCount = 0;
      for (const enrollment of waitlistEnrollments) {
        if (allocatedCount >= limit) break;

        await (tx.enrollment.update as any)({
          where: { id: enrollment.id },
          data: {
            status: EnrollmentStatus.CONFIRMED,
            courseClassId: newClass.id,
            waitlistPosition: null,
          },
        });

        allocatedCount++;
      }

      // Atualizar o contador da turma
      await (tx as any).courseClass.update({
        where: { id: newClass.id },
        data: {
          currentCount: allocatedCount,
        },
      });

      // Buscar informações completas da turma criada
      return await (tx as any).courseClass.findUnique({
        where: { id: newClass.id },
        include: {
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      });
    });
  }

  async closeCourseClass(classId: string, userRole: string | undefined) {
    this.assertAdmin(userRole);

    const classItem = await (this.prisma as any).courseClass.findUnique({
      where: { id: classId },
    });

    if (!classItem) {
      throw new NotFoundException('Turma não encontrada');
    }

    if (classItem.status === CourseClassStatus.CLOSED) {
      throw new ForbiddenException('Turma já está encerrada');
    }

    return (this.prisma as any).courseClass.update({
      where: { id: classId },
      data: {
        status: CourseClassStatus.CLOSED,
        closedAt: new Date(),
      },
    });
  }
}


