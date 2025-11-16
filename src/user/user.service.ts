import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(userId: string, data: { name: string; bio?: string; avatar?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        bio: data.bio,
        avatar: data.avatar || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        role: true,
      },
    });
  }

  async completeProfile(
    userId: string,
    data: { fullName: string; phone: string; cpf: string },
  ) {
    const existingUserWithCpf = await this.prisma.user.findFirst({
      where: {
        cpf: data.cpf,
        id: { not: userId },
      },
    });

    if (existingUserWithCpf) {
      throw new BadRequestException('CPF já está em uso por outro usuário');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        cpf: data.cpf,
        needsProfileCompletion: false,
      },
    });

    return {
      message: 'Perfil completado com sucesso',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        fullName: updatedUser.fullName,
        phone: updatedUser.phone,
        cpf: updatedUser.cpf,
      },
    };
  }

  async getStats(userId: string) {
    const coursesEnrolled = await this.prisma.enrollment.count({
      where: { userId },
    });

    const lessonsCompleted = await this.prisma.lessonProgress.count({
      where: {
        userId,
        completed: true,
      },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      select: { progress: true },
    });

    const totalProgress =
      enrollments.length > 0
        ? Math.round(
            enrollments.reduce((sum, e) => sum + e.progress, 0) /
              enrollments.length,
          )
        : 0;

    return {
      coursesEnrolled,
      lessonsCompleted,
      totalProgress,
    };
  }
}


