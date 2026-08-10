import { Controller } from '@nestjs/common';
import { OptionTemplateService } from './option-template.service';
import { OPTION_TEMPLATE_PATTERNS } from '@app/event-contracts/patterns/product-service/option-template.patterns';
import {
  CreateOptionTemplateDto,
  OptionTemplateResponseDto,
  UpdateOptionTemplateDto,
} from '@app/event-contracts';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaginationMetaDto, PaginationQueryDto } from '@app/shared';

@Controller()
export class OptionTemplateController {
  constructor(private readonly optionTemplateService: OptionTemplateService) {}

  @MessagePattern(OPTION_TEMPLATE_PATTERNS.CREATE)
  create(@Payload() dto: CreateOptionTemplateDto) {
    return this.optionTemplateService.create(dto);
  }

  @MessagePattern(OPTION_TEMPLATE_PATTERNS.FIND_ALL)
  findAll(@Payload() query: PaginationQueryDto) {
    return this.optionTemplateService.findAll(query);
  }

  @MessagePattern(OPTION_TEMPLATE_PATTERNS.FIND_ONE)
  findOne(@Payload() id: string) {
    return this.optionTemplateService.findOne(id);
  }

  @MessagePattern(OPTION_TEMPLATE_PATTERNS.UPDATE)
  update(@Payload() dto: UpdateOptionTemplateDto) {
    return this.optionTemplateService.update(dto);
  }

  @MessagePattern(OPTION_TEMPLATE_PATTERNS.DELETE)
  delete(@Payload() id: string) {
    return this.optionTemplateService.delete(id);
  }
}
