import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { PresignUploadResponseDto } from './dto/presign-upload-response.dto';

@Injectable()
export class MediaService {
  private readonly s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.MINIO_ENDPOINT,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
      forcePathStyle: true,
    });
  }

  async presignUpload(
    dto: PresignUploadDto,
  ): Promise<PresignUploadResponseDto> {
    const ext = extname(dto.fileName) || '.jpg';
    const key = `products/${randomUUID()}${ext}`;

    const bucket = process.env.MEDIA_BUCKET ?? 'omial-media';
    const publicUrlBase =
      process.env.MEDIA_PUBLIC_URL ?? 'http://localhost:9000';
    const expiresIn = 600;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn,
      signableHeaders: new Set(['content-type']),
    });
    const publicUrl = `${publicUrlBase}/${bucket}/${key}`;

    return {
      uploadUrl,
      key,
      publicUrl,
      expiresIn,
    };
  }
}
