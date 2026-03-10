import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

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
        phone: true,
        state: true,
        city: true,
        participantType: true,
        schoolOrUniversity: true,
        hectares: true,
        waterArea: true,
        ponds: true,
        cpf: true,
        birthDate: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(
    userId: string,
    data: {
      name: string;
      bio?: string;
      avatar?: string;
      schoolOrUniversity?: string;
      hectares?: number;
      waterArea?: number;
      ponds?: number;
    },
  ) {
    // Buscar o tipo de participante atual do usuário
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { participantType: true },
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        bio: data.bio,
        avatar: data.avatar || null,
        schoolOrUniversity:
          currentUser?.participantType === 'PROFESSOR' &&
            data.schoolOrUniversity !== undefined
            ? data.schoolOrUniversity
            : currentUser?.participantType !== 'PROFESSOR'
              ? null
              : undefined,
        hectares:
          currentUser?.participantType === 'PRODUTOR' &&
            data.hectares !== undefined
            ? data.hectares
            : currentUser?.participantType !== 'PRODUTOR'
              ? null
              : undefined,
        waterArea:
          currentUser?.participantType === 'PRODUTOR' &&
            data.waterArea !== undefined
            ? data.waterArea
            : currentUser?.participantType !== 'PRODUTOR'
              ? null
              : undefined,
        ponds:
          currentUser?.participantType === 'PRODUTOR' &&
            data.ponds !== undefined
            ? data.ponds
            : currentUser?.participantType !== 'PRODUTOR'
              ? null
              : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        role: true,
        schoolOrUniversity: true,
        hectares: true,
        waterArea: true,
        ponds: true,
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

  async listAllUsers(filters?: { state?: string; city?: string }) {
    const where: any = {};

    if (filters?.state) {
      where.state = filters.state;
    }

    if (filters?.city) {
      where.city = filters.city;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        state: true,
        city: true,
        participantType: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            enrollments: true,
            registrations: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateUserRole(userId: string, role: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });
  }

  async createUser(data: {
    name: string;
    email: string;
    password?: string;
    role: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email já cadastrado');
    }

    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : null;

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as UserRole,
        needsProfileCompletion: !data.password,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
