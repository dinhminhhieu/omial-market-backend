import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../dto/api-response.dto';
import { PaginationMetaDto } from '../dto/pagination-meta.dto';

interface ApiSuccessResponseOptions {
  status?: HttpStatus;
  description?: string;
  isArray?: boolean;
}

/**
 * Khai báo response thành công cho Swagger, dùng kèm shape envelope chung.
 *
 * Ví dụ:
 *   @ApiSuccessResponse(LevelDto)             → data là 1 LevelDto
 *   @ApiSuccessResponse(LevelDto, { isArray: true }) → data là LevelDto[]
 *   @ApiSuccessResponse()                     → không có data type cụ thể
 *
 * Lưu ý: response lỗi KHÔNG được document trên Swagger (FE chỉ cần biết
 * shape success + enum). Runtime error envelope vẫn do `HttpExceptionFilter`
 * trả về thống nhất: `{ success: false, statusCode, message, errors, path, timestamp }`.
 */
export const ApiSuccessResponse = <TModel extends Type<unknown>>(
  model?: TModel,
  options: ApiSuccessResponseOptions = {},
) => {
  const { status = HttpStatus.OK, description = 'Success', isArray } = options;

  const dataSchema = model
    ? isArray
      ? { type: 'array', items: { $ref: getSchemaPath(model) } }
      : { $ref: getSchemaPath(model) }
    : { type: 'object', nullable: true };

  return applyDecorators(
    ApiExtraModels(ApiSuccessResponseDto, ...(model ? [model] : [])),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponseDto) },
          { properties: { data: dataSchema } },
        ],
      },
    }),
  );
};

/**
 * Khai báo response cho endpoint phân trang: `data` có shape
 * `{ items: T[], meta: PaginationMetaDto }`.
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  options: { status?: HttpStatus; description?: string } = {},
) => {
  const { status = HttpStatus.OK, description = 'Success' } = options;
  return applyDecorators(
    ApiExtraModels(ApiSuccessResponseDto, PaginationMetaDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponseDto) },
          {
            properties: {
              data: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  },
                  meta: { $ref: getSchemaPath(PaginationMetaDto) },
                },
              },
            },
          },
        ],
      },
    }),
  );
};
