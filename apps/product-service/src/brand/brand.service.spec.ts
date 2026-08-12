import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaginationQueryDto } from '@app/shared';

// PrismaService thực tế extends PrismaClient (Prisma 7 dùng ESM `import.meta`),
// Jest CommonJS không parse được. Ta mock nguyên module trước khi bất kỳ file
// nào import PrismaService — jest.mock được hoist lên đầu tự động.
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import { PrismaService } from '../prisma/prisma.service';
import { BrandService } from './brand.service';

// Kiểu mock cho các method Prisma mà BrandService dùng. Chỉ khai báo đúng những
// gì cần — không mock cả PrismaClient để tránh boilerplate vô ích.
type PrismaBrandMock = {
  brand: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

const createPrismaMock = (): PrismaBrandMock => ({
  brand: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

// Fixture — bản ghi brand mẫu, dùng lại cho nhiều test case để tránh lặp.
const brandFixture = {
  id: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
  name: 'Omial',
  logo: 'https://cdn.omial.dev/brands/omial.png',
  description: 'Thương hiệu nội thất cao cấp.',
  createdAt: new Date('2026-07-29T00:00:00.000Z'),
  updatedAt: new Date('2026-07-29T00:00:00.000Z'),
};

describe('BrandService', () => {
  let service: BrandService;
  let prisma: PrismaBrandMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    // Test.createTestingModule cho phép override PrismaService bằng mock — nhờ
    // vậy service chạy hoàn toàn cô lập, không đụng DB thật.
    const module: TestingModule = await Test.createTestingModule({
      providers: [BrandService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BrandService>(BrandService);
  });

  // ─── create ──────────────────────────────────────────────────────────────
  describe('create', () => {
    it('lưu brand và trả về wrapper { data, message }', async () => {
      // Arrange
      const dto = { name: 'Omial', logo: brandFixture.logo };
      prisma.brand.create.mockResolvedValue(brandFixture);

      // Act
      const result = await service.create(dto);

      // Assert — kiểm tra Prisma được gọi đúng, và output có shape mong đợi.
      expect(prisma.brand.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual({
        data: brandFixture,
        message: 'Đã tạo thương hiệu mới thành công',
      });
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    // Helper build query DTO — cần dùng constructor để getters skip/take chạy.
    const buildQuery = (
      overrides: Partial<PaginationQueryDto> = {},
    ): PaginationQueryDto => Object.assign(new PaginationQueryDto(), overrides);

    it('trả items + meta với query mặc định (page 1, limit 10)', async () => {
      const query = buildQuery();
      prisma.brand.findMany.mockResolvedValue([brandFixture]);
      prisma.brand.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(prisma.brand.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.brand.count).toHaveBeenCalledWith({
        where: {},
      });
      expect(result).toEqual({
        items: [brandFixture],
        meta: {
          pageIndex: 1,
          pageLimit: 10,
          totalResults: 1,
          totalPage: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('thêm điều kiện name.contains khi có search', async () => {
      const query = buildQuery({ search: 'omi' });
      prisma.brand.findMany.mockResolvedValue([]);
      prisma.brand.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(prisma.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: { contains: 'omi', mode: 'insensitive' },
          },
        }),
      );
    });

    it('tính đúng skip/take khi ở trang 3, limit 5', async () => {
      const query = buildQuery({ pageIndex: 3, pageLimit: 5 });
      prisma.brand.findMany.mockResolvedValue([]);
      prisma.brand.count.mockResolvedValue(12);

      const result = await service.findAll(query);

      expect(prisma.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
      // 12 items / 5 = 3 pages, đang ở page 3 → hasNext=false, hasPrev=true.
      expect(result.meta).toEqual({
        pageIndex: 3,
        pageLimit: 5,
        totalResults: 12,
        totalPage: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('trả brand khi tồn tại', async () => {
      prisma.brand.findUnique.mockResolvedValue(brandFixture);

      const result = await service.findOne(brandFixture.id);

      expect(prisma.brand.findUnique).toHaveBeenCalledWith({
        where: { id: brandFixture.id },
      });
      expect(result).toBe(brandFixture);
    });

    it('throw NotFoundException khi id không tồn tại', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);

      // .rejects.toThrow là cách assert 1 Promise reject với error cụ thể.
      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('missing-id')).rejects.toThrow(
        'Không tìm thấy thương hiệu hoặc đã bị xoá',
      );
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────
  describe('update', () => {
    it('kiểm tra tồn tại trước, sau đó update', async () => {
      const dto = { id: brandFixture.id, name: 'Omial 2' };
      prisma.brand.findUnique.mockResolvedValue(brandFixture); // findOne pass
      prisma.brand.update.mockResolvedValue({
        ...brandFixture,
        name: 'Omial 2',
      });

      const result = await service.update(dto);

      // Thứ tự gọi quan trọng: findUnique phải chạy TRƯỚC update.
      const findOrder = prisma.brand.findUnique.mock.invocationCallOrder[0];
      const updateOrder = prisma.brand.update.mock.invocationCallOrder[0];
      expect(findOrder).toBeLessThan(updateOrder);

      expect(prisma.brand.update).toHaveBeenCalledWith({
        where: { id: brandFixture.id },
        data: dto,
      });
      expect(result.name).toBe('Omial 2');
    });

    it('throw NotFound khi id không tồn tại — KHÔNG gọi prisma.update', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);

      await expect(
        service.update({ id: 'missing-id', name: 'X' }),
      ).rejects.toThrow(NotFoundException);

      // Assert âm — chứng minh guard clause chặn được side-effect.
      expect(prisma.brand.update).not.toHaveBeenCalled();
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────
  describe('delete', () => {
    // Brand dùng HARD delete (xem docs/patterns/soft-delete.md): không ai tham
    // chiếu lịch sử tới brand, `Product.brandId` onDelete SetNull tự gỡ liên kết.
    it('hard-delete: gọi prisma.delete sau khi kiểm tra tồn tại', async () => {
      prisma.brand.findUnique.mockResolvedValue(brandFixture);
      prisma.brand.delete.mockResolvedValue(brandFixture);

      await service.delete(brandFixture.id);

      expect(prisma.brand.delete).toHaveBeenCalledWith({
        where: { id: brandFixture.id },
      });
    });

    it('throw NotFound khi id không tồn tại', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.brand.update).not.toHaveBeenCalled();
    });
  });
});
