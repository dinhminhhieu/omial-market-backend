import { BadRequestException } from '@nestjs/common';

/**
 * Item tối thiểu cần cho việc validate — dùng chung cho cả OptionTemplateItem
 * (mẫu, không có `status`) lẫn ProductOptionItem (bản sao của sản phẩm, có `status`).
 */
export interface OptionItemLike {
  isDefault?: boolean | null;
  status?: boolean | null;
}

/**
 * Invariant của 1 nhóm tuỳ chọn — DB KHÔNG gác được (cross-row/cross-table):
 * - minSelect ≤ maxSelect (không thể "chọn ít nhất 3, tối đa 2")
 * - minSelect ≤ số item (không thể bắt chọn 5 trong nhóm 3 item)
 * - số item mặc định ≤ maxSelect (single-select thì chỉ được 1 default)
 * - item mặc định không được đang tắt
 *
 * Gọi ở MỌI đường ghi (create + update), của cả option-template lẫn product.
 */
export function assertOptionGroupValid(
  minSelect: number | null | undefined,
  maxSelect: number | null | undefined,
  items: OptionItemLike[],
  context = 'Nhóm tuỳ chọn',
): void {
  const min = minSelect ?? 0;
  const max = maxSelect ?? null;

  if (max != null && min > max) {
    throw new BadRequestException(
      `${context}: số lượng tối thiểu không được lớn hơn số lượng tối đa`,
    );
  }

  if (min > items.length) {
    throw new BadRequestException(
      `${context}: số lượng tối thiểu (${min}) vượt quá số item hiện có (${items.length})`,
    );
  }

  const defaults = items.filter((i) => i.isDefault);

  if (max != null && defaults.length > max) {
    throw new BadRequestException(
      `${context}: số item mặc định (${defaults.length}) vượt quá số lượng tối đa (${max})`,
    );
  }

  if (defaults.some((i) => i.status === false)) {
    throw new BadRequestException(
      `${context}: không thể đặt mặc định cho item đang tắt`,
    );
  }
}
