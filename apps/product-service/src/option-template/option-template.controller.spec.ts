import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OptionTemplateController } from './option-template.controller';
import { OptionTemplateService } from './option-template.service';

describe('OptionTemplateController', () => {
  let controller: OptionTemplateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OptionTemplateController],
      providers: [
        { provide: PrismaService, useValue: {} },
        OptionTemplateService,
      ],
    }).compile();

    controller = module.get<OptionTemplateController>(OptionTemplateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
