import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';
import { PrismaService } from './prisma/prisma.service';
import {
  CreateOrderDto,
  FindAllOrdersDto,
  INVENTORY_PATTERNS,
  OrderResponseDto,
  OrderStatus,
  PRODUCT_PATTERNS,
  ProductResponseDto,
  ProductType,
  StockItemResponseDto,
  StockRefType,
  UpdateOrderStatusDto,
} from '@app/event-contracts';
import { buildPaginationMeta, PaginationMetaDto } from '@app/shared';
import { INVENTORY_CLIENT, PRODUCT_CLIENT } from './clients';
import { OrderStatus as DbOrderStatus } from './generated/prisma/enums';
import {
  Order,
  OrderItem,
  OrderItemOption,
  OrderStatusHistory,
} from './generated/prisma/client';

type OrderWithRelations = Order & {
  orderItems: (OrderItem & { orderItemOptions: OrderItemOption[] })[];
  orderStatusHistory: OrderStatusHistory[];
};

@Injectable()
export class OrderServiceService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(PRODUCT_CLIENT) private readonly productClient: ClientProxy,
    @Inject(INVENTORY_CLIENT) private readonly inventoryClient: ClientProxy,
  ) {}

  private readonly TRANSITIONS: Record<DbOrderStatus, DbOrderStatus[]> = {
    [DbOrderStatus.PENDING]: [DbOrderStatus.CONFIRMED, DbOrderStatus.CANCELLED],
    [DbOrderStatus.CONFIRMED]: [
      DbOrderStatus.SHIPPING,
      DbOrderStatus.CANCELLED,
    ],
    [DbOrderStatus.SHIPPING]: [
      DbOrderStatus.COMPLETED,
      DbOrderStatus.CANCELLED,
    ],
    [DbOrderStatus.COMPLETED]: [],
    [DbOrderStatus.CANCELLED]: [],
  };

  private toResponse(order: OrderWithRelations): OrderResponseDto {
    return {
      id: order.id,
      code: order.code,
      status: order.status as unknown as OrderStatus,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      shippingAddress: order.shippingAddress,
      note: order.note,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      items: (order.orderItems ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        productName: item.productName,
        variantName: item.variantName,
        imageUrl: item.imageUrl,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
        isGift: item.isGift,
        options: (item.orderItemOptions ?? []).map((opt) => ({
          id: opt.id,
          optionItemId: opt.optionItemId,
          groupName: opt.groupName,
          itemName: opt.itemName,
          extraPrice: Number(opt.extraPrice),
        })),
      })),
      statusHistory: (order.orderStatusHistory ?? []).map((h) => ({
        fromStatus: h.fromStatus as unknown as OrderStatus | null,
        toStatus: h.toStatus as unknown as OrderStatus,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private generateOrderCode(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const randomStr = randomBytes(2).toString('hex').toUpperCase();
    return `ORD-${yy}${mm}${dd}-${randomStr}`;
  }

  async findAll(
    dto: FindAllOrdersDto,
  ): Promise<{ data: OrderResponseDto[]; meta: PaginationMetaDto }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.status) {
      where.status = dto.status as unknown as DbOrderStatus;
    }

    if (dto.search) {
      const search = dto.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prismaService.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              orderItemOptions: true,
            },
          },
          orderStatusHistory: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.order.count({ where }),
    ]);

    return {
      data: orders.map((order) =>
        this.toResponse(order as unknown as OrderWithRelations),
      ),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string): Promise<OrderResponseDto> {
    const order = await this.prismaService.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            orderItemOptions: true,
          },
        },
        orderStatusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Đơn hàng với ID ${id} không tồn tại`);
    }

    return this.toResponse(order as unknown as OrderWithRelations);
  }

  async updateStatus(dto: UpdateOrderStatusDto): Promise<OrderResponseDto> {
    return this.prismaService.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: dto.id },
      });

      if (!order) {
        throw new NotFoundException(`Đơn hàng với ID ${dto.id} không tồn tại`);
      }

      const targetStatus = dto.toStatus as unknown as DbOrderStatus;
      const allowedTransitions = this.TRANSITIONS[order.status] ?? [];

      if (!allowedTransitions.includes(targetStatus)) {
        throw new BadRequestException(
          `Không thể chuyển trạng thái từ ${order.status} sang ${dto.toStatus}`,
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: targetStatus },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: targetStatus,
          note: dto.note ?? null,
        },
      });

      const updatedOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          orderItems: {
            include: {
              orderItemOptions: true,
            },
          },
          orderStatusHistory: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return this.toResponse(updatedOrder as unknown as OrderWithRelations);
    });
  }

  async create(dto: CreateOrderDto): Promise<OrderResponseDto> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải có ít nhất 1 sản phẩm');
    }

    // 1. Fetch & Validate từng sản phẩm từ product-service
    const preparedItems: {
      productId: string;
      variantId?: string | null;
      sku: string;
      productName: string;
      variantName?: string | null;
      imageUrl?: string | null;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
      options: {
        optionItemId: string;
        groupName: string;
        itemName: string;
        extraPrice: number;
      }[];
    }[] = [];

    const refsForStockCheck: { refType: StockRefType; refId: string }[] = [];

    for (const itemInput of dto.items) {
      const product = await firstValueFrom(
        this.productClient
          .send<ProductResponseDto>(
            PRODUCT_PATTERNS.FIND_ONE,
            itemInput.productId,
          )
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new NotFoundException(
                `Sản phẩm với ID ${itemInput.productId} không tồn tại hoặc lỗi kết nối`,
              );
            }),
          ),
      );

      if (!product || product.status !== true) {
        throw new BadRequestException(
          `Sản phẩm "${product?.name ?? itemInput.productId}" hiện đang ngừng kinh doanh`,
        );
      }

      let sku = product.sku;
      let productName = product.name;
      let variantName: string | null = null;
      let imageUrl: string | null =
        product.thumbnail ?? product.images?.[0] ?? null;
      let basePrice = product.price;

      if (product.type === ProductType.VARIANT) {
        if (!itemInput.variantId) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" yêu cầu chọn biến thể`,
          );
        }

        const variant = product.productVariants?.find(
          (v) => v.id === itemInput.variantId && v.status === true,
        );

        if (!variant) {
          throw new BadRequestException(
            `Biến thể được chọn của sản phẩm "${product.name}" không tồn tại hoặc ngừng kinh doanh`,
          );
        }

        sku = variant.sku;
        variantName =
          variant.attributeValues?.map((a) => a.value).join(' / ') || null;
        imageUrl = variant.imageUrl ?? imageUrl;
        basePrice = variant.price;

        refsForStockCheck.push({
          refType: StockRefType.VARIANT,
          refId: variant.id,
        });
      } else {
        refsForStockCheck.push({
          refType: StockRefType.PRODUCT,
          refId: product.id,
        });
      }

      // Validate Options nếu sản phẩm có option groups
      const selectedOptions: {
        optionItemId: string;
        groupName: string;
        itemName: string;
        extraPrice: number;
      }[] = [];

      const optionGroups = product.productOptionGroups ?? [];
      if (optionGroups.length > 0) {
        const optionItemsMap = new Map<
          string,
          {
            groupName: string;
            extraPrice: number;
            itemName: string;
            groupId: string;
          }
        >();

        for (const group of optionGroups) {
          for (const optItem of group.productOptionItems ?? []) {
            if (optItem.status) {
              optionItemsMap.set(optItem.id, {
                groupName: group.name,
                itemName: optItem.name,
                extraPrice: optItem.extraPrice,
                groupId: group.id,
              });
            }
          }
        }

        const selectedOptionIds = itemInput.optionItemIds ?? [];
        const groupSelectionCounts = new Map<string, number>();

        for (const optId of selectedOptionIds) {
          const optInfo = optionItemsMap.get(optId);
          if (!optInfo) {
            throw new BadRequestException(
              `Tùy chọn với ID ${optId} không hợp lệ hoặc ngừng bán`,
            );
          }

          selectedOptions.push({
            optionItemId: optId,
            groupName: optInfo.groupName,
            itemName: optInfo.itemName,
            extraPrice: optInfo.extraPrice,
          });

          const currentCount = groupSelectionCounts.get(optInfo.groupId) ?? 0;
          groupSelectionCounts.set(optInfo.groupId, currentCount + 1);
        }

        for (const group of optionGroups) {
          const count = groupSelectionCounts.get(group.id) ?? 0;
          if (count < group.minSelect) {
            throw new BadRequestException(
              `Vui lòng chọn ít nhất ${group.minSelect} tùy chọn cho nhóm "${group.name}"`,
            );
          }
          if (group.maxSelect !== null && count > group.maxSelect) {
            throw new BadRequestException(
              `Chỉ được chọn tối đa ${group.maxSelect} tùy chọn cho nhóm "${group.name}"`,
            );
          }
        }
      }

      const extraPriceTotal = selectedOptions.reduce(
        (sum, o) => sum + o.extraPrice,
        0,
      );
      const unitPrice = basePrice + extraPriceTotal;
      const lineTotal = unitPrice * itemInput.quantity;

      preparedItems.push({
        productId: product.id,
        variantId: itemInput.variantId ?? null,
        sku,
        productName,
        variantName,
        imageUrl,
        unitPrice,
        quantity: itemInput.quantity,
        lineTotal,
        options: selectedOptions,
      });
    }

    // 2. Check tồn kho qua inventory-service (batch query)
    const stockItems = await firstValueFrom(
      this.inventoryClient
        .send<StockItemResponseDto[]>(INVENTORY_PATTERNS.GET_STOCK, {
          refs: refsForStockCheck,
        })
        .pipe(
          timeout(5000),
          // catchError phải trả về OBSERVABLE — return [] trần sẽ thành
          // observable rỗng (emit 0 lần) → firstValueFrom ném EmptyError.
          // of([]) = observable emit đúng 1 mảng rỗng → degrade êm:
          // inventory sập thì bỏ qua check tồn (Phase 0 chấp nhận).
          catchError(() => of([] as StockItemResponseDto[])),
        ),
    );

    const stockMap = new Map<string, StockItemResponseDto>();
    for (const stock of stockItems ?? []) {
      stockMap.set(`${stock.refType}_${stock.refId}`, stock);
    }

    for (let i = 0; i < preparedItems.length; i++) {
      const pi = preparedItems[i];
      const ref = refsForStockCheck[i];
      const stock = stockMap.get(`${ref.refType}_${ref.refId}`);

      if (stock && stock.available < pi.quantity) {
        throw new BadRequestException(
          `Sản phẩm "${pi.productName}" không đủ tồn kho khả dụng (còn ${stock.available}, yêu cầu ${pi.quantity})`,
        );
      }
    }

    // 3. Tính toán tổng tiền & Lưu vào DB bằng $transaction
    const subtotal = preparedItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );

    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      try {
        const code = this.generateOrderCode();
        return await this.prismaService.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              code,
              status: DbOrderStatus.PENDING,
              customerId: dto.customerId ?? null,
              customerName: dto.customerName,
              customerPhone: dto.customerPhone,
              customerEmail: dto.customerEmail ?? null,
              shippingAddress: dto.shippingAddress ?? null,
              note: dto.note ?? null,
              subtotal,
              shippingFee: 0,
              discountAmount: 0,
              total: subtotal,
              paymentMethod: dto.paymentMethod ?? 'COD',
              orderItems: {
                create: preparedItems.map((pi) => ({
                  productId: pi.productId,
                  variantId: pi.variantId,
                  sku: pi.sku,
                  productName: pi.productName,
                  variantName: pi.variantName,
                  imageUrl: pi.imageUrl,
                  unitPrice: pi.unitPrice,
                  quantity: pi.quantity,
                  lineTotal: pi.lineTotal,
                  isGift: false,
                  orderItemOptions: {
                    create: pi.options,
                  },
                })),
              },
              orderStatusHistory: {
                create: {
                  fromStatus: null,
                  toStatus: DbOrderStatus.PENDING,
                  note: 'Khởi tạo đơn hàng',
                },
              },
            },
            include: {
              orderItems: {
                include: {
                  orderItemOptions: true,
                },
              },
              orderStatusHistory: {
                orderBy: { createdAt: 'asc' },
              },
            },
          });

          return this.toResponse(order as unknown as OrderWithRelations);
        });
      } catch (error: any) {
        if (error?.code === 'P2002' && attempts < 5) {
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException(
      'Không thể sinh mã đơn hàng, vui lòng thử lại',
    );
  }
}
