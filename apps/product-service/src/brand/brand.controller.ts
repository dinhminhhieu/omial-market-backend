import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  BRAND_PATTERNS,
  CreateBrandDto,
  UpdateBrandDto,
} from '@app/event-contracts';
import { PaginationQueryDto } from '@app/shared';
import { BrandService } from './brand.service';

@Controller()
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @MessagePattern(BRAND_PATTERNS.CREATE)
  create(@Payload() createBrandDto: CreateBrandDto) {
    return this.brandService.create(createBrandDto);
  }

  @MessagePattern(BRAND_PATTERNS.FIND_ALL)
  findAll(@Payload() query: PaginationQueryDto) {
    return this.brandService.findAll(query);
  }

  @MessagePattern(BRAND_PATTERNS.FIND_ONE)
  async findOne(@Payload() id: string) {
    return this.brandService.findOne(id);
  }

  @MessagePattern(BRAND_PATTERNS.UPDATE)
  async update(@Payload() updateBrandDto: UpdateBrandDto) {
    return this.brandService.update(updateBrandDto);
  }

  @MessagePattern(BRAND_PATTERNS.DELETE)
  async delete(@Payload() id: string) {
    return this.brandService.delete(id);
  }
}
