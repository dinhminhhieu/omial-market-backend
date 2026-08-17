import { hasRole, isAdmin, ROLE_ADMIN } from './user-role.util';

describe('user-role.util', () => {
  it('isAdmin đúng khi roles chứa ADMIN', () => {
    expect(isAdmin({ sub: 'u1', roles: [ROLE_ADMIN] })).toBe(true);
  });

  it('isAdmin sai với user thường', () => {
    expect(isAdmin({ sub: 'u1', roles: ['USER'] })).toBe(false);
  });

  it('an toàn khi user undefined / thiếu roles', () => {
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin({ sub: 'u1' })).toBe(false);
    expect(isAdmin({ sub: 'u1', roles: [] })).toBe(false);
  });

  it('KHÔNG bị đánh lừa bởi field `role` (chuỗi) — chỉ đọc `roles`', () => {
    // Đây chính là bug đã gặp: token ký `role`, guard chuẩn hoá sang `roles`.
    expect(isAdmin({ sub: 'u1', role: 'ADMIN' } as any)).toBe(false);
  });

  it('hasRole dùng được với role bất kỳ', () => {
    expect(hasRole({ sub: 'u1', roles: ['SHIPPER'] }, 'SHIPPER')).toBe(true);
  });
});
