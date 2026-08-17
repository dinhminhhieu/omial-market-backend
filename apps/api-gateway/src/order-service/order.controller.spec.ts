import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrderController } from './order.controller';
import { ORDER_CLIENT } from '../clients';
import { ORDER_PATTERNS } from '@app/event-contracts';
import { of } from 'rxjs';

// ⚠️ User giả PHẢI khớp shape mà JwtAuthGuard thật tạo ra: { sub, email?, roles: [] }.
// Token do auth-service ký mang `role` (chuỗi), guard chuẩn hoá thành `roles` (mảng)
// — dựng mock sai shape thì test xanh mà production sai.

describe('OrderController', () => {
  let controller: OrderController;
  let clientMock: { send: jest.Mock };

  beforeEach(async () => {
    clientMock = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: ORDER_CLIENT,
          useValue: clientMock,
        },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
  });

  describe('create', () => {
    it('đè customerId từ JWT user.sub', async () => {
      clientMock.send.mockReturnValue(of({ id: 'ord-1' }));
      const user: any = { sub: 'usr-123', roles: ['USER'] };
      const dto: any = { customerName: 'Test', items: [] };

      await controller.create(dto, user);

      expect(clientMock.send).toHaveBeenCalledWith(
        ORDER_PATTERNS.CREATE,
        expect.objectContaining({
          customerId: 'usr-123',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('khách hàng thường -> tự động lọc theo user.sub', async () => {
      clientMock.send.mockReturnValue(of({ data: [], meta: {} }));
      const user: any = { sub: 'usr-123', roles: ['USER'] };

      await controller.findAll({}, user);

      expect(clientMock.send).toHaveBeenCalledWith(
        ORDER_PATTERNS.FIND_ALL,
        expect.objectContaining({
          customerId: 'usr-123',
        }),
      );
    });

    it('ADMIN -> giữ nguyên customerId từ query', async () => {
      clientMock.send.mockReturnValue(of({ data: [], meta: {} }));
      const user: any = { sub: 'admin-1', roles: ['ADMIN'] };

      await controller.findAll({ customerId: 'usr-456' }, user);

      expect(clientMock.send).toHaveBeenCalledWith(
        ORDER_PATTERNS.FIND_ALL,
        expect.objectContaining({
          customerId: 'usr-456',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('khách hàng xem đơn của chính mình -> OK', async () => {
      const order = { id: 'ord-1', customerId: 'usr-123' };
      clientMock.send.mockReturnValue(of(order));
      const user: any = { sub: 'usr-123', roles: ['USER'] };

      const res = await controller.findOne('ord-1', user);
      expect(res).toEqual(order);
    });

    it('khách hàng xem đơn người khác -> ForbiddenException', async () => {
      const order = { id: 'ord-1', customerId: 'usr-other' };
      clientMock.send.mockReturnValue(of(order));
      const user: any = { sub: 'usr-123', roles: ['USER'] };

      await expect(controller.findOne('ord-1', user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('ADMIN xem đơn người khác -> OK', async () => {
      const order = { id: 'ord-1', customerId: 'usr-other' };
      clientMock.send.mockReturnValue(of(order));
      const user: any = { sub: 'admin-1', roles: ['ADMIN'] };

      const res = await controller.findOne('ord-1', user);
      expect(res).toEqual(order);
    });
  });
});
