import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';

@UseGuards(JwtAuthGuard)
@Controller('admin/upload')
export class AdminUploadController {
  private getUploadPath() {
    // Diretório padrão: ./public/uploads/banners relative ao backend
    const baseDir =
      process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads', 'banners');
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          const controller = new AdminUploadController();
          const uploadPath = controller.getUploadPath();
          cb(null, uploadPath);
        },
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const timestamp = Date.now();
          const randomString = Math.random().toString(36).substring(2, 15);
          const fileExtName = extname(file.originalname) || '.jpg';
          const filename = `banner-${timestamp}-${randomString}${fileExtName}`;
          cb(null, filename);
        },
      }),
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileFilterCallback,
      ) => {
        // Aceitar imagens e vídeos
        if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
          return cb(null, false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 30 * 1024 * 1024, // 30MB para suportar vídeos curtos
      },
    }),
  )
  async uploadBanner(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Não autorizado');
    }

    if (!file) {
      throw new BadRequestException('Arquivo inválido ou não suportado (apenas imagens e vídeos até 30MB)');
    }

    const relativePath = `/uploads/banners/${file.filename}`;
    
    // Retornar também o tipo para facilitar o frontend
    const type = file.mimetype.startsWith('video/') ? 'video' : 'image';

    return {
      url: relativePath,
      filename: file.filename,
      type
    };
  }
}


