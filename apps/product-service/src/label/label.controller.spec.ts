import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { LabelController } from './label.controller';
import { LabelService } from './label.service';

describe('LabelController', () => {
  let controller: LabelController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LabelController],
      providers: [{ provide: PrismaService, useValue: {} }, LabelService],
    }).compile();

    controller = module.get<LabelController>(LabelController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
