/**
 * Chuẩn hoá input từ form FE: chuỗi rỗng / toàn khoảng trắng → undefined,
 * để `@IsOptional()` bỏ qua validate và service coi như "không gửi".
 * Chuỗi có nội dung thì trim luôn. Giá trị không phải string giữ nguyên.
 */
export function emptyToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
