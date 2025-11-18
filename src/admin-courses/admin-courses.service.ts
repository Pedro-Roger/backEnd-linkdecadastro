import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - pdfkit não possui tipos completos
import PDFDocument from 'pdfkit';
// Podemos usar toLocaleString para datas nos relatórios de exportação

@Injectable()
export class AdminCoursesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createCourse(userId: string, userRole: string | undefined, body: any) {
    this.assertAdmin(userRole);

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

    if (slug && slug.trim()) {
      const slugValue = slug.trim().toLowerCase();
      const existingCourse = await this.prisma.course.findFirst({
        where: { slug: slugValue },
      });
      if (existingCourse) {
        throw new ForbiddenException('URL personalizada já está em uso');
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

    if (slug && slug.trim()) {
      courseData.slug = slug.trim().toLowerCase();
    }

    type RegionQuotaInput = {
      state: string;
      city?: string | null;
      limit: number;
      waitlistLimit?: number | null;
    };

    const normalizedRegionQuotas =
      (regionQuotas as RegionQuotaInput[] | undefined)?.map((quota) => ({
        state: quota.state.trim().toUpperCase(),
        city: quota.city ? quota.city.trim() : null,
        limit: quota.limit,
        waitlistLimit: quota.waitlistLimit ?? 0,
      })) ?? [];

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
      throw new Error('Falha ao carregar curso recém-criado');
    }

    return course;
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
    body: any,
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

    type RegionQuotaUpdateInput = {
      id?: string | null;
      state: string;
      city?: string | null;
      limit: number;
      waitlistLimit?: number | null;
    };

    const normalizedRegionQuotas = regionQuotas
      ? (regionQuotas as RegionQuotaUpdateInput[]).map((quota) => ({
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

    return this.prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            state: true,
            city: true,
            phone: true,
          },
        },
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

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            createdAt: true,
            phone: true,
            state: true,
            city: true,
          },
        },
        regionQuota: {
          select: {
            state: true,
            city: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

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
      'status',
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
      const arrayBuffer = new Uint8Array(pdfBuffer).buffer as ArrayBuffer;

      return {
        buffer: arrayBuffer,
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
}


