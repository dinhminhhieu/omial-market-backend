export const OPTION_TEMPLATE_PATTERNS = {
  CREATE: 'option_template.create', // tạo mẫu KÈM items (nested)
  FIND_ALL: 'option_template.find_all',
  FIND_ONE: 'option_template.find_one',
  UPDATE: 'option_template.update', // sửa field mẫu + đồng bộ items (diff/sync)
  DELETE: 'option_template.delete', // xoá mẫu → items cascade theo
} as const;
