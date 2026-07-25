import { ApiProperty } from '@nestjs/swagger';

/**
 * Meta info kèm với mảng items trong response phân trang.
 * Shape: { items, meta }
 */
export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Trang hiện tại (1-based)' })
  pageIndex: number;

  @ApiProperty({ example: 20, description: 'Số bản ghi mỗi trang' })
  pageLimit: number;

  @ApiProperty({ example: 123, description: 'Tổng số bản ghi (toàn bộ pages)' })
  totalResults: number;

  @ApiProperty({ example: 7, description: 'Tổng số trang' })
  totalPage: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage: boolean;
}

/**
 * Helper compute meta từ (totalResults, pageIndex, pageLimit).
 * - pageIndex: 1-based.
 * - totalPage = ceil(totalResults / pageLimit), tối thiểu 0 nếu rỗng.
 * - hasNextPage: pageIndex < totalPage.
 * - hasPreviousPage: pageIndex > 1.
 */
export function buildPaginationMeta(
  totalResults: number,
  pageIndex: number,
  pageLimit: number,
): PaginationMetaDto {
  const totalPage = pageLimit > 0 ? Math.ceil(totalResults / pageLimit) : 0;
  return {
    pageIndex,
    pageLimit,
    totalResults,
    totalPage,
    hasNextPage: pageIndex < totalPage,
    hasPreviousPage: pageIndex > 1,
  };
}
