import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';

// $transaction mock = gọi thẳng callback với chính prismaMock làm tx
const makePrismaMock = () => {
  const prisma: any = {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    category: { findFirst: jest.fn() },
    brand: { findUnique: jest.fn() },
    productVariant: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    productOptionGroup: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    productOptionItem: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    productAttribute: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    productAttributeValue: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn((cb: (tx: any) => any) => cb(prisma));
  return prisma;
};

const productRow = (over: Partial<any> = {}) => ({
  id: 'prod-1',
  name: 'Trà sữa',
  slug: 'tra-sua',
  sku: 'PRD-1',
  type: 'SIMPLE',
  price: 30000,
  compareAtPrice: null,
  saleStartAt: null,
  saleEndAt: null,
  weight: null,
  isDeleted: false,
  deletedAt: null,
  categoryId: 'cat-1',
  brandId: null,
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  productLabels: [],
  productOptionGroups: [],
  productAttributes: [],
  productVariants: [],
  ...over,
});

const simpleDto = (over: Partial<any> = {}): any => ({
  name: 'Trà sữa',
  price: 30000,
  categoryId: 'cat-1',
  ...over,
});

describe('ProductService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ProductService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ProductService(prisma);
    // mặc định: không trùng slug/sku, category tồn tại
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-1' });
    prisma.product.create.mockResolvedValue(
      productRow({ productAttributes: [] }),
    );
    prisma.product.findUniqueOrThrow.mockResolvedValue(productRow());
  });

  // ===================== CREATE =====================
  describe('create — validate đầu vào', () => {
    it('tự sinh slug từ name + tự sinh SKU khi FE bỏ trống', async () => {
      await service.create(simpleDto({ name: 'Trà Sữa Đài Loan' }));

      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data.slug).toBe('tra-sua-dai-loan');
      expect(data.sku).toMatch(/^PRD-/); // generateSku('PRD')
      expect(data.type).toBe('SIMPLE'); // mặc định khi không gửi type
    });

    it('SKU trùng → BadRequest "Mã SKU đã tồn tại"', async () => {
      prisma.product.findFirst.mockResolvedValue(
        productRow({ sku: 'PRD-TRUNG', slug: 'khac' }),
      );
      await expect(
        service.create(simpleDto({ sku: 'PRD-TRUNG' })),
      ).rejects.toThrow('Mã SKU đã tồn tại');
    });

    it('slug trùng → BadRequest "Slug đã tồn tại"', async () => {
      prisma.product.findFirst.mockResolvedValue(
        productRow({ sku: 'khac', slug: 'tra-sua' }),
      );
      await expect(service.create(simpleDto())).rejects.toThrow(
        'Slug đã tồn tại',
      );
    });

    it('category không tồn tại / đã xoá → BadRequest', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.create(simpleDto())).rejects.toThrow(
        /Danh mục không tồn tại/,
      );
    });

    it('brandId gửi lên nhưng brand không tồn tại → BadRequest', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);
      await expect(
        service.create(simpleDto({ brandId: 'brand-x' })),
      ).rejects.toThrow(/Thương hiệu không tồn tại/);
    });

    it('ngày bắt đầu sale > ngày kết thúc → BadRequest', async () => {
      await expect(
        service.create(
          simpleDto({
            saleStartAt: '2026-09-01T00:00:00Z',
            saleEndAt: '2026-08-01T00:00:00Z',
          }),
        ),
      ).rejects.toThrow(/Ngày bắt đầu giảm giá/);
    });
  });

  describe('create — invariant theo ProductType', () => {
    it('SIMPLE mà kèm option groups → BadRequest', async () => {
      await expect(
        service.create(
          simpleDto({
            type: 'SIMPLE',
            productOptionGroups: [{ name: 'Topping', productOptionItems: [] }],
          }),
        ),
      ).rejects.toThrow(/Sản phẩm đơn \(SIMPLE\)/);
    });

    it('OPTION mà không có nhóm nào → BadRequest', async () => {
      await expect(
        service.create(simpleDto({ type: 'OPTION' })),
      ).rejects.toThrow(/phải có ít nhất 1 nhóm tùy chọn/);
    });

    it('OPTION mà kèm variant → BadRequest', async () => {
      await expect(
        service.create(
          simpleDto({
            type: 'OPTION',
            productOptionGroups: [{ name: 'T', productOptionItems: [] }],
            productVariants: [{ sku: 'V1', price: 1 }],
          }),
        ),
      ).rejects.toThrow(/OPTION không được chứa biến thể/);
    });

    it('VARIANT thiếu attribute → BadRequest', async () => {
      await expect(
        service.create(
          simpleDto({
            type: 'VARIANT',
            productVariants: [{ sku: 'V1', price: 1 }],
          }),
        ),
      ).rejects.toThrow(/phải có ít nhất 1 thuộc tính/);
    });

    it('VARIANT thiếu variant → BadRequest', async () => {
      await expect(
        service.create(
          simpleDto({
            type: 'VARIANT',
            productAttributes: [{ name: 'Màu', values: [{ value: 'Đỏ' }] }],
          }),
        ),
      ).rejects.toThrow(/phải có ít nhất 1 biến thể/);
    });

    it('VARIANT mà kèm option group → BadRequest', async () => {
      await expect(
        service.create(
          simpleDto({
            type: 'VARIANT',
            productOptionGroups: [{ name: 'T', productOptionItems: [] }],
            productAttributes: [{ name: 'Màu', values: [{ value: 'Đỏ' }] }],
            productVariants: [{ sku: 'V1', price: 1 }],
          }),
        ),
      ).rejects.toThrow(/VARIANT không được chứa nhóm option/);
    });
  });

  describe('create — nhóm option (gọi assertOptionGroupValid)', () => {
    it('minSelect > maxSelect → BadRequest kèm tên nhóm', async () => {
      await expect(
        service.create(
          simpleDto({
            type: 'OPTION',
            productOptionGroups: [
              {
                name: 'Topping',
                minSelect: 3,
                maxSelect: 1,
                productOptionItems: [
                  { name: 'A' },
                  { name: 'B' },
                  { name: 'C' },
                ],
              },
            ],
          }),
        ),
      ).rejects.toThrow(/Nhóm tuỳ chọn 'Topping'/);
    });

    it('OPTION hợp lệ → nested create groups + items', async () => {
      await service.create(
        simpleDto({
          type: 'OPTION',
          productOptionGroups: [
            {
              name: 'Topping',
              minSelect: 1,
              maxSelect: 2,
              productOptionItems: [
                { name: 'Trân châu', extraPrice: 7000 },
                { name: 'Xoài', extraPrice: 5000 },
              ],
            },
          ],
        }),
      );

      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data.productOptionGroups.create[0].name).toBe('Topping');
      expect(
        data.productOptionGroups.create[0].productOptionItems.create,
      ).toHaveLength(2);
    });
  });

  describe('create — VARIANT', () => {
    const variantDto = (over: Partial<any> = {}) =>
      simpleDto({
        type: 'VARIANT',
        productAttributes: [
          { name: 'Màu', values: [{ value: 'Đỏ' }, { value: 'Xanh' }] },
        ],
        productVariants: [
          {
            sku: 'V-DO',
            price: 100,
            attributeSelections: [{ attributeName: 'Màu', value: 'Đỏ' }],
          },
        ],
        ...over,
      });

    beforeEach(() => {
      prisma.product.create.mockResolvedValue(
        productRow({
          productAttributes: [
            {
              name: 'Màu',
              productAttributeValues: [
                { id: 'val-do', value: 'Đỏ' },
                { id: 'val-xanh', value: 'Xanh' },
              ],
            },
          ],
        }),
      );
      prisma.productVariant.findFirst.mockResolvedValue(null);
    });

    it('SKU giữa các variant gửi lên bị trùng → BadRequest', async () => {
      await expect(
        service.create(
          variantDto({
            productVariants: [
              { sku: 'V-TRUNG', price: 1 },
              { sku: 'V-TRUNG', price: 2 },
            ],
          }),
        ),
      ).rejects.toThrow(/SKU giữa các biến thể bị trùng/);
    });

    it('SKU variant đã tồn tại trong DB → BadRequest', async () => {
      prisma.productVariant.findFirst.mockResolvedValue({ sku: 'V-DO' });
      await expect(service.create(variantDto())).rejects.toThrow(
        /đã tồn tại trong hệ thống/,
      );
    });

    it('map attributeSelections (tên:giá trị) → id value khi tạo variant', async () => {
      await service.create(variantDto());

      const arg = prisma.productVariant.create.mock.calls[0][0];
      expect(arg.data.sku).toBe('V-DO');
      expect(arg.data.productVariantAttributeValues.create).toEqual([
        { productAttributeValueId: 'val-do' },
      ]);
    });

    it('attributeSelections trỏ giá trị không tồn tại → BadRequest', async () => {
      await expect(
        service.create(
          variantDto({
            productVariants: [
              {
                sku: 'V-TIM',
                price: 1,
                attributeSelections: [{ attributeName: 'Màu', value: 'Tím' }],
              },
            ],
          }),
        ),
      ).rejects.toThrow(/Không tìm thấy giá trị thuộc tính/);
    });
  });

  // ===================== FIND =====================
  describe('findOne', () => {
    it('không tồn tại hoặc đã xoá → NotFound', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
    });

    it('tính isOnSale + discountPercent khi đang trong khung giảm giá', async () => {
      const past = new Date(Date.now() - 86400000);
      const future = new Date(Date.now() + 86400000);
      prisma.product.findUnique.mockResolvedValue(
        productRow({
          price: 80000,
          compareAtPrice: 100000,
          saleStartAt: past,
          saleEndAt: future,
        }),
      );

      const result: any = await service.findOne('prod-1');
      expect(result.isOnSale).toBe(true);
      expect(result.discountPercent).toBe(20);
    });

    it('KHÔNG on sale khi khung thời gian đã qua', async () => {
      prisma.product.findUnique.mockResolvedValue(
        productRow({
          price: 80000,
          compareAtPrice: 100000,
          saleStartAt: new Date('2020-01-01'),
          saleEndAt: new Date('2020-02-01'),
        }),
      );

      const result: any = await service.findOne('prod-1');
      expect(result.isOnSale).toBe(false);
      expect(result.discountPercent).toBeNull();
    });
  });

  describe('findAll', () => {
    it('luôn lọc isDeleted: false + phân trang', async () => {
      prisma.product.findMany.mockResolvedValue([productRow()]);
      prisma.product.count.mockResolvedValue(1);

      await service.findAll({ pageIndex: 1, pageLimit: 10 } as any);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isDeleted: false }),
        }),
      );
    });
  });

  // ===================== UPDATE =====================
  describe('update — an toàn khi đổi type', () => {
    it('VARIANT còn biến thể mà đổi sang SIMPLE → chặn (chống mất dữ liệu)', async () => {
      prisma.product.findUnique.mockResolvedValue(
        productRow({
          type: 'VARIANT',
          productVariants: [{ id: 'v1', sku: 'V1' }],
          productAttributes: [{ id: 'a1', productAttributeValues: [] }],
        }),
      );

      await expect(
        service.update({ id: 'prod-1', type: 'SIMPLE' } as any),
      ).rejects.toThrow(/chưa gỡ bỏ hết biến thể cũ/);
    });

    it('OPTION còn nhóm tuỳ chọn mà đổi sang SIMPLE → chặn', async () => {
      prisma.product.findUnique.mockResolvedValue(
        productRow({
          type: 'OPTION',
          productOptionGroups: [{ id: 'g1', productOptionItems: [] }],
        }),
      );

      await expect(
        service.update({ id: 'prod-1', type: 'SIMPLE' } as any),
      ).rejects.toThrow(/chưa gỡ bỏ hết các tùy chọn cũ/);
    });

    it('không tìm thấy sản phẩm → NotFound', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.update({ id: 'x' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('slug mới trùng sản phẩm khác → BadRequest', async () => {
      prisma.product.findUnique.mockResolvedValue(productRow());
      prisma.product.findFirst.mockResolvedValue(productRow({ id: 'prod-2' }));

      await expect(
        service.update({ id: 'prod-1', slug: 'trung-slug' } as any),
      ).rejects.toThrow('Slug đã tồn tại');
    });
  });

  describe('update — smart sync option (giữ id ổn định cho giỏ hàng)', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue(
        productRow({
          type: 'OPTION',
          productOptionGroups: [
            {
              id: 'g1',
              name: 'Topping',
              minSelect: 0,
              maxSelect: 2,
              productOptionItems: [
                { id: 'i1', name: 'Trân châu', status: true, isDefault: false },
                { id: 'i2', name: 'Xoài', status: true, isDefault: false },
              ],
            },
          ],
        }),
      );
      prisma.product.findUniqueOrThrow.mockResolvedValue(
        productRow({ type: 'OPTION' }),
      );
    });

    it('item có id → UPDATE (giữ id), item không id → CREATE mới', async () => {
      await service.update({
        id: 'prod-1',
        type: 'OPTION',
        productOptionGroups: [
          {
            id: 'g1',
            name: 'Topping',
            productOptionItems: [
              { id: 'i1', name: 'Trân châu' }, // giữ nguyên id
              { id: 'i2', name: 'Xoài' },
              { name: 'Thạch' }, // thêm mới
            ],
          },
        ],
      } as any);

      expect(prisma.productOptionItem.update).toHaveBeenCalledTimes(2);
      expect(prisma.productOptionItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Thạch',
          productOptionGroupId: 'g1',
        }),
      });
      // KHÔNG xoá sạch rồi tạo lại → id cũ sống sót, giỏ hàng không mồ côi
      expect(prisma.productOptionItem.deleteMany).not.toHaveBeenCalled();
    });

    it('item cũ vắng mặt trong payload → bị xoá', async () => {
      await service.update({
        id: 'prod-1',
        type: 'OPTION',
        productOptionGroups: [
          {
            id: 'g1',
            name: 'Topping',
            productOptionItems: [{ id: 'i1', name: 'Trân châu' }],
          },
        ],
      } as any);

      expect(prisma.productOptionItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['i2'] } },
      });
    });

    it('gửi id group KHÔNG thuộc sản phẩm này → BadRequest (ownership)', async () => {
      await expect(
        service.update({
          id: 'prod-1',
          type: 'OPTION',
          productOptionGroups: [{ id: 'g-cua-sp-khac', name: 'X' }],
        } as any),
      ).rejects.toThrow(/Nhóm tuỳ chọn không tồn tại/);
    });

    it('gửi id item KHÔNG thuộc nhóm → BadRequest (ownership)', async () => {
      await expect(
        service.update({
          id: 'prod-1',
          type: 'OPTION',
          productOptionGroups: [
            {
              id: 'g1',
              name: 'Topping',
              productOptionItems: [{ id: 'i-cua-nhom-khac', name: 'X' }],
            },
          ],
        } as any),
      ).rejects.toThrow(/Tuỳ chọn không thuộc nhóm này/);
    });

    it('invariant tính trên TRẠNG THÁI SAU update (field không gửi giữ giá trị cũ)', async () => {
      // group hiện tại maxSelect=2; gửi minSelect=5 với 2 item → min > max
      await expect(
        service.update({
          id: 'prod-1',
          type: 'OPTION',
          productOptionGroups: [{ id: 'g1', minSelect: 5 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===================== DELETE =====================
  describe('delete — soft delete giải phóng unique', () => {
    it('đổi CẢ slug LẪN sku của product, và sku của từng variant', async () => {
      prisma.product.findUnique.mockResolvedValue(
        productRow({
          slug: 'tra-sua',
          sku: 'PRD-1',
          productVariants: [
            { id: 'v1', sku: 'V-1', productVariantAttributeValues: [] },
            { id: 'v2', sku: 'V-2', productVariantAttributeValues: [] },
          ],
        }),
      );
      prisma.product.update.mockResolvedValue(productRow({ isDeleted: true }));

      await service.delete('prod-1');

      // variant: soft delete + đổi sku
      expect(prisma.productVariant.update).toHaveBeenCalledTimes(2);
      const vArg = prisma.productVariant.update.mock.calls[0][0];
      expect(vArg.data.isDeleted).toBe(true);
      expect(vArg.data.sku).toMatch(/^deleted-\d+-V-1$/);

      // product: đổi cả slug lẫn sku
      const pArg = prisma.product.update.mock.calls[0][0];
      expect(pArg.data.isDeleted).toBe(true);
      expect(pArg.data.slug).toMatch(/^deleted-\d+-tra-sua$/);
      expect(pArg.data.sku).toMatch(/^deleted-\d+-PRD-1$/);
    });

    it('sản phẩm không tồn tại → NotFound (không xoá gì)', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.delete('x')).rejects.toThrow(NotFoundException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });
});
