import { Controller } from '@nestjs/common';
import { CategoryService } from './category.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CATEGORY_PATTERNS } from '@app/event-contracts/patterns/product-service/category.patterns';
import { CreateCategoryDto, UpdateCategoryDto } from '@app/event-contracts';
import { PaginationQueryDto } from '@app/shared';

@Controller()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @MessagePattern(CATEGORY_PATTERNS.CREATE)
  create(@Payload() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @MessagePattern(CATEGORY_PATTERNS.FIND_ALL)
  findAll(@Payload() query: PaginationQueryDto) {
    return this.categoryService.findAll(query);
  }

  @MessagePattern(CATEGORY_PATTERNS.FIND_ONE)
  findOne(@Payload() id: string) {
    return this.categoryService.findOne(id);
  }

  @MessagePattern(CATEGORY_PATTERNS.UPDATE)
  update(@Payload() updateCategoryDto: UpdateCategoryDto) {
    return this.categoryService.update(updateCategoryDto);
  }

  @MessagePattern(CATEGORY_PATTERNS.DELETE)
  delete(@Payload() id: string) {
    return this.categoryService.delete(id);
  }
}
