import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { StockRefInputDto } from './stock-ref-input.dto';

/**
 * BATCH query — gửi 1 lần cho cả trang danh sách sản phẩm/biến thể.
 * Ref nào chưa được theo dõi tồn (chưa từng nhập kho) sẽ KHÔNG có trong
 * kết quả trả về — FE hiểu là "không theo dõi tồn kho".
 */
export class GetStockDto {
  @ApiProperty({ type: [StockRefInputDto] })
  @IsArray()
  @ArrayNotEmpty({ message: 'refs không được rỗng' })
  @ArrayMaxSize(200, { message: 'Tối đa 200 ref mỗi lần truy vấn' })
  @ValidateNested({ each: true })
  @Type(() => StockRefInputDto)
  refs: StockRefInputDto[];
}
