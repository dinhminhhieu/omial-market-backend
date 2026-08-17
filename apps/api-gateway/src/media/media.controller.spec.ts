import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

describe('MediaController', () => {
  let controller: MediaController;
  let service: jest.Mocked<MediaService>;

  beforeEach(async () => {
    const mockMediaService = {
      presignUpload: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    service = module.get(MediaService);
  });

  it('gọi presignUpload từ MediaService', async () => {
    const mockResponse = {
      uploadUrl: 'http://localhost:9000/upload-url',
      key: 'products/file.jpg',
      publicUrl: 'http://localhost:9000/public/products/file.jpg',
      expiresIn: 600,
    };

    service.presignUpload.mockResolvedValue(mockResponse);

    const dto = { fileName: 'file.jpg', contentType: 'image/jpeg' };
    const res = await controller.presignUpload(dto);

    expect(service.presignUpload).toHaveBeenCalledWith(dto);
    expect(res).toEqual(mockResponse);
  });
});
