import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';

const makeJwtMock = () => ({
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
});

const makeRedisMock = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  ttl: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
});

const makePrismaMock = () => ({
  user: { findUnique: jest.fn() },
});

const userRow = (over: Partial<any> = {}) => ({
  id: 'u1',
  email: 'a@b.com',
  role: 'USER',
  isActive: true,
  ...over,
});

describe('TokenService', () => {
  let jwt: ReturnType<typeof makeJwtMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: TokenService;

  beforeEach(() => {
    jwt = makeJwtMock();
    redis = makeRedisMock();
    prisma = makePrismaMock();
    service = new TokenService(jwt as any, redis as any, prisma as any);
    jwt.signAsync.mockResolvedValue('signed-token');
  });

  describe('issueTokens', () => {
    it('access token KHÔNG lưu server, refresh token có lưu key Redis kèm TTL', async () => {
      const tokens = await service.issueTokens(userRow());

      expect(tokens).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
      // đúng 1 key refresh được lưu (access thì stateless)
      expect(redis.set).toHaveBeenCalledTimes(1);
      const [key, value, ttl] = redis.set.mock.calls[0];
      expect(key).toMatch(/^refresh:u1:[0-9a-f-]{36}$/); // jti là uuid
      expect(value).toBe('1');
      expect(ttl).toBe(604800);
    });

    it('refresh token ký bằng SECRET RIÊNG, khác access token', async () => {
      await service.issueTokens(userRow());

      const [accessPayload, accessOpts] = jwt.signAsync.mock.calls[0];
      const [refreshPayload, refreshOpts] = jwt.signAsync.mock.calls[1];

      expect(accessPayload).toEqual({
        sub: 'u1',
        email: 'a@b.com',
        role: 'USER',
      });
      expect(accessOpts).toBeUndefined(); // dùng secret mặc định của JwtModule
      expect(refreshPayload).toEqual(
        expect.objectContaining({ sub: 'u1', jti: expect.any(String) }),
      );
      expect(refreshOpts.secret).toBeDefined();
      expect(refreshOpts.expiresIn).toBe(604800);
    });
  });

  describe('rotate', () => {
    it('token không verify được → Unauthorized', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));
      await expect(service.rotate('rác')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('key đã bị xoá (dùng lại token cũ) → Unauthorized "đã bị thu hồi"', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', jti: 'old-jti' });
      redis.exists.mockResolvedValue(false);

      await expect(service.rotate('token-cu')).rejects.toThrow(/thu hồi/);
    });

    it('rotation: XOÁ jti cũ rồi cấp cặp mới', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', jti: 'old-jti' });
      redis.exists.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(userRow());

      const tokens = await service.rotate('token-cu');

      expect(redis.del).toHaveBeenCalledWith('refresh:u1:old-jti');
      expect(tokens.accessToken).toBe('signed-token');
      // key mới được set (jti khác cái cũ)
      expect(redis.set.mock.calls[0][0]).not.toBe('refresh:u1:old-jti');
    });

    it('user bị khoá (isActive false) → Unauthorized', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', jti: 'j' });
      redis.exists.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(userRow({ isActive: false }));

      await expect(service.rotate('t')).rejects.toThrow(/khoá/);
    });
  });

  describe('revoke', () => {
    it('xoá key tương ứng', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', jti: 'j1' });
      await service.revoke('t');
      expect(redis.del).toHaveBeenCalledWith('refresh:u1:j1');
    });

    it('token rác → im lặng bỏ qua (idempotent, không ném lỗi)', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad'));
      await expect(service.revoke('rác')).resolves.toBeUndefined();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('revokeAll', () => {
    it('quét mọi key của user rồi xoá hết (dùng sau khi đổi mật khẩu)', async () => {
      redis.keys.mockResolvedValue(['refresh:u1:a', 'refresh:u1:b']);

      await service.revokeAll('u1');

      expect(redis.keys).toHaveBeenCalledWith('refresh:u1:*');
      expect(redis.del).toHaveBeenCalledWith('refresh:u1:a', 'refresh:u1:b');
    });
  });
});
