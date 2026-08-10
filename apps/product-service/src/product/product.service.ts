import {
  CreateProductAttributeDto,
  CreateProductDto,
  CreateProductVariantDto,
  ProductOptionGroupInputDto,
  ProductResponseDto,
  UpdateProductDto,
} from '@app/event-contracts';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildSlugtify } from '@app/shared/common/utils/slugtify.util';
import { Prisma } from '../generated/prisma/client';
import { ProductType } from '../generated/prisma/enums';
import {
  buildPaginationMeta,
  PaginationMetaDto,
  PaginationQueryDto,
  parsePaginationQuery,
} from '@app/shared';

const defaultInclude = {
  productLabels: { include: { label: true } },
  productOptionGroups: { include: { productOptionItems: true } },
  productAttributes: { include: { productAttributeValues: true } },
  productVariants: {
    include: {
      productVariantAttributeValues: {
        include: { productAttributeValue: true },
      },
    },
  },
} as const;

@Injectable()
export class ProductService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(dto: CreateProductDto): Promise<{
    data: ProductResponseDto;
    message: string;
  }> {
    const {
      type: rawType,
      labelIds,
      productOptionGroups,
      productAttributes,
      productVariants,
      compareAtPrice,
      saleStartAt,
      saleEndAt,
      sku: rawSku,
      ...productData
    } = dto;

    const productType = rawType || ProductType.SIMPLE;

    // Auto-generate SKU nếu FE không truyền
    const productSku = rawSku || this.generateSku('PRD');

    // Validate khoảng thời gian giảm giá cho sản phẩm chính
    this.validateSaleDates(saleStartAt, saleEndAt, 'Sản phẩm');

    this.validateProductTypeInvariants(
      productType,
      productOptionGroups,
      productAttributes,
      productVariants,
    );

    const slug = productData.slug || buildSlugtify(productData.name);

    const existingProduct = await this.prismaService.product.findFirst({
      where: { OR: [{ sku: productSku }, { slug: slug }] },
    });
    if (existingProduct) {
      if (existingProduct.sku === productSku) {
        throw new BadRequestException('Mã SKU đã tồn tại');
      }
      if (existingProduct.slug === slug) {
        throw new BadRequestException('Slug đã tồn tại');
      }
    }

    const category = await this.prismaService.category.findFirst({
      where: { id: dto.categoryId, isDeleted: false },
    });
    if (!category) {
      throw new BadRequestException('Danh mục không tồn tại hoặc đã bị xóa');
    }

    if (dto.brandId) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: dto.brandId },
      });
      if (!brand) {
        throw new BadRequestException('Thương hiệu không tồn tại');
      }
    }

    // Chuẩn hóa SKU cho các variants (nếu để trống thì tự sinh)
    const normalizedVariants = productVariants?.map((v) => ({
      ...v,
      sku: v.sku || this.generateSku('VAR'),
    }));

    // Check trùng SKU trong danh sách variant gửi lên và check với DB
    if (productType === ProductType.VARIANT && normalizedVariants?.length) {
      const variantSkus = normalizedVariants.map((v) => v.sku);
      const uniqueSkus = new Set(variantSkus);
      if (uniqueSkus.size !== variantSkus.length) {
        throw new BadRequestException('Mã SKU giữa các biến thể bị trùng lặp');
      }

      for (const vDto of normalizedVariants) {
        this.validateSaleDates(
          vDto.saleStartAt,
          vDto.saleEndAt,
          `Biến thể '${vDto.sku}'`,
        );
      }

      const existingVariant = await this.prismaService.productVariant.findFirst(
        {
          where: { sku: { in: variantSkus } },
        },
      );
      if (existingVariant) {
        throw new BadRequestException(
          `SKU biến thể '${existingVariant.sku}' đã tồn tại trong hệ thống`,
        );
      }
    }

    const product = await this.prismaService.$transaction(async (tx) => {
      // 1. Tạo Product gốc kèm Labels, OptionGroups (nếu OPTION) hoặc Attributes (nếu VARIANT)
      const newProduct = await tx.product.create({
        data: {
          ...productData,
          sku: productSku,
          compareAtPrice: compareAtPrice ?? null,
          saleStartAt: saleStartAt ? new Date(saleStartAt) : null,
          saleEndAt: saleEndAt ? new Date(saleEndAt) : null,
          slug,
          type: productType,
          productLabels: labelIds?.length
            ? { create: labelIds.map((labelId) => ({ labelId })) }
            : undefined,

          productOptionGroups:
            productType === ProductType.OPTION && productOptionGroups?.length
              ? {
                  create: productOptionGroups.map(
                    ({ productOptionItems, ...groupData }) => ({
                      ...groupData,
                      productOptionItems: { create: productOptionItems },
                    }),
                  ),
                }
              : undefined,

          productAttributes:
            productType === ProductType.VARIANT && productAttributes?.length
              ? {
                  create: productAttributes.map((attr) => ({
                    name: attr.name,
                    position: attr.position ?? 0,
                    productAttributeValues: {
                      create: attr.values.map((val) => ({
                        value: val.value,
                        position: val.position ?? 0,
                      })),
                    },
                  })),
                }
              : undefined,
        },
        include: {
          productAttributes: { include: { productAttributeValues: true } },
        },
      });

      // 2. Nếu type = VARIANT, tạo danh sách ProductVariant và liên kết ProductVariantAttributeValue
      if (productType === ProductType.VARIANT && normalizedVariants?.length) {
        const valueMap = new Map<string, string>();
        for (const attr of newProduct.productAttributes) {
          for (const val of attr.productAttributeValues) {
            valueMap.set(`${attr.name}:${val.value}`, val.id);
            valueMap.set(val.id, val.id);
          }
        }

        for (const variantDto of normalizedVariants) {
          const targetValueIds: string[] = [];

          if (variantDto.attributeValueIds?.length) {
            targetValueIds.push(...variantDto.attributeValueIds);
          } else if (variantDto.attributeSelections?.length) {
            for (const sel of variantDto.attributeSelections) {
              const valId = valueMap.get(`${sel.attributeName}:${sel.value}`);
              if (!valId) {
                throw new BadRequestException(
                  `Không tìm thấy giá trị thuộc tính '${sel.attributeName}: ${sel.value}'`,
                );
              }
              targetValueIds.push(valId);
            }
          }

          await tx.productVariant.create({
            data: {
              sku: variantDto.sku,
              price: variantDto.price,
              compareAtPrice: variantDto.compareAtPrice ?? null,
              saleStartAt: variantDto.saleStartAt
                ? new Date(variantDto.saleStartAt)
                : null,
              saleEndAt: variantDto.saleEndAt
                ? new Date(variantDto.saleEndAt)
                : null,
              stock: variantDto.stock ?? 0,
              imageUrl: variantDto.imageUrl,
              status: variantDto.status ?? true,
              productId: newProduct.id,
              productVariantAttributeValues: {
                create: targetValueIds.map((valId) => ({
                  productAttributeValueId: valId,
                })),
              },
            },
          });
        }
      }

      return tx.product.findUniqueOrThrow({
        where: { id: newProduct.id },
        include: defaultInclude,
      });
    });

    return {
      data: this.toResponse(product),
      message: 'Đã tạo sản phẩm mới thành công',
    };
  }

  async findAll(query: PaginationQueryDto): Promise<{
    items: ProductResponseDto[];
    meta: PaginationMetaDto;
  }> {
    const { pageIndex, pageLimit, skip, take, search } =
      parsePaginationQuery(query);
    const where: Prisma.ProductWhereInput = {
      isDeleted: false,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, totalResults] = await Promise.all([
      this.prismaService.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: defaultInclude,
      }),
      this.prismaService.product.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      meta: buildPaginationMeta(totalResults, pageIndex, pageLimit),
    };
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.prismaService.product.findUnique({
      where: { id, isDeleted: false },
      include: defaultInclude,
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm hoặc đã bị xoá');
    }
    return this.toResponse(product);
  }

  async update(dto: UpdateProductDto): Promise<ProductResponseDto> {
    const {
      id,
      type: rawType,
      sku: _ignoredSku, // SKU của sản phẩm chính là read-only, không cho phép sửa khi update
      slug: _rawSlug, // Tách slug gốc ra khỏi productData để xử lý thống nhất bên dưới
      labelIds,
      productOptionGroups,
      productAttributes,
      productVariants,
      compareAtPrice,
      saleStartAt,
      saleEndAt,
      ...productData
    } = dto;

    const currentProduct = await this.prismaService.product.findUnique({
      where: { id, isDeleted: false },
      include: defaultInclude,
    });
    if (!currentProduct) {
      throw new NotFoundException('Không tìm thấy sản phẩm hoặc đã bị xoá');
    }

    const newType = rawType || currentProduct.type;

    // Validate ngày bắt đầu / kết thúc giảm giá nếu có cập nhật
    const effectiveSaleStartAt =
      saleStartAt !== undefined ? saleStartAt : currentProduct.saleStartAt;
    const effectiveSaleEndAt =
      saleEndAt !== undefined ? saleEndAt : currentProduct.saleEndAt;
    this.validateSaleDates(
      effectiveSaleStartAt,
      effectiveSaleEndAt,
      'Sản phẩm',
    );

    // 1. Kiểm tra An toàn khi Đổi Loại Sản phẩm (Chống mất dữ liệu vô tình)
    if (
      currentProduct.type === ProductType.VARIANT &&
      newType !== ProductType.VARIANT &&
      currentProduct.productVariants?.length > 0
    ) {
      throw new BadRequestException(
        'Sản phẩm hiện đang có biến thể. Không thể đổi loại sản phẩm khi chưa gỡ bỏ hết biến thể cũ.',
      );
    }
    if (
      currentProduct.type === ProductType.OPTION &&
      newType !== ProductType.OPTION &&
      currentProduct.productOptionGroups?.length > 0
    ) {
      throw new BadRequestException(
        'Sản phẩm hiện đang có nhóm tùy chọn. Không thể đổi loại sản phẩm khi chưa gỡ bỏ hết các tùy chọn cũ.',
      );
    }

    // 2. Validate ProductType Invariants đối với dữ liệu Update
    const effectiveOptionGroups =
      productOptionGroups !== undefined
        ? productOptionGroups
        : currentProduct.productOptionGroups;
    const effectiveAttributes =
      productAttributes !== undefined
        ? productAttributes
        : currentProduct.productAttributes;
    const effectiveVariants =
      productVariants !== undefined
        ? productVariants
        : currentProduct.productVariants;

    this.validateProductTypeInvariants(
      newType,
      effectiveOptionGroups,
      effectiveAttributes,
      effectiveVariants,
    );

    // 3. Tính toán và validate Slug
    const slug =
      dto.slug ||
      (productData.name ? buildSlugtify(productData.name) : undefined);

    if (slug) {
      const existingProduct = await this.prismaService.product.findFirst({
        where: {
          id: { not: id },
          slug,
        },
      });
      if (existingProduct) {
        throw new BadRequestException('Slug đã tồn tại');
      }
    }

    if (productData.categoryId) {
      const category = await this.prismaService.category.findFirst({
        where: { id: productData.categoryId, isDeleted: false },
      });
      if (!category) {
        throw new BadRequestException('Danh mục không tồn tại hoặc đã bị xóa');
      }
    }

    if (productData.brandId) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: productData.brandId },
      });
      if (!brand) {
        throw new BadRequestException('Thương hiệu không tồn tại');
      }
    }

    // 4. Validate SKU trùng lặp & sale dates cho các Variant
    const normalizedUpdateVariants = productVariants?.map((v) => ({
      ...v,
      sku: v.id ? v.sku : v.sku || this.generateSku('VAR'),
    }));

    if (newType === ProductType.VARIANT && normalizedUpdateVariants?.length) {
      const newVariantSkus = normalizedUpdateVariants
        .filter((v) => !v.id)
        .map((v) => v.sku);
      if (newVariantSkus.length > 0) {
        const uniqueSkus = new Set(newVariantSkus);
        if (uniqueSkus.size !== newVariantSkus.length) {
          throw new BadRequestException(
            'Mã SKU giữa các biến thể mới thêm bị trùng lặp trong yêu cầu',
          );
        }
      }

      for (const vDto of normalizedUpdateVariants) {
        const existingVariant = currentProduct.productVariants.find(
          (ev) => ev.id === vDto.id,
        );
        const vStart =
          vDto.saleStartAt !== undefined
            ? vDto.saleStartAt
            : existingVariant?.saleStartAt;
        const vEnd =
          vDto.saleEndAt !== undefined
            ? vDto.saleEndAt
            : existingVariant?.saleEndAt;
        this.validateSaleDates(
          vStart,
          vEnd,
          `Biến thể '${vDto.sku || existingVariant?.sku || ''}'`,
        );
      }
    }

    await this.prismaService.$transaction(async (tx) => {
      // 1. Nếu chuyển type khác VARIANT ➔ Xóa toàn bộ attributes và variants cũ
      if (newType !== ProductType.VARIANT) {
        await tx.productAttribute.deleteMany({ where: { productId: id } });
        await tx.productVariant.deleteMany({ where: { productId: id } });
      }

      // 2. Nếu chuyển type khác OPTION ➔ Xóa toàn bộ option groups cũ
      if (newType !== ProductType.OPTION) {
        await tx.productOptionGroup.deleteMany({ where: { productId: id } });
      }

      // 3. Smart Sync ProductOptionGroups (nếu type = OPTION)
      if (newType === ProductType.OPTION && productOptionGroups) {
        const existingGroups = currentProduct.productOptionGroups || [];
        const incomingGroupIds = productOptionGroups
          .map((g) => g.id)
          .filter(Boolean);

        const groupIdsToDelete = existingGroups
          .map((g) => g.id)
          .filter((gId) => !incomingGroupIds.includes(gId));
        if (groupIdsToDelete.length > 0) {
          await tx.productOptionGroup.deleteMany({
            where: { id: { in: groupIdsToDelete } },
          });
        }

        for (const group of productOptionGroups) {
          const { id: groupId, productOptionItems, ...groupData } = group;
          if (groupId) {
            const existingGroup = existingGroups.find((g) => g.id === groupId);
            if (!existingGroup) {
              throw new BadRequestException(
                'Nhóm tuỳ chọn không tồn tại hoặc đã bị xoá',
              );
            }
            await tx.productOptionGroup.update({
              where: { id: groupId },
              data: groupData,
            });

            if (productOptionItems) {
              const existingItemIds = existingGroup.productOptionItems.map(
                (i) => i.id,
              );
              const incomingItemIds = productOptionItems
                .map((i) => i.id)
                .filter(Boolean);

              const itemIdsToDelete = existingItemIds.filter(
                (iId) => !incomingItemIds.includes(iId),
              );
              if (itemIdsToDelete.length > 0) {
                await tx.productOptionItem.deleteMany({
                  where: { id: { in: itemIdsToDelete } },
                });
              }

              for (const item of productOptionItems) {
                const { id: itemId, ...itemData } = item;
                if (itemId) {
                  await tx.productOptionItem.update({
                    where: { id: itemId },
                    data: itemData,
                  });
                } else {
                  await tx.productOptionItem.create({
                    data: { ...itemData, productOptionGroupId: groupId },
                  });
                }
              }
            }
          } else {
            await tx.productOptionGroup.create({
              data: {
                ...groupData,
                productId: id,
                productOptionItems: { create: productOptionItems },
              },
            });
          }
        }
      }

      // 4. Smart Sync ProductAttributes & Values (nếu type = VARIANT)
      if (newType === ProductType.VARIANT && productAttributes) {
        const existingAttrs = currentProduct.productAttributes || [];
        const incomingAttrIds = productAttributes
          .map((a) => a.id)
          .filter(Boolean);

        const attrIdsToDelete = existingAttrs
          .map((a) => a.id)
          .filter((aId) => !incomingAttrIds.includes(aId));
        if (attrIdsToDelete.length > 0) {
          await tx.productAttribute.deleteMany({
            where: { id: { in: attrIdsToDelete } },
          });
        }

        for (const attr of productAttributes) {
          const { id: attrId, values, ...attrData } = attr;
          if (attrId) {
            const existingAttr = existingAttrs.find((a) => a.id === attrId);
            if (!existingAttr) {
              throw new BadRequestException(
                'Thuộc tính không tồn tại hoặc đã bị xoá',
              );
            }
            await tx.productAttribute.update({
              where: { id: attrId },
              data: attrData,
            });

            if (values) {
              const existingValueIds = existingAttr.productAttributeValues.map(
                (v) => v.id,
              );
              const incomingValueIds = values.map((v) => v.id).filter(Boolean);

              const valueIdsToDelete = existingValueIds.filter(
                (vId) => !incomingValueIds.includes(vId),
              );
              if (valueIdsToDelete.length > 0) {
                await tx.productAttributeValue.deleteMany({
                  where: { id: { in: valueIdsToDelete } },
                });
              }

              for (const val of values) {
                const { id: valId, ...valData } = val;
                if (valId) {
                  await tx.productAttributeValue.update({
                    where: { id: valId },
                    data: valData,
                  });
                } else {
                  await tx.productAttributeValue.create({
                    data: { ...valData, productAttributeId: attrId },
                  });
                }
              }
            }
          } else {
            await tx.productAttribute.create({
              data: {
                ...attrData,
                productId: id,
                productAttributeValues: { create: values },
              },
            });
          }
        }
      }

      // 5. Smart Sync ProductVariants (nếu type = VARIANT)
      if (newType === ProductType.VARIANT && normalizedUpdateVariants) {
        const latestProduct = await tx.product.findUniqueOrThrow({
          where: { id },
          include: {
            productAttributes: { include: { productAttributeValues: true } },
            productVariants: true,
          },
        });

        const valueMap = new Map<string, string>();
        for (const attr of latestProduct.productAttributes) {
          for (const val of attr.productAttributeValues) {
            valueMap.set(`${attr.name}:${val.value}`, val.id);
            valueMap.set(val.id, val.id);
          }
        }

        const existingVariants = latestProduct.productVariants || [];
        const incomingVariantIds = normalizedUpdateVariants
          .map((v) => v.id)
          .filter(Boolean);

        const variantIdsToDelete = existingVariants
          .map((v) => v.id)
          .filter((vId) => !incomingVariantIds.includes(vId));
        if (variantIdsToDelete.length > 0) {
          await tx.productVariant.deleteMany({
            where: { id: { in: variantIdsToDelete } },
          });
        }

        for (const variantDto of normalizedUpdateVariants) {
          const {
            id: variantId,
            sku: variantSku,
            attributeSelections,
            attributeValueIds,
            compareAtPrice: vCompareAtPrice,
            saleStartAt: vSaleStartAt,
            saleEndAt: vSaleEndAt,
            ...variantData
          } = variantDto;

          const targetValueIds: string[] = [];
          if (attributeValueIds?.length) {
            targetValueIds.push(...attributeValueIds);
          } else if (attributeSelections?.length) {
            for (const sel of attributeSelections) {
              const valId = valueMap.get(`${sel.attributeName}:${sel.value}`);
              if (!valId) {
                throw new BadRequestException(
                  `Không tìm thấy giá trị thuộc tính '${sel.attributeName}: ${sel.value}'`,
                );
              }
              targetValueIds.push(valId);
            }
          }

          const parsedVariantPricing = {
            compareAtPrice:
              vCompareAtPrice !== undefined
                ? (vCompareAtPrice ?? null)
                : undefined,
            saleStartAt:
              vSaleStartAt !== undefined
                ? vSaleStartAt
                  ? new Date(vSaleStartAt)
                  : null
                : undefined,
            saleEndAt:
              vSaleEndAt !== undefined
                ? vSaleEndAt
                  ? new Date(vSaleEndAt)
                  : null
                : undefined,
          };

          if (variantId) {
            // Update variant cũ: SKU là READ-ONLY, giữ nguyên SKU cũ không cho sửa!
            await tx.productVariant.update({
              where: { id: variantId },
              data: {
                ...variantData, // không chứa SKU
                ...parsedVariantPricing,
                productVariantAttributeValues: {
                  deleteMany: {},
                  create: targetValueIds.map((valId) => ({
                    productAttributeValueId: valId,
                  })),
                },
              },
            });
          } else {
            // Create variant mới: Dùng SKU được truyền hoặc SKU đã tự sinh
            const existingSku = await tx.productVariant.findFirst({
              where: { sku: variantSku },
            });
            if (existingSku) {
              throw new BadRequestException(
                `Mã SKU biến thể '${variantSku}' đã tồn tại trong hệ thống`,
              );
            }

            await tx.productVariant.create({
              data: {
                ...variantData,
                sku: variantSku!,
                compareAtPrice: vCompareAtPrice ?? null,
                saleStartAt: vSaleStartAt ? new Date(vSaleStartAt) : null,
                saleEndAt: vSaleEndAt ? new Date(vSaleEndAt) : null,
                productId: id,
                productVariantAttributeValues: {
                  create: targetValueIds.map((valId) => ({
                    productAttributeValueId: valId,
                  })),
                },
              },
            });
          }
        }
      }

      // 6. Update main product info
      await tx.product.update({
        where: { id },
        data: {
          ...productData,
          type: newType,
          compareAtPrice:
            compareAtPrice !== undefined ? (compareAtPrice ?? null) : undefined,
          saleStartAt:
            saleStartAt !== undefined
              ? saleStartAt
                ? new Date(saleStartAt)
                : null
              : undefined,
          saleEndAt:
            saleEndAt !== undefined
              ? saleEndAt
                ? new Date(saleEndAt)
                : null
              : undefined,
          ...(slug && { slug }),
          productLabels: labelIds
            ? {
                deleteMany: {},
                create: labelIds.map((labelId) => ({ labelId })),
              }
            : undefined,
        },
      });
    });

    const updatedProduct = await this.prismaService.product.findUniqueOrThrow({
      where: { id },
      include: defaultInclude,
    });

    return this.toResponse(updatedProduct);
  }

  async delete(id: string): Promise<ProductResponseDto> {
    const currentProduct = await this.findOne(id);

    const deletedProduct = await this.prismaService.product.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        slug: `deleted-${currentProduct.slug}-${Date.now()}`,
      },
      include: defaultInclude,
    });
    return this.toResponse(deletedProduct);
  }

  private generateSku(prefix: string = 'SKU'): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${timestamp}-${random}`;
  }

  private validateSaleDates(
    saleStartAt?: string | Date | null,
    saleEndAt?: string | Date | null,
    context: string = 'Sản phẩm',
  ) {
    if (saleStartAt && saleEndAt) {
      const start = new Date(saleStartAt);
      const end = new Date(saleEndAt);
      if (start > end) {
        throw new BadRequestException(
          `${context}: Ngày bắt đầu giảm giá phải trước hoặc bằng ngày kết thúc`,
        );
      }
    }
  }

  private validateProductTypeInvariants(
    type: ProductType = ProductType.SIMPLE,
    productOptionGroups?: any[],
    productAttributes?: any[],
    productVariants?: any[],
  ) {
    if (type === ProductType.SIMPLE) {
      if (
        (productOptionGroups && productOptionGroups.length > 0) ||
        (productAttributes && productAttributes.length > 0) ||
        (productVariants && productVariants.length > 0)
      ) {
        throw new BadRequestException(
          'Sản phẩm đơn (SIMPLE) không được chứa option groups hoặc biến thể',
        );
      }
    } else if (type === ProductType.OPTION) {
      if (
        (productAttributes && productAttributes.length > 0) ||
        (productVariants && productVariants.length > 0)
      ) {
        throw new BadRequestException(
          'Sản phẩm loại OPTION không được chứa biến thể (VARIANT)',
        );
      }
      if (!productOptionGroups || productOptionGroups.length === 0) {
        throw new BadRequestException(
          'Sản phẩm loại OPTION phải có ít nhất 1 nhóm tùy chọn',
        );
      }
    } else if (type === ProductType.VARIANT) {
      if (productOptionGroups && productOptionGroups.length > 0) {
        throw new BadRequestException(
          'Sản phẩm loại VARIANT không được chứa nhóm option',
        );
      }
      if (!productAttributes || productAttributes.length === 0) {
        throw new BadRequestException(
          'Sản phẩm loại VARIANT phải có ít nhất 1 thuộc tính (attribute)',
        );
      }
      if (!productVariants || productVariants.length === 0) {
        throw new BadRequestException(
          'Sản phẩm loại VARIANT phải có ít nhất 1 biến thể (variant)',
        );
      }
    }
  }

  private calculatePricingInfo(
    price: number,
    compareAtPrice?: number | null,
    saleStartAt?: Date | string | null,
    saleEndAt?: Date | string | null,
  ) {
    const now = new Date();
    const start = saleStartAt ? new Date(saleStartAt) : null;
    const end = saleEndAt ? new Date(saleEndAt) : null;

    const isTimeValid = (!start || now >= start) && (!end || now <= end);
    const compPrice = compareAtPrice ? Number(compareAtPrice) : null;

    const isOnSale = Boolean(compPrice && compPrice > price && isTimeValid);

    const discountPercent =
      isOnSale && compPrice
        ? Math.round(((compPrice - price) / compPrice) * 100)
        : null;

    return {
      price,
      compareAtPrice: compPrice,
      saleStartAt: start,
      saleEndAt: end,
      isOnSale,
      discountPercent,
    };
  }

  private toResponse(t: any): ProductResponseDto {
    const pricing = this.calculatePricingInfo(
      Number(t.price),
      t.compareAtPrice ? Number(t.compareAtPrice) : null,
      t.saleStartAt,
      t.saleEndAt,
    );

    return {
      ...t,
      ...pricing,
      weight: t.weight ? Number(t.weight) : null,
      labels: t.productLabels?.map((pl: any) => pl.label),
      productOptionGroups: t.productOptionGroups?.map((group: any) => ({
        ...group,
        productOptionItems: group.productOptionItems?.map((item: any) => ({
          ...item,
          extraPrice: Number(item.extraPrice),
        })),
      })),
      productAttributes: t.productAttributes?.map((attr: any) => ({
        ...attr,
        values: attr.productAttributeValues?.map((val: any) => ({
          ...val,
        })),
      })),
      productVariants: t.productVariants?.map((variant: any) => {
        const vPricing = this.calculatePricingInfo(
          Number(variant.price),
          variant.compareAtPrice ? Number(variant.compareAtPrice) : null,
          variant.saleStartAt,
          variant.saleEndAt,
        );

        return {
          ...variant,
          ...vPricing,
          stock: variant.stock,
          imageUrl: variant.imageUrl,
          status: variant.status,
          attributeValues: variant.productVariantAttributeValues?.map(
            (vav: any) => ({
              id: vav.productAttributeValue.id,
              value: vav.productAttributeValue.value,
              position: vav.productAttributeValue.position,
            }),
          ),
        };
      }),
    };
  }
}
