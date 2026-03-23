import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminUploadService } from './admin-upload.service';

@UseGuards(JwtAuthGuard)
@Controller('admin/upload')
export class AdminUploadController {
  constructor(private readonly adminUploadService: AdminUploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileFilterCallback,
      ) => {
        if (
          !file.mimetype.startsWith('image/') &&
          !file.mimetype.startsWith('video/')
        ) {
          return cb(null, false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 30 * 1024 * 1024,
      },
    }),
  )
  async uploadBanner(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (
      !req.user ||
      (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')
    ) {
      throw new ForbiddenException('NÃ£o autorizado');
    }

    if (!file) {
      throw new BadRequestException(
        'Arquivo invÃ¡lido ou nÃ£o suportado (apenas imagens e vÃ­deos atÃ© 30MB)',
      );
    }

    return this.adminUploadService.uploadBanner(file);
  }
}
