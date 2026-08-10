import { Module } from '@nestjs/common';
import { OptionTemplateService } from './option-template.service';
import { OptionTemplateController } from './option-template.controller';

@Module({
  controllers: [OptionTemplateController],
  providers: [OptionTemplateService],
})
export class OptionTemplateModule {}
