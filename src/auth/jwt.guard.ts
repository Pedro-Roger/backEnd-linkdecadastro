import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const headers = request.headers;

      console.error('❌ [Auth] Falha na autenticação:', {
        erro: err,
        info: info ? info.message : 'Sem informação',
        user: user,
        ip: request.ip,
        userAgent: headers['user-agent'],
        authBub: headers['authorization'] ? 'Presente' : 'Ausente',
      });

      throw err || new UnauthorizedException('Acesso não autorizado');
    }
    return user;
  }
}
