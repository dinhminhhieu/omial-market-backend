import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OptionTemplateService } from './option-template.service';

describe('OptionTemplateService', () => {
  let service: OptionTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: {} },
        OptionTemplateService,
      ],
    }).compile();

    service = module.get<OptionTemplateService>(OptionTemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
