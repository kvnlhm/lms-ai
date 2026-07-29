import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ERROR_CODES } from '@lms/contracts';

export class ResponseMetaDto {
  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class PaginatedMetaDto extends ResponseMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 125 })
  total!: number;

  @ApiProperty({ example: 7 })
  totalPages!: number;
}

export class ApiErrorBodyDto {
  @ApiProperty({ enum: ERROR_CODES })
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
  })
  fields?: Record<string, string[]>;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class ApiErrorDto {
  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}

/**
 * Mendokumentasikan amplop `{ data, meta }` untuk satu objek.
 *
 * Interceptor membungkus respons di runtime, jadi tanpa dekorator ini dokumen
 * OpenAPI akan menggambarkan bentuk yang tidak pernah benar-benar dikirim dan
 * client hasil generate tidak akan bertipe (ADR-009).
 */
export const ApiEnvelope = <T extends Type<unknown>>(model: T, description?: string) =>
  applyDecorators(
    ApiExtraModels(ResponseMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { $ref: getSchemaPath(model) },
          meta: { $ref: getSchemaPath(ResponseMetaDto) },
        },
      },
    }),
  );

/** Varian daftar berhalaman: `data` berupa array dan `meta` memuat paginasi. */
export const ApiEnvelopeList = <T extends Type<unknown>>(model: T, description?: string) =>
  applyDecorators(
    ApiExtraModels(PaginatedMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginatedMetaDto) },
        },
      },
    }),
  );

/** Varian daftar tanpa paginasi. */
export const ApiEnvelopeArray = <T extends Type<unknown>>(model: T, description?: string) =>
  applyDecorators(
    ApiExtraModels(ResponseMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(ResponseMetaDto) },
        },
      },
    }),
  );

/** Mendaftarkan status error yang mungkin dikembalikan sebuah endpoint. */
export const ApiErrors = (...statuses: number[]) =>
  applyDecorators(
    ApiExtraModels(ApiErrorDto),
    ...statuses.map((status) =>
      ApiResponse({ status, schema: { $ref: getSchemaPath(ApiErrorDto) } }),
    ),
  );
