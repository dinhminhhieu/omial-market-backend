import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OptionTemplateService } from './option-template.service';

const makePrismaMock = () => ({
  optionTemplate: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

const templateRow = (over: Partial<any> = {}) => ({
  id: 'tpl-1',
  name: 'Topping trà sữa',
  minSelect: 0,
  maxSelect: 2,
  position: 0,
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  optionTemplateItems: [
    { id: 'i1', name: 'Trân châu', extraPrice: 7000, isDefault: false },
    { id: 'i2', name: 'Xoài', extraPrice: 5000, isDefault: false },
  ],
  ...over,
});

describe('OptionTemplateService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: OptionTemplateService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new OptionTemplateService(prisma as any);
  });

  describe('create', () => {
    it('tên mẫu đã tồn tại → BadRequest', async () => {
      prisma.optionTemplate.findUnique.mockResolvedValue(templateRow());
      await expect(
        service.create({
          name: 'Topping trà sữa',
          optionTemplateItems: [],
        } as any),
      ).rejects.toThrow(/đã tồn tại/);
    });

    it('gác invariant min/max (minSelect > số item) → BadRequest', async () => {
      prisma.optionTemplate.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          name: 'Mẫu mới',
          minSelect: 5,
          optionTemplateItems: [{ name: 'A' }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('hợp lệ → nested create items + Decimal→number trong response', async () => {
      prisma.optionTemplate.findUnique.mockResolvedValue(null);
      prisma.optionTemplate.create.mockResolvedValue(templateRow());

      const result = await service.create({
        name: 'Topping trà sữa',
        minSelect: 0,
        maxSelect: 2,
        optionTemplateItems: [{ name: 'Trân châu', extraPrice: 7000 }],
      } as any);

      expect(prisma.optionTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            optionTemplateItems: {
              create: [{ name: 'Trân châu', extraPrice: 7000 }],
            },
          }),
        }),
      );
      expect(typeof result.data.optionTemplateItems[0].extraPrice).toBe(
        'number',
      );
    });
  });

  describe('findOne', () => {
    it('không tồn tại → NotFound', async () => {
      prisma.optionTemplate.findUnique.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.optionTemplate.findUnique.mockResolvedValue(templateRow());
      prisma.optionTemplate.update.mockResolvedValue(templateRow());
    });

    it('đổi tên trùng mẫu khác → BadRequest', async () => {
      prisma.optionTemplate.findFirst.mockResolvedValue(
        templateRow({ id: 'tpl-2' }),
      );
      await expect(
        service.update({ id: 'tpl-1', name: 'Tên khác' } as any),
      ).rejects.toThrow(/Tên mẫu tùy chọn đã tồn tại/);
    });

    it('items = REPLACE-ALL (deleteMany + create), không nhận id item', async () => {
      prisma.optionTemplate.findFirst.mockResolvedValue(null);

      await service.update({
        id: 'tpl-1',
        optionTemplateItems: [{ name: 'Thạch', extraPrice: 3000 }],
      } as any);

      const data = prisma.optionTemplate.update.mock.calls[0][0].data;
      expect(data.optionTemplateItems).toEqual({
        deleteMany: {},
        create: [{ name: 'Thạch', extraPrice: 3000 }],
      });
    });

    it('KHÔNG gửi items → giữ nguyên items cũ (không đụng tới)', async () => {
      prisma.optionTemplate.findFirst.mockResolvedValue(null);

      await service.update({ id: 'tpl-1', position: 5 } as any);

      const data = prisma.optionTemplate.update.mock.calls[0][0].data;
      expect(data.optionTemplateItems).toBeUndefined();
    });

    it('invariant tính trên TRẠNG THÁI SAU update: minSelect mới vs items cũ', async () => {
      prisma.optionTemplate.findFirst.mockResolvedValue(null);
      // hiện có 2 item, gửi minSelect=5 mà không gửi items → phải chặn
      await expect(
        service.update({ id: 'tpl-1', minSelect: 5 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('invariant dùng items MỚI khi có gửi items', async () => {
      prisma.optionTemplate.findFirst.mockResolvedValue(null);
      // gửi 1 item + minSelect 2 → chặn (dù items cũ có 2)
      await expect(
        service.update({
          id: 'tpl-1',
          minSelect: 2,
          optionTemplateItems: [{ name: 'A' }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('HARD delete (không có ai tham chiếu tới mẫu)', async () => {
      prisma.optionTemplate.findUnique.mockResolvedValue(templateRow());
      prisma.optionTemplate.delete.mockResolvedValue(templateRow());

      await service.delete('tpl-1');

      expect(prisma.optionTemplate.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tpl-1' } }),
      );
    });

    it('không tồn tại → NotFound, không gọi delete', async () => {
      prisma.optionTemplate.findUnique.mockResolvedValue(null);
      await expect(service.delete('x')).rejects.toThrow(NotFoundException);
      expect(prisma.optionTemplate.delete).not.toHaveBeenCalled();
    });
  });
});
