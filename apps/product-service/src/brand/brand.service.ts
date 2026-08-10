import {
  BrandResponseDto,
  CreateBrandDto,
  UpdateBrandDto,
} from '@app/event-contracts';
import {
  buildPaginationMeta,
  PaginationMetaDto,
  PaginationQueryDto,
  parsePaginationQuery,
} from '@app/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBrandDto): Promise<{
    data: BrandResponseDto;
    message: string;
  }> {
    const brand = await this.prisma.brand.create({
      data: dto,
    });
    return {
      data: brand,
      message: 'Đã tạo thương hiệu mới thành công',
    };
  }

  async findAll(query: PaginationQueryDto): Promise<{
    items: BrandResponseDto[];
    meta: PaginationMetaDto;
  }> {
    const { pageIndex, pageLimit, skip, take, search } =
      parsePaginationQuery(query);
    const where = {
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, totalResults] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(totalResults, pageIndex, pageLimit),
    };
  }

  async findOne(id: string): Promise<BrandResponseDto> {
    const brand = await this.prisma.brand.findUnique({
      where: {
        id,
      },
    });

    if (!brand) {
      throw new NotFoundException(`Không tìm thấy thương hiệu hoặc đã bị xoá`);
    }
    return brand;
  }

  async update(dto: UpdateBrandDto): Promise<BrandResponseDto> {
    await this.findOne(dto.id);

    const brand = await this.prisma.brand.update({
      where: { id: dto.id },
      data: dto,
    });
    return brand;
  }

  async delete(id: string): Promise<BrandResponseDto> {
    await this.findOne(id);

    const brand = await this.prisma.brand.delete({
      where: { id },
    });
    return brand;
  }
}
