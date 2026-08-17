import { MediaService } from './media.service';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('MediaService', () => {
  let service: MediaService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'http://localhost:9000/omial-media/products/test-file.jpg?X-Amz-Signature=xxx',
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('tạo presigned upload URL thành công với mặc định env', async () => {
    delete process.env.MEDIA_BUCKET;
    delete process.env.MEDIA_PUBLIC_URL;

    service = new MediaService();

    const result = await service.presignUpload({
      fileName: 'avatar.png',
      contentType: 'image/png',
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(PutObjectCommand),
      {
        expiresIn: 600,
        signableHeaders: new Set(['content-type']),
      },
    );

    expect(result.uploadUrl).toBe(
      'http://localhost:9000/omial-media/products/test-file.jpg?X-Amz-Signature=xxx',
    );
    expect(result.key).toMatch(/^products\/[a-f0-9-]+.png$/);
    expect(result.publicUrl).toMatch(
      /^http:\/\/localhost:9000\/omial-media\/products\/[a-f0-9-]+.png$/,
    );
    expect(result.expiresIn).toBe(600);
  });

  it('sử dụng custom env MEDIA_BUCKET và MEDIA_PUBLIC_URL khi được khai báo', async () => {
    process.env.MEDIA_BUCKET = 'custom-bucket';
    process.env.MEDIA_PUBLIC_URL = 'https://cdn.omial.vn';

    service = new MediaService();

    const result = await service.presignUpload({
      fileName: 'banner.webp',
      contentType: 'image/webp',
    });

    expect(result.key).toMatch(/^products\/[a-f0-9-]+.webp$/);
    expect(result.publicUrl).toMatch(
      /^https:\/\/cdn.omial.vn\/custom-bucket\/products\/[a-f0-9-]+.webp$/,
    );
  });

  it('gán đuôi file mặc định .jpg nếu fileName không có extension', async () => {
    service = new MediaService();

    const result = await service.presignUpload({
      fileName: 'no-extension-file',
      contentType: 'image/jpeg',
    });

    expect(result.key).toMatch(/^products\/[a-f0-9-]+.jpg$/);
  });
});
