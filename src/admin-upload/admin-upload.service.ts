import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';

@Injectable()
export class AdminUploadService {
  private readonly s3Client: S3Client | null;
  private readonly bucketName?: string;
  private readonly region?: string;
  private readonly publicBaseUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
    this.region = this.configService.get<string>('AWS_REGION');
    this.publicBaseUrl = this.configService.get<string>('AWS_S3_PUBLIC_BASE_URL');

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    if (
      this.bucketName &&
      this.region &&
      accessKeyId &&
      secretAccessKey
    ) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.s3Client = null;
    }
  }

  async uploadBanner(file: Express.Multer.File) {
    const extension = extname(file.originalname) || this.getDefaultExtension(file);
    const filename = `banner-${Date.now()}-${randomUUID()}${extension}`;
    const type = file.mimetype.startsWith('video/') ? 'video' : 'image';

    if (this.s3Client && this.bucketName) {
      const key = `uploads/banners/${filename}`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      return {
        url: this.getPublicUrl(key),
        filename,
        key,
        type,
        storage: 's3',
      };
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'banners');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), file.buffer);

    return {
      url: `/uploads/banners/${filename}`,
      filename,
      type,
      storage: 'local',
    };
  }

  private getPublicUrl(key: string) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private getDefaultExtension(file: Express.Multer.File) {
    if (file.mimetype.startsWith('video/')) {
      return '.mp4';
    }

    if (file.mimetype === 'image/png') {
      return '.png';
    }

    if (file.mimetype === 'image/webp') {
      return '.webp';
    }

    if (file.mimetype === 'image/gif') {
      return '.gif';
    }

    return '.jpg';
  }
}
