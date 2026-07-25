import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { OtpPurpose } from '@app/event-contracts';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from = process.env.MAIL_FROM;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        // secure=true cho port 465 (SSL); false cho 587 (STARTTLS).
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        '⚠️  Chưa cấu hình SMTP — OTP sẽ được LOG ra console thay vì gửi email.',
      );
      return;
    }
    try {
      await this.transporter.verify();
      this.logger.log('✅ SMTP sẵn sàng gửi email');
    } catch (err) {
      this.logger.error(`SMTP verify thất bại: ${(err as Error).message}.`);
      this.transporter = null;
    }
  }

  /** Gửi OTP tới email. `expiresInMinutes` để nhắc user thời hạn. */
  async sendOtpEmail(
    to: string,
    otp: string,
    purpose: OtpPurpose,
    expiresInMinutes: number,
  ): Promise<void> {
    const { subject, intro } = this.buildContent(purpose);

    if (!this.transporter) {
      this.logger.warn(
        `📧 [MOCK MAIL] gửi tới ${to} | ${subject} | OTP=${otp} (hết hạn ${expiresInMinutes} phút)`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text: `${intro}\n\nMã OTP: ${otp}\nMã có hiệu lực trong ${expiresInMinutes} phút.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2>Omial Market</h2>
          <p>${intro}</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:6px">${otp}</p>
          <p>Mã có hiệu lực trong <b>${expiresInMinutes} phút</b>.</p>
          <p style="color:#888;font-size:12px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
        </div>`,
    });
    this.logger.log(`Đã gửi OTP (${purpose}) tới ${to}`);
  }

  /** Nội dung email theo mục đích OTP. */
  private buildContent(purpose: OtpPurpose): {
    subject: string;
    intro: string;
  } {
    if (purpose === OtpPurpose.RESET_PASSWORD) {
      return {
        subject: 'Đặt lại mật khẩu - Omial Market',
        intro: 'Dùng mã OTP dưới đây để đặt lại mật khẩu của bạn:',
      };
    }
    return {
      subject: 'Xác thực email - Omial Market',
      intro: 'Cảm ơn bạn đã đăng ký! Dùng mã OTP dưới đây để xác thực email:',
    };
  }
}
