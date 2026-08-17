import { Module } from '@nestjs/common';
import { buildLoggerOptions, CommonModule } from '@app/shared';
import { LoggerModule } from 'nestjs-pino';
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
    LoggerModule.forRoot(buildLoggerOptions('product-service')),
  ],
  controllers: [],
  providers: [],
})
export class ProductServiceModule {}
