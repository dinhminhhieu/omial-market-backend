import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { OtpPurpose } from '@app/event-contracts';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('MailService', () => {
  let service: MailService;
  let mockTransporter: any;

  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    mockTransporter = {
      verify: jest.fn(),
      sendMail: jest.fn(),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Constructor & SMTP config', () => {
    it('không khởi tạo transporter nếu thiếu thông tin SMTP host/user/pass', () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      service = new MailService();
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('khởi tạo transporter thành công khi có đủ SMTP credentials', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_SECURE = 'true';

      service = new MailService();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: { user: 'user', pass: 'pass' },
      });
    });
  });

  describe('onModuleInit', () => {
    it('bỏ qua verify nếu chưa khởi tạo transporter', async () => {
      delete process.env.SMTP_HOST;
      service = new MailService();

      await service.onModuleInit();
      expect(mockTransporter.verify).not.toHaveBeenCalled();
    });

    it('verify thành công SMTP server', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';

      mockTransporter.verify.mockResolvedValue(true);
      service = new MailService();

      await service.onModuleInit();
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('xử lý thất bại khi verify SMTP server và đặt transporter về null', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';

      mockTransporter.verify.mockRejectedValue(new Error('Connect timeout'));
      service = new MailService();

      await service.onModuleInit();
      expect(mockTransporter.verify).toHaveBeenCalled();

      // Kiểm tra khi transporter bị set null, sendOtpEmail sẽ chạy vào mock mail
      await service.sendOtpEmail(
        'test@example.com',
        '123456',
        OtpPurpose.REGISTER,
        5,
      );
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('sendOtpEmail', () => {
    it('gửi email OTP với mục đích VERIFY_EMAIL/REGISTER', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.MAIL_FROM = 'noreply@omial.com';

      mockTransporter.sendMail.mockResolvedValue({});
      service = new MailService();

      await service.sendOtpEmail(
        'user@example.com',
        '654321',
        OtpPurpose.REGISTER,
        10,
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@omial.com',
          to: 'user@example.com',
          subject: 'Xác thực email - Omial Market',
          text: expect.stringContaining('654321'),
          html: expect.stringContaining('654321'),
        }),
      );
    });

    it('gửi email OTP với mục đích RESET_PASSWORD', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.MAIL_FROM = 'noreply@omial.com';

      mockTransporter.sendMail.mockResolvedValue({});
      service = new MailService();

      await service.sendOtpEmail(
        'user@example.com',
        '111222',
        OtpPurpose.RESET_PASSWORD,
        5,
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@omial.com',
          to: 'user@example.com',
          subject: 'Đặt lại mật khẩu - Omial Market',
          text: expect.stringContaining('111222'),
          html: expect.stringContaining('111222'),
        }),
      );
    });

    it('in log console mock email khi không có transporter', async () => {
      delete process.env.SMTP_HOST;
      service = new MailService();

      await service.sendOtpEmail(
        'user@example.com',
        '999888',
        OtpPurpose.REGISTER,
        5,
      );
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });
  });
});
