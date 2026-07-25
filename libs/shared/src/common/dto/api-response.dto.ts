import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Envelope chuẩn cho mọi response thành công.
 * `data` được type cụ thể bằng decorator `@ApiSuccessResponse(Dto)` ở endpoint.
 */
export class ApiSuccessResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiPropertyOptional({
    example: 'Cập nhật dữ liệu thành công',
    description: 'Thông điệp tóm tắt cho response thành công.',
  })
  message?: string;

  data: T;

  @ApiProperty({ example: '2026-05-16T10:00:00.000Z' })
  timestamp: string;
}

/**
 * Envelope chuẩn cho mọi response lỗi (HttpException).
 * Áp dụng tự động qua `HttpExceptionFilter`.
 */
export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: 'Email không hợp lệ',
    description: 'Thông điệp lỗi tóm tắt cho user',
  })
  message: string;

  @ApiProperty({
    type: [String],
    required: false,
    nullable: true,
    example: ['password must be longer than or equal to 8 characters'],
    description: 'Chi tiết lỗi (vd validation từng field). null nếu không có.',
  })
  errors: string[] | null;

  @ApiProperty({ example: '/api/v1/auth/login' })
  path: string;

  @ApiProperty({ example: '2026-05-16T10:00:00.000Z' })
  timestamp: string;
}
