import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

const makeContext = (headers: Record<string, string> = {}) => {
  const request: any = { headers };
  return {
    request,
    ctx: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any,
  };
};

describe('JwtAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let jwt: { verifyAsync: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    jwt = { verifyAsync: jest.fn() };
    guard = new JwtAuthGuard(reflector as any, jwt as any);
  });

  it('route @Public() → cho qua, KHÔNG cần token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { ctx } = makeContext();

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('thiếu header Authorization → 401', async () => {
    const { ctx } = makeContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('scheme không phải Bearer → 401 (không verify)', async () => {
    const { ctx } = makeContext({ authorization: 'Basic abc123' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Thiếu access token/);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('token sai chữ ký / hết hạn → 401 với message CHUNG (không lộ lý do)', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const { ctx } = makeContext({ authorization: 'Bearer token-hong' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /không hợp lệ hoặc đã hết hạn/,
    );
  });

  it('token hợp lệ → gắn request.user, chuẩn hoá role (chuỗi) thành roles (mảng)', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      role: 'ADMIN',
    });
    const { ctx, request } = makeContext({ authorization: 'Bearer good' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual({
      sub: 'u1',
      email: 'a@b.com',
      roles: ['ADMIN'],
    });
  });

  it('token không có role → roles = [] (không undefined, RolesGuard đọc an toàn)', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1' });
    const { ctx, request } = makeContext({ authorization: 'Bearer good' });

    await guard.canActivate(ctx);
    expect(request.user.roles).toEqual([]);
  });

  it('chấp nhận "bearer" viết thường (header không phân biệt hoa thường)', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1' });
    const { ctx } = makeContext({ authorization: 'bearer good' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
