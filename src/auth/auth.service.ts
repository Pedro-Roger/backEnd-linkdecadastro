import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

interface RegisterDto {
  name: string;
  email: string;
  password: string;
  cpf?: string;
  birthDate?: string;
  participantType?: 'ESTUDANTE' | 'PROFESSOR' | 'PESQUISADOR' | 'PRODUTOR';
  schoolOrUniversity?: string;
  hectares?: number;
  waterArea?: number;
  ponds?: number;
  state?: string;
  city?: string;
  phone?: string;
}

interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: 'USER',
        cpf: data.cpf || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        participantType: data.participantType || null,
        schoolOrUniversity:
          data.participantType === 'PROFESSOR' && data.schoolOrUniversity
            ? data.schoolOrUniversity
            : null,
        hectares:
          data.participantType === 'PRODUTOR' && data.hectares
            ? data.hectares
            : null,
        waterArea:
          data.participantType === 'PRODUTOR' && data.waterArea
            ? data.waterArea
            : null,
        ponds:
          data.participantType === 'PRODUTOR' && data.ponds
            ? data.ponds
            : null,
        state: data.state || null,
        city: data.city || null,
        phone: data.phone || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return user;
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return user;
  }

  async login(data: LoginDto) {
    const user = await this.validateUser(data.email, data.password);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      needsProfileCompletion: user.needsProfileCompletion,
      phone: user.phone,
      state: user.state,
      city: user.city,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        needsProfileCompletion: user.needsProfileCompletion,
        phone: user.phone,
        state: user.state,
        city: user.city,
      },
    };
  }

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

  async googleLogin(googleUser: { email: string; name: string; picture?: string | null }) {
    // Verifica se o usuário já existe
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    // Se não existe, cria um novo usuário
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture || null,
          role: 'USER',
          password: null, // Usuários do Google não têm senha
          needsProfileCompletion: true, // Precisa completar perfil
        },
      });
    } else if (googleUser.picture && !user.avatar) {
      // Atualiza avatar se não tiver
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { avatar: googleUser.picture },
      });
    }

    // Gera token JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      needsProfileCompletion: user.needsProfileCompletion,
      phone: user.phone,
      state: user.state,
      city: user.city,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        needsProfileCompletion: user.needsProfileCompletion,
        phone: user.phone,
        state: user.state,
        city: user.city,
        avatar: user.avatar,
      },
    };
  }
}


