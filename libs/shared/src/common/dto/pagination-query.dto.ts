import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query DTO phân trang dùng chung cho các endpoint list.
 * Field trùng tên với `PaginationMetaDto` (pageIndex/pageLimit) để dùng thẳng:
 *
 * ```ts
 * @Get()
 * async findAll(@Query() q: PaginationQueryDto) {
 *   const [items, total] = await this.repo.findAndCount({
 *     skip: q.skip,
 *     take: q.take,
 *   });
 *   return { items, meta: buildPaginationMeta(total, q.pageIndex, q.pageLimit) };
 * }
 * ```
 *
 * Hoạt động nhờ global ValidationPipe (`transform: true` + implicit conversion)
 * nên `?pageIndex=2&pageLimit=20` tự parse thành số.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    default: 1,
    description: 'Trang hiện tại (1-based)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageIndex: number = 1;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 10,
    description: 'Số bản ghi mỗi trang (tối đa 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageLimit: number = 10;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (tùy endpoint)' })
  @IsOptional()
  @IsString()
  search?: string;

  /** Số bản ghi cần bỏ qua — map thẳng vào Prisma `skip`. */
  get skip(): number {
    return (this.pageIndex - 1) * this.pageLimit;
  }

  /** Số bản ghi cần lấy — map thẳng vào Prisma `take`. */
  get take(): number {
    return this.pageLimit;
  }
}
