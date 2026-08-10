import { Controller } from '@nestjs/common';
import { LabelService } from './label.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LABEL_PATTERNS } from '@app/event-contracts/patterns/product-service/label.patterns';
import { CreateLabelDto, UpdateLabelDto } from '@app/event-contracts';
import { PaginationQueryDto } from '@app/shared';

@Controller()
export class LabelController {
  constructor(private readonly labelService: LabelService) {}

  @MessagePattern(LABEL_PATTERNS.CREATE)
  create(@Payload() dto: CreateLabelDto) {
    return this.labelService.create(dto);
  }

  @MessagePattern(LABEL_PATTERNS.FIND_ALL)
  findAll(@Payload() query: PaginationQueryDto) {
    return this.labelService.findAll(query);
  }

  @MessagePattern(LABEL_PATTERNS.FIND_ONE)
  findOne(@Payload() id: string) {
    return this.labelService.findOne(id);
  }

  @MessagePattern(LABEL_PATTERNS.UPDATE)
  update(@Payload() dto: UpdateLabelDto) {
    return this.labelService.update(dto);
  }

  @MessagePattern(LABEL_PATTERNS.DELETE)
  delete(@Payload() id: string) {
    return this.labelService.delete(id);
  }
}
