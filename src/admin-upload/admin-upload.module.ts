import { Module } from '@nestjs/common';
import { AdminUploadController } from './admin-upload.controller';

@Module({
  controllers: [AdminUploadController],
})
export class AdminUploadModule {}
