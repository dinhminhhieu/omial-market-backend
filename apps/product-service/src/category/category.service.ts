import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '@app/event-contracts';
import { buildSlugtify } from '@app/shared/common/utils/slugtify.util';
import {
  buildPaginationMeta,
  PaginationMetaDto,
  PaginationQueryDto,
  parsePaginationQuery,
} from '@app/shared';

@Injectable()
export class CategoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<{
    data: CategoryResponseDto;
    message: string;
  }> {
    const slug = dto.slug ?? buildSlugtify(dto.name);

    const categoryExisting = await this.prismaService.category.findUnique({
      where: { slug },
    });

    if (categoryExisting) {
      throw new BadRequestException('Danh mục này đã tồn tại');
    }

    const category = await this.prismaService.category.create({
      data: { ...dto, slug },
    });
    return {
      data: category,
      message: 'Đã tạo danh mục mới thành công',
    };
  }

  async findAll(query: PaginationQueryDto): Promise<{
    items: CategoryResponseDto[];
    meta: PaginationMetaDto;
  }> {
    const { pageIndex, pageLimit, skip, take, search } =
      parsePaginationQuery(query);
    const where = {
      isDeleted: false,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, totalResults] = await Promise.all([
      this.prismaService.category.findMany({
        where,
        include: {
          children: {
            where: { isDeleted: false },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          },
        },
        skip,
        take,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prismaService.category.count({ where }),
    ]);
    return {
      items,
      meta: buildPaginationMeta(totalResults, pageIndex, pageLimit),
    };
  }

  async findOne(id: string): Promise<CategoryResponseDto> {
    const category = await this.prismaService.category.findUnique({
      where: { id, isDeleted: false },
      include: {
        children: {
          where: { isDeleted: false },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Danh mục này không tồn tại hoặc đã bị xoá');
    }
    return category;
  }

  async update(dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const categoryExisting = await this.findOne(dto.id);

    if (dto.slug && dto.slug !== categoryExisting.slug) {
      const duplicateSlug = await this.prismaService.category.findUnique({
        where: { slug: dto.slug },
      });
      if (duplicateSlug) {
        throw new BadRequestException('Slug này đã tồn tại');
      }
    }

    if (dto.parentId) {
      await this.ensureNoCycle(dto.id, dto.parentId);
    }

    const { id, ...data } = dto;

    const category = await this.prismaService.category.update({
      where: { id },
      data,
    });
    return category;
  }

  async delete(id: string): Promise<CategoryResponseDto> {
    const existing = await this.findOne(id);

    const [childCount, productCount] = await Promise.all([
      this.prismaService.category.count({
        where: { parentId: id, isDeleted: false },
      }),
      this.prismaService.product.count({
        where: { categoryId: id, isDeleted: false },
      }),
    ]);
    if (childCount > 0)
      throw new BadRequestException(
        'Danh mục còn danh mục con — xoá hoặc di chuyển chúng trước',
      );
    if (productCount > 0)
      throw new BadRequestException(
        'Danh mục còn sản phẩm — di chuyển sản phẩm trước',
      );

    const category = await this.prismaService.category.update({
      where: { id },
      data: {
        isDeleted: true,
        slug: `deleted-${existing.slug}-${Date.now()}`,
        deletedAt: new Date(),
      },
    });
    return category;
  }

  private async ensureNoCycle(id: string, newParentId: string): Promise<void> {
    let currentId: string | null = newParentId;
    while (currentId) {
      if (currentId === id) {
        throw new BadRequestException(
          'Không thể chọn chính nó hoặc con/cháu của nó làm danh mục cha',
        );
      }
      const node = await this.prismaService.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = node?.parentId ?? null;
    }
  }
}
