import { RpcException } from '@nestjs/microservices';
import { InternalAuthGuard } from './internal-auth.guard';

const makeRpcContext = (headers?: Record<string, unknown>) =>
  ({
    getType: () => 'rpc',
    switchToRpc: () => ({
      getContext: () => ({
        getMessage: () => ({ properties: { headers } }),
      }),
    }),
  }) as any;

const httpContext = { getType: () => 'http' } as any;

describe('InternalAuthGuard', () => {
  const guard = new InternalAuthGuard();
  const OLD_ENV = process.env.INTERNAL_SERVICE_TOKEN;

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_TOKEN = 'secret-xin-chao';
  });
  afterAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = OLD_ENV;
  });

  it('context HTTP (gateway) → bỏ qua hoàn toàn', () => {
    expect(guard.canActivate(httpContext)).toBe(true);
  });

  it('chưa cấu hình INTERNAL_SERVICE_TOKEN → không bật kiểm tra (dev/test chạy được)', () => {
    delete process.env.INTERNAL_SERVICE_TOKEN;
    expect(guard.canActivate(makeRpcContext())).toBe(true);
  });

  it('message KHÔNG có header → chặn', () => {
    expect(() => guard.canActivate(makeRpcContext({}))).toThrow(RpcException);
  });

  it('token SAI → chặn', () => {
    expect(() =>
      guard.canActivate(makeRpcContext({ 'x-internal-token': 'gia-mao' })),
    ).toThrow(/không đến từ nguồn tin cậy/);
  });

  it('token ĐÚNG → cho qua', () => {
    expect(
      guard.canActivate(
        makeRpcContext({ 'x-internal-token': 'secret-xin-chao' }),
      ),
    ).toBe(true);
  });

  it('lỗi mang statusCode 401 để gateway map đúng HTTP status', () => {
    try {
      guard.canActivate(makeRpcContext({}));
      fail('phải ném lỗi');
    } catch (e) {
      expect((e as RpcException).getError()).toEqual(
        expect.objectContaining({ statusCode: 401 }),
      );
    }
  });
});
