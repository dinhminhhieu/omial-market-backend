import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/metadata.constants';

/**
 * Đánh dấu route bỏ qua Auth guard để public.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
