import { BadRequestException } from '@nestjs/common';
import {
  assertOptionGroupValid,
  OptionItemLike,
} from './option-group.validator';

// Helper: sinh n item thường (không default, đang bật)
const items = (n: number): OptionItemLike[] =>
  Array.from({ length: n }, () => ({ isDefault: false, status: true }));

describe('assertOptionGroupValid', () => {
  it('cho qua khi min ≤ max ≤ số item, default hợp lệ', () => {
    const list = [{ isDefault: true, status: true }, ...items(2)];
    expect(() => assertOptionGroupValid(1, 2, list)).not.toThrow();
  });

  it('min/max null|undefined được coi là 0 / không giới hạn', () => {
    expect(() =>
      assertOptionGroupValid(null, undefined, items(2)),
    ).not.toThrow();
    expect(() => assertOptionGroupValid(undefined, null, [])).not.toThrow();
  });

  it('chặn minSelect > maxSelect', () => {
    expect(() => assertOptionGroupValid(3, 2, items(5))).toThrow(
      BadRequestException,
    );
    expect(() => assertOptionGroupValid(3, 2, items(5))).toThrow(
      /tối thiểu không được lớn hơn/,
    );
  });

  it('chặn minSelect vượt quá số item hiện có', () => {
    expect(() => assertOptionGroupValid(5, null, items(3))).toThrow(
      /vượt quá số item hiện có/,
    );
  });

  it('chặn số default vượt maxSelect (single-select chỉ 1 default)', () => {
    const twoDefaults = [
      { isDefault: true, status: true },
      { isDefault: true, status: true },
    ];
    expect(() => assertOptionGroupValid(0, 1, twoDefaults)).toThrow(
      /số item mặc định/,
    );
  });

  it('max = null (không giới hạn) thì bao nhiêu default cũng được', () => {
    const manyDefaults = Array.from({ length: 5 }, () => ({
      isDefault: true,
      status: true,
    }));
    expect(() => assertOptionGroupValid(0, null, manyDefaults)).not.toThrow();
  });

  it('chặn default trỏ vào item đang tắt', () => {
    const bad = [{ isDefault: true, status: false }];
    expect(() => assertOptionGroupValid(0, 1, bad)).toThrow(
      /mặc định cho item đang tắt/,
    );
  });

  it('item KHÔNG có field status (OptionTemplateItem) thì default vẫn hợp lệ', () => {
    const templateItems = [{ isDefault: true }];
    expect(() => assertOptionGroupValid(0, 1, templateItems)).not.toThrow();
  });

  it('gắn tên nhóm vào message lỗi (context)', () => {
    expect(() =>
      assertOptionGroupValid(3, 2, items(5), 'Nhóm "Topping"'),
    ).toThrow(/Nhóm "Topping"/);
  });
});
