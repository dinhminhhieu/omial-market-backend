import { Test, TestingModule } from '@nestjs/testing';
import { OptionTemplateService } from './option-template.service';

describe('OptionTemplateService', () => {
  let service: OptionTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OptionTemplateService],
    }).compile();

    service = module.get<OptionTemplateService>(OptionTemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
