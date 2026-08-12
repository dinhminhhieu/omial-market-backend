import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { PresignUploadResponseDto } from './dto/presign-upload-response.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign-upload')
  @ApiOperation({
    summary: 'Xin presigned URL để upload ảnh trực tiếp lên MinIO/S3',
  })
  @ApiCreatedResponse({ type: PresignUploadResponseDto })
  presignUpload(
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResponseDto> {
    return this.mediaService.presignUpload(dto);
  }
}
