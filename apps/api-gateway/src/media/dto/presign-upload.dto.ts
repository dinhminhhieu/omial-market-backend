import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Các loại ảnh cho phép upload — whitelist, không blacklist. */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Xin presigned URL để upload ảnh.
 * DTO này KHÔNG nằm trong libs/event-contracts vì media là module của riêng
 * gateway (không đi qua RMQ) — contracts chỉ dành cho message gateway ↔ service.
 */
export class PresignUploadDto {
  @ApiProperty({ example: 'tra-sua-tran-chau.jpg' })
  @IsString()
  @IsNotEmpty({ message: 'Tên file không được để trống' })
  @MaxLength(200, { message: 'Tên file tối đa 200 ký tự' })
  @Transform(({ value }: { value?: string }) => value?.trim())
  fileName: string;

  @ApiProperty({ enum: ALLOWED_IMAGE_TYPES, example: 'image/jpeg' })
  @IsIn(ALLOWED_IMAGE_TYPES, {
    message: 'Chỉ nhận ảnh jpeg / png / webp / gif',
  })
  contentType: string;

  @ApiProperty({ example: 245760, description: 'Kích thước file (byte)' })
  @IsInt({ message: 'size phải là số nguyên (byte)' })
  @Min(1, { message: 'File rỗng' })
  @Max(MAX_UPLOAD_SIZE, { message: 'Ảnh tối đa 5MB' })
  size: number;
}
