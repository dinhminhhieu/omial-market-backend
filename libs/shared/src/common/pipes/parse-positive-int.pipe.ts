import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

/**
 * Ép giá trị param/query về số nguyên dương (> 0).
 * Ví dụ dùng cho `:id`: `@Param('id', ParsePositiveIntPipe) id: number`.
 */
@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(
        `"${metadata.data ?? 'value'}" phải là số nguyên dương`,
      );
    }

    return parsed;
  }
}
