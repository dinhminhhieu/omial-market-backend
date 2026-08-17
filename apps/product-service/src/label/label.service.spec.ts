import { NotFoundException } from '@nestjs/common';
import { LabelService } from './label.service';

const makePrismaMock = () => ({
  label: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

const labelRow = (over: Partial<any> = {}) => ({
  id: 'lbl-1',
  name: 'Hot',
  color: '#f00',
  status: true,
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  ...over,
});

describe('LabelService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: LabelService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new LabelService(prisma as any);
  });

  it('create trả kèm message', async () => {
    prisma.label.create.mockResolvedValue(labelRow());
    const result = await service.create({ name: 'Hot' } as any);
    expect(result.data.name).toBe('Hot');
    expect(result.message).toMatch(/thành công/);
  });

  it('findAll: search lọc theo name không phân biệt hoa thường', async () => {
    prisma.label.findMany.mockResolvedValue([labelRow()]);
    prisma.label.count.mockResolvedValue(1);

    await service.findAll({ pageIndex: 1, pageLimit: 10, search: 'ho' } as any);

    expect(prisma.label.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: 'ho', mode: 'insensitive' } },
      }),
    );
  });

  it('findOne không thấy → NotFound', async () => {
    prisma.label.findUnique.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
  });

  it('update kiểm tra tồn tại trước khi ghi', async () => {
    prisma.label.findUnique.mockResolvedValue(null);
    await expect(
      service.update({ id: 'x', name: 'New' } as any),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.label.update).not.toHaveBeenCalled();
  });

  it('delete = HARD delete (label không ai tham chiếu lịch sử)', async () => {
    prisma.label.findUnique.mockResolvedValue(labelRow());
    prisma.label.delete.mockResolvedValue(labelRow());

    await service.delete('lbl-1');

    expect(prisma.label.delete).toHaveBeenCalledWith({
      where: { id: 'lbl-1' },
    });
  });
});
