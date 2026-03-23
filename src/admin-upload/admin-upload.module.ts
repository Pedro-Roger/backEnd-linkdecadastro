import { Module } from '@nestjs/common';
import { AdminUploadController } from './admin-upload.controller';
import { AdminUploadService } from './admin-upload.service';

@Module({
  controllers: [AdminUploadController],
  providers: [AdminUploadService],
})
export class AdminUploadModule {}
