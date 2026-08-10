import { ApiProperty } from '@nestjs/swagger';

/**
 * Label trả về cho client.
 * KHÔNG lộ cờ soft-delete (`isDeleted`/`deletedAt`) — đó là chi tiết nội bộ.
 */
export class LabelResponseDto {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  id: string;

  @ApiProperty({ example: 'Hàng mới về' })
  name: string;

  @ApiProperty({ example: '#FF5733', required: false, nullable: true })
  color?: string | null;

  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
