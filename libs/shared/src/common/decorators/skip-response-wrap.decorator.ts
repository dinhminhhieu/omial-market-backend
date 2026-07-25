import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_WRAP = 'skipResponseWrap';

/**
 * Bỏ qua việc bọc envelope của `ResponseInterceptor` cho handler này —
 * dùng khi cần trả raw (file download, stream, redirect, health-check thô...).
 *
 * @example
 * ```ts
 * @SkipResponseWrap()
 * @Get('export')
 * exportCsv(@Res() res: Response) { ... }
 * ```
 */
export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP, true);
