import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body()
    body: {
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
    },
  ) {
    const user = await this.authService.register(body);
    return user;
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Inicia o fluxo OAuth - o Passport redireciona automaticamente
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    try {
      const googleUser = req.user;
      const result = await this.authService.googleLogin(googleUser);
      
      // Normaliza a URL do frontend (remove barra final se existir)
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const redirectUrl = `${frontendUrl}/auth/google/callback?token=${result.accessToken}&user=${encodeURIComponent(JSON.stringify(result.user))}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      // Normaliza a URL do frontend (remove barra final se existir)
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  }
}


