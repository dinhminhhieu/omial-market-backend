import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { LabelService } from './label.service';

describe('LabelService', () => {
  let service: LabelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: PrismaService, useValue: {} }, LabelService],
    }).compile();

    service = module.get<LabelService>(LabelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
