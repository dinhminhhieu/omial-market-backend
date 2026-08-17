import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { OrderServiceService } from './order-service.service';
import { OrderStatus } from '@app/event-contracts';

// ===== Mocks =====
const makePrismaMock = () => {
  const prisma: any = {
    order: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    orderStatusHistory: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((cb: (tx: any) => any) => cb(prisma));
  return prisma;
};

// Sản phẩm OPTION mẫu: trà sữa 30k + nhóm Topping (minSelect 1, maxSelect 2)
const optionProduct = (over: Partial<any> = {}) => ({
  id: 'prod-1',
  name: 'Trà sữa',
  sku: 'SKU-TS',
  price: 30000,
  status: true,
  type: 'OPTION',
  thumbnail: null,
  images: [],
  productVariants: [],
  productOptionGroups: [
    {
      id: 'g1',
      name: 'Topping',
      minSelect: 1,
      maxSelect: 2,
      productOptionItems: [
        { id: 'opt-tc', name: 'Trân châu', extraPrice: 7000, status: true },
        { id: 'opt-xoai', name: 'Xoài', extraPrice: 5000, status: true },
        {
          id: 'opt-off',
          name: 'Pudding (hết)',
          extraPrice: 5000,
          status: false,
        },
      ],
    },
  ],
  ...over,
});

const variantProduct = () => ({
  id: 'prod-2',
  name: 'Áo thun',
  sku: 'SKU-AO',
  price: 100000,
  status: true,
  type: 'VARIANT',
  thumbnail: null,
  images: [],
  productOptionGroups: [],
  productVariants: [
    {
      id: 'var-do-s',
      sku: 'SKU-AO-DO-S',
      price: 150000,
      status: true,
      imageUrl: null,
      attributeValues: [{ value: 'Đỏ' }, { value: 'S' }],
    },
  ],
});

// Row Order đầy đủ relations như Prisma trả về (toResponse cần Date thật)
const orderRow = (over: Partial<any> = {}) => ({
  id: 'order-1',
  code: 'ORD-260812-TEST',
  status: 'PENDING',
  customerId: null,
  customerName: 'Khách test',
  customerPhone: '0912345678',
  customerEmail: null,
  shippingAddress: null,
  note: null,
  subtotal: 74000,
  shippingFee: 0,
  discountAmount: 0,
  total: 74000,
  paymentMethod: 'COD',
  createdAt: new Date('2026-08-12'),
  updatedAt: new Date('2026-08-12'),
  orderItems: [
    {
      id: 'item-1',
      productId: 'prod-1',
      variantId: null,
      sku: 'SKU-TS',
      productName: 'Trà sữa',
      variantName: null,
      imageUrl: null,
      unitPrice: 37000,
      quantity: 2,
      lineTotal: 74000,
      isGift: false,
      orderItemOptions: [
        {
          id: 'oio-1',
          optionItemId: 'opt-tc',
          groupName: 'Topping',
          itemName: 'Trân châu',
          extraPrice: 7000,
        },
      ],
    },
  ],
  orderStatusHistory: [
    {
      fromStatus: null,
      toStatus: 'PENDING',
      note: 'Khởi tạo đơn hàng',
      createdAt: new Date('2026-08-12'),
    },
  ],
  ...over,
});

const baseCreateDto = (over: Partial<any> = {}): any => ({
  customerName: 'Khách test',
  customerPhone: '0912345678',
  items: [{ productId: 'prod-1', quantity: 2, optionItemIds: ['opt-tc'] }],
  ...over,
});

describe('OrderServiceService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let productClient: { send: jest.Mock };
  let inventoryClient: { send: jest.Mock };
  let service: OrderServiceService;

  beforeEach(() => {
    prisma = makePrismaMock();
    productClient = { send: jest.fn() };
    inventoryClient = { send: jest.fn() };
    service = new OrderServiceService(
      prisma,
      productClient as any,
      inventoryClient as any,
    );
    // mặc định: product OK, kho không theo dõi (mảng rỗng = cho qua)
    productClient.send.mockReturnValue(of(optionProduct()));
    inventoryClient.send.mockReturnValue(of([]));
    prisma.order.create.mockResolvedValue(orderRow());
  });

  // ================= MÁY TRẠNG THÁI =================
  describe('updateStatus — máy trạng thái', () => {
    it('đơn không tồn tại → NotFound', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus({ id: 'x', toStatus: OrderStatus.CONFIRMED }),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([
      ['PENDING', OrderStatus.COMPLETED], // nhảy cóc
      ['PENDING', OrderStatus.SHIPPING], // nhảy cóc
      ['COMPLETED', OrderStatus.CANCELLED], // terminal
      ['CANCELLED', OrderStatus.CONFIRMED], // terminal
      ['SHIPPING', OrderStatus.PENDING], // đi lùi
    ])(
      'chặn transition không hợp lệ %s → %s, KHÔNG ghi DB',
      async (from, to) => {
        prisma.order.findUnique.mockResolvedValue(orderRow({ status: from }));

        await expect(
          service.updateStatus({ id: 'order-1', toStatus: to }),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.order.update).not.toHaveBeenCalled();
        expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      },
    );

    it('PENDING → CONFIRMED: đổi status + ghi history (from/to/note) cùng transaction', async () => {
      prisma.order.findUnique.mockResolvedValue(
        orderRow({ status: 'PENDING' }),
      );
      prisma.order.update.mockResolvedValue({});
      prisma.orderStatusHistory.create.mockResolvedValue({});
      prisma.order.findUniqueOrThrow.mockResolvedValue(
        orderRow({ status: 'CONFIRMED' }),
      );

      const result = await service.updateStatus({
        id: 'order-1',
        toStatus: OrderStatus.CONFIRMED,
        note: 'shop xác nhận',
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'CONFIRMED' },
      });
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          note: 'shop xác nhận',
        },
      });
      expect(result.status).toBe('CONFIRMED');
    });

    it('SHIPPING → CANCELLED (giao thất bại) là transition hợp lệ', async () => {
      prisma.order.findUnique.mockResolvedValue(
        orderRow({ status: 'SHIPPING' }),
      );
      prisma.order.update.mockResolvedValue({});
      prisma.orderStatusHistory.create.mockResolvedValue({});
      prisma.order.findUniqueOrThrow.mockResolvedValue(
        orderRow({ status: 'CANCELLED' }),
      );

      await expect(
        service.updateStatus({
          id: 'order-1',
          toStatus: OrderStatus.CANCELLED,
          note: 'giao thất bại 2 lần',
        }),
      ).resolves.toBeDefined();
    });
  });

  // ================= CHECKOUT (create) =================
  describe('create — giá server-side', () => {
    it('KHÔNG tin giá FE: unitPrice = giá product + extraPrice option, nhân số lượng', async () => {
      await service.create(baseCreateDto());

      const createArg = prisma.order.create.mock.calls[0][0];
      const line = createArg.data.orderItems.create[0];
      expect(line.unitPrice).toBe(37000); // 30k + 7k trân châu
      expect(line.lineTotal).toBe(74000); // × 2
      expect(createArg.data.subtotal).toBe(74000);
      expect(createArg.data.total).toBe(74000);
      // Snapshot: tên topping đóng băng vào đơn
      expect(line.orderItemOptions.create[0]).toEqual(
        expect.objectContaining({ itemName: 'Trân châu', extraPrice: 7000 }),
      );
    });

    it('đơn rỗng → BadRequest', async () => {
      await expect(
        service.create(baseCreateDto({ items: [] })),
      ).rejects.toThrow(/ít nhất 1 sản phẩm/);
    });

    it('product-service báo lỗi/không có sản phẩm → NotFound', async () => {
      productClient.send.mockReturnValue(
        throwError(() => new Error('rmq down')),
      );
      await expect(service.create(baseCreateDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sản phẩm ngừng kinh doanh (status=false) → BadRequest', async () => {
      productClient.send.mockReturnValue(of(optionProduct({ status: false })));
      await expect(service.create(baseCreateDto())).rejects.toThrow(
        /ngừng kinh doanh/,
      );
    });
  });

  describe('create — validate option', () => {
    it('group minSelect=1 mà không chọn gì → BadRequest, KHÔNG tạo đơn', async () => {
      await expect(
        service.create(
          baseCreateDto({ items: [{ productId: 'prod-1', quantity: 1 }] }),
        ),
      ).rejects.toThrow(/ít nhất 1 tùy chọn/);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('optionItemId lạ (không thuộc sản phẩm) → BadRequest', async () => {
      await expect(
        service.create(
          baseCreateDto({
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
                optionItemIds: ['opt-cua-sp-khac'],
              },
            ],
          }),
        ),
      ).rejects.toThrow(/không hợp lệ/);
    });

    it('option đang tắt (status=false, "tạm hết topping") bị coi như không tồn tại', async () => {
      await expect(
        service.create(
          baseCreateDto({
            items: [
              { productId: 'prod-1', quantity: 1, optionItemIds: ['opt-off'] },
            ],
          }),
        ),
      ).rejects.toThrow(/không hợp lệ/);
    });

    it('chọn vượt maxSelect → BadRequest', async () => {
      // group maxSelect=2, chọn 3 — nhưng chỉ có 2 item đang bật → dùng product 3 item bật
      const p = optionProduct();
      p.productOptionGroups[0].productOptionItems.push({
        id: 'opt-4',
        name: 'Thạch',
        extraPrice: 3000,
        status: true,
      });
      productClient.send.mockReturnValue(of(p));

      await expect(
        service.create(
          baseCreateDto({
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
                optionItemIds: ['opt-tc', 'opt-xoai', 'opt-4'],
              },
            ],
          }),
        ),
      ).rejects.toThrow(/tối đa 2/);
    });
  });

  describe('create — variant', () => {
    it('sản phẩm VARIANT mà không gửi variantId → BadRequest', async () => {
      productClient.send.mockReturnValue(of(variantProduct()));
      await expect(
        service.create(
          baseCreateDto({ items: [{ productId: 'prod-2', quantity: 1 }] }),
        ),
      ).rejects.toThrow(/yêu cầu chọn biến thể/);
    });

    it('lấy giá + sku + tên thuộc tính từ VARIANT (không phải product cha)', async () => {
      productClient.send.mockReturnValue(of(variantProduct()));

      await service.create(
        baseCreateDto({
          items: [{ productId: 'prod-2', variantId: 'var-do-s', quantity: 1 }],
        }),
      );

      const line =
        prisma.order.create.mock.calls[0][0].data.orderItems.create[0];
      expect(line.unitPrice).toBe(150000); // giá variant, không phải 100k
      expect(line.sku).toBe('SKU-AO-DO-S');
      expect(line.variantName).toBe('Đỏ / S');
    });
  });

  describe('create — tồn kho', () => {
    it('kho theo dõi + không đủ available → BadRequest kèm số liệu', async () => {
      inventoryClient.send.mockReturnValue(
        of([
          {
            refType: 'PRODUCT',
            refId: 'prod-1',
            available: 1,
            onHand: 1,
            reserved: 0,
          },
        ]),
      );

      await expect(service.create(baseCreateDto())).rejects.toThrow(
        /không đủ tồn kho khả dụng \(còn 1, yêu cầu 2\)/,
      );
    });

    it('kho KHÔNG theo dõi (không có StockItem) → cho qua', async () => {
      inventoryClient.send.mockReturnValue(of([]));
      await expect(service.create(baseCreateDto())).resolves.toBeDefined();
    });

    it('inventory-service sập → degrade êm, đơn vẫn tạo được (Phase 0)', async () => {
      inventoryClient.send.mockReturnValue(throwError(() => new Error('down')));
      await expect(service.create(baseCreateDto())).resolves.toBeDefined();
    });
  });

  describe('create — sinh mã đơn', () => {
    it('trùng code (P2002) → retry với code mới, tối đa 5 lần', async () => {
      prisma.order.create
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce(orderRow());

      const result = await service.create(baseCreateDto());

      expect(prisma.order.create).toHaveBeenCalledTimes(2);
      expect(result.code).toBe('ORD-260812-TEST');
    });

    it('lỗi khác P2002 thì ném ra luôn, không retry', async () => {
      prisma.order.create.mockRejectedValue(new Error('DB die'));
      await expect(service.create(baseCreateDto())).rejects.toThrow('DB die');
      expect(prisma.order.create).toHaveBeenCalledTimes(1);
    });
  });
});
