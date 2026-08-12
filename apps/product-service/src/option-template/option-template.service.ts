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
import { assertOptionGroupValid } from '../common/option-group.validator';

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

    assertOptionGroupValid(
      dto.minSelect,
      dto.maxSelect,
      dto.optionTemplateItems,
      'Mẫu tùy chọn',
    );

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

    const current = await this.findOne(id);

    if (data.name) {
      const duplicateName = await this.prismaService.optionTemplate.findFirst({
        where: { name: data.name, id: { not: id } }, // findFirst vì có điều kiện `not`
      });
      if (duplicateName)
        throw new BadRequestException('Tên mẫu tùy chọn đã tồn tại');
    }

    // Field nào không gửi thì lấy giá trị hiện tại — invariant phải đúng với
    // TRẠNG THÁI SAU KHI UPDATE, không chỉ với phần payload gửi lên.
    assertOptionGroupValid(
      data.minSelect !== undefined ? data.minSelect : current.minSelect,
      data.maxSelect !== undefined ? data.maxSelect : current.maxSelect,
      optionTemplateItems ?? current.optionTemplateItems ?? [],
      'Mẫu tùy chọn',
    );

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
}
