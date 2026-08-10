import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLabelDto,
  LabelResponseDto,
  UpdateLabelDto,
} from '@app/event-contracts';
import {
  buildPaginationMeta,
  PaginationMetaDto,
  PaginationQueryDto,
  parsePaginationQuery,
} from '@app/shared';

@Injectable()
export class LabelService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabelDto): Promise<{
    data: LabelResponseDto;
    message: string;
  }> {
    const label = await this.prisma.label.create({ data: dto });
    return { data: label, message: 'Tạo nhãn thành công' };
  }

  async findAll(query: PaginationQueryDto): Promise<{
    items: LabelResponseDto[];
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
      this.prisma.label.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.label.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(totalResults, pageIndex, pageLimit),
    };
  }

  async findOne(id: string): Promise<LabelResponseDto> {
    const label = await this.prisma.label.findUnique({
      where: { id },
    });

    if (!label) {
      throw new NotFoundException(`Không tìm thấy nhãn hoặc đã bị xoá`);
    }
    return label;
  }

  async update(dto: UpdateLabelDto): Promise<LabelResponseDto> {
    await this.findOne(dto.id);

    const label = await this.prisma.label.update({
      where: { id: dto.id },
      data: dto,
    });
    return label;
  }

  async delete(id: string): Promise<LabelResponseDto> {
    await this.findOne(id);

    const label = await this.prisma.label.delete({
      where: { id },
    });
    return label;
  }
}
