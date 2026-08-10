import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOptionTemplateDto,
  OptionTemplateResponseDto,
  UpdateOptionTemplateDto,
} from '@app/event-contracts';
import {
  buildPaginationMeta,
  PaginationMetaDto,
  PaginationQueryDto,
  parsePaginationQuery,
} from '@app/shared';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class OptionTemplateService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(dto: CreateOptionTemplateDto): Promise<{
    data: OptionTemplateResponseDto;
    message: string;
  }> {
    const existingOptionTemplate =
      await this.prismaService.optionTemplate.findUnique({
        where: { name: dto.name },
      });

    if (existingOptionTemplate) {
      throw new BadRequestException('Mẫu tùy chọn đã tồn tại');
    }

    this.assertValid(dto.minSelect, dto.maxSelect, dto.optionTemplateItems);

    const optionTemplate = await this.prismaService.optionTemplate.create({
      data: {
        ...dto,
        optionTemplateItems: { create: dto.optionTemplateItems },
      },
      include: { optionTemplateItems: true },
    });
    return {
      data: this.toResponse(optionTemplate),
      message: 'Tạo mẫu tùy chọn thành công',
    };
  }

  async findAll(query: PaginationQueryDto): Promise<{
    items: OptionTemplateResponseDto[];
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
      this.prismaService.optionTemplate.findMany({
        where,
        skip,
        take,
        include: { optionTemplateItems: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prismaService.optionTemplate.count({ where }),
    ]);
    return {
      items: items.map((t) => this.toResponse(t)),
      meta: buildPaginationMeta(totalResults, pageIndex, pageLimit),
    };
  }

  async findOne(id: string): Promise<OptionTemplateResponseDto> {
    const optionTemplate = await this.prismaService.optionTemplate.findUnique({
      where: { id },
      include: { optionTemplateItems: true },
    });

    if (!optionTemplate) {
      throw new NotFoundException('Mẫu tùy chọn không tồn tại');
    }
    return this.toResponse(optionTemplate);
  }

  async update(
    dto: UpdateOptionTemplateDto,
  ): Promise<OptionTemplateResponseDto> {
    const { id, optionTemplateItems, ...data } = dto;

    await this.findOne(id);

    if (data.name) {
      const duplicateName = await this.prismaService.optionTemplate.findFirst({
        where: { name: data.name, id: { not: id } }, // findFirst vì có điều kiện `not`
      });
      if (duplicateName)
        throw new BadRequestException('Tên mẫu tùy chọn đã tồn tại');
    }

    const optionTemplate = await this.prismaService.optionTemplate.update({
      where: { id },
      data: {
        ...data,
        ...(optionTemplateItems && {
          optionTemplateItems: {
            deleteMany: {},
            create: optionTemplateItems,
          },
        }),
      },
      include: { optionTemplateItems: true },
    });
    return this.toResponse(optionTemplate);
  }

  async delete(id: string): Promise<OptionTemplateResponseDto> {
    await this.findOne(id);

    const optionTemplate = await this.prismaService.optionTemplate.delete({
      where: { id },
      include: { optionTemplateItems: true }, // (1) để response có items
    });
    return this.toResponse(optionTemplate); // (2) Decimal → number
  }

  private toResponse(
    t: Prisma.OptionTemplateGetPayload<{
      include: { optionTemplateItems: true };
    }>,
  ): OptionTemplateResponseDto {
    return {
      ...t,
      optionTemplateItems: t.optionTemplateItems.map((i) => ({
        ...i,
        extraPrice: Number(i.extraPrice),
      })),
    };
  }

  private assertValid(
    minSelect: number | undefined,
    maxSelect: number | null | undefined,
    items: Array<{ isDefault?: boolean; status?: boolean }>,
  ): void {
    const min = minSelect ?? 0;
    const max = maxSelect ?? null;

    if (max != null && min > max)
      throw new BadRequestException(
        'Số lượng tối thiểu không được lớn hơn số lượng tối đa',
      );

    if (min > items.length)
      throw new BadRequestException(
        'Số lượng tối thiểu không được lớn hơn số lượng option',
      );

    const defaults = items.filter((i) => i.isDefault);
    if (max != null && defaults.length > max)
      throw new BadRequestException(
        'Số option mặc định vượt quá số lượng tối đa',
      );

    // Chỉ product-option (item có status):
    if (defaults.some((i) => i.status === false))
      throw new BadRequestException('Không thể đặt mặc định cho item đang tắt');
  }
}
