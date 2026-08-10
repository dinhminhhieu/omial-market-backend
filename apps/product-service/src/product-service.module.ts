import { Module } from '@nestjs/common';
import { CommonModule } from '@app/shared';
import { PrismaModule } from './prisma/prisma.module';
import { ProductModule } from './product/product.module';
import { LabelModule } from './label/label.module';
import { BrandModule } from './brand/brand.module';
import { CategoryModule } from './category/category.module';
import { OptionTemplateModule } from './option-template/option-template.module';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    ProductModule,
    LabelModule,
    BrandModule,
    CategoryModule,
    OptionTemplateModule,
  ],
  controllers: [],
  providers: [],
})
export class ProductServiceModule {}
