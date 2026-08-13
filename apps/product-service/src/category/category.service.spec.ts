import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoryService } from './category.service';

const makePrismaMock = () => ({
  category: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  product: { count: jest.fn() },
});

const categoryRow = (over: Partial<any> = {}) => ({
  id: 'cat-A',
  name: 'Đồ uống',
  slug: 'do-uong',
  imageUrl: null,
  status: true,
  priority: 0,
  description: null,
  isDeleted: false,
  deletedAt: null,
  parentId: null,
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  children: [],
  ...over,
});

describe('CategoryService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: CategoryService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new CategoryService(prisma as any);
  });

  describe('create', () => {
    it('tự sinh slug từ name khi FE bỏ trống', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue(categoryRow());

      await service.create({ name: 'Trà Sữa Đài Loan' } as any);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'tra-sua-dai-loan' }),
      });
    });

    it('slug đã tồn tại → BadRequest', async () => {
      prisma.category.findUnique.mockResolvedValue(categoryRow());
      await expect(
        service.create({ name: 'Đồ uống' } as any),
      ).rejects.toThrow(/đã tồn tại/);
    });
  });

  describe('findOne', () => {
    it('không tồn tại hoặc đã xoá → NotFound', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update — chống vòng lặp cây (ensureNoCycle)', () => {
    it('chọn CHÍNH NÓ làm cha → BadRequest', async () => {
      // findOne trong update
      prisma.category.findUnique.mockResolvedValue(categoryRow({ id: 'cat-A' }));

      await expect(
        service.update({ id: 'cat-A', parentId: 'cat-A' } as any),
      ).rejects.toThrow(/chính nó hoặc con\/cháu/);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('chọn CHÁU làm cha (A ← B ← C, gắn C làm cha A) → BadRequest', async () => {
      // Cây: C.parentId = B, B.parentId = A. Gắn parentId của A = C → vòng.
      prisma.category.findUnique.mockImplementation((args: any) => {
        // findOne(id) của update — có isDeleted trong where
        if (args.where.id === 'cat-A' && args.where.isDeleted === false) {
          return Promise.resolve(categoryRow({ id: 'cat-A' }));
        }
        // ensureNoCycle walk lên tổ tiên: C → B → A
        if (args.where.id === 'cat-C') return Promise.resolve({ parentId: 'cat-B' });
        if (args.where.id === 'cat-B') return Promise.resolve({ parentId: 'cat-A' });
        return Promise.resolve(null);
      });

      await expect(
        service.update({ id: 'cat-A', parentId: 'cat-C' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('gắn cha hợp lệ (không cùng nhánh) → update chạy, id bị tách khỏi data', async () => {
      prisma.category.findUnique.mockImplementation((args: any) => {
        if (args.where.id === 'cat-A' && args.where.isDeleted === false) {
          return Promise.resolve(categoryRow({ id: 'cat-A' }));
        }
        if (args.where.id === 'cat-X') return Promise.resolve({ parentId: null });
        return Promise.resolve(null);
      });
      prisma.category.update.mockResolvedValue(categoryRow({ parentId: 'cat-X' }));

      await service.update({ id: 'cat-A', parentId: 'cat-X' } as any);

      const arg = prisma.category.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'cat-A' });
      expect(arg.data.id).toBeUndefined(); // destructure { id, ...data }
      expect(arg.data.parentId).toBe('cat-X');
    });
  });

  describe('delete — soft delete có điều kiện', () => {
    beforeEach(() => {
      prisma.category.findUnique.mockResolvedValue(categoryRow());
    });

    it('còn danh mục con → BadRequest, không xoá', async () => {
      prisma.category.count.mockResolvedValue(2); // 2 con còn sống
      prisma.product.count.mockResolvedValue(0);

      await expect(service.delete('cat-A')).rejects.toThrow(/danh mục con/);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('còn sản phẩm → BadRequest, không xoá', async () => {
      prisma.category.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(3);

      await expect(service.delete('cat-A')).rejects.toThrow(/còn sản phẩm/);
    });

    it('xoá = UPDATE isDeleted + đổi slug để giải phóng @unique', async () => {
      prisma.category.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.category.update.mockResolvedValue(categoryRow({ isDeleted: true }));

      await service.delete('cat-A');

      const arg = prisma.category.update.mock.calls[0][0];
      expect(arg.data.isDeleted).toBe(true);
      expect(arg.data.slug).toMatch(/^deleted-do-uong-/); // slug cũ được giải phóng
      expect(arg.data.deletedAt).toBeInstanceOf(Date);
    });
  });
});
