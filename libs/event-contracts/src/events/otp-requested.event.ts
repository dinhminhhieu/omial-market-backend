import {
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { OtpPurpose } from '../enums/otp-purpose.enum';

/**
 * Payload event `otp.requested`.
 *
 * Vì sao OTP nằm TRONG event: OTP do auth-service sinh và lưu Redis của RIÊNG nó.
 * notification-service không đọc được Redis đó (database/state per service), nên
 * auth phải gửi kèm mã trong payload để notification có cái mà gửi đi.
 *
 * ENVELOPE chuẩn của mọi event — `eventId` + `occurredAt`:
 * - `eventId`: định danh DUY NHẤT của event này. Chưa dùng ở bước 7.2, nhưng
 *   7.4 (idempotency) sẽ dựa vào nó để consumer bỏ qua event nhận trùng
 *   (RabbitMQ giao "ít nhất 1 lần" → đôi khi hơn 1 lần). Đặt sẵn từ đầu để
 *   không phải sửa lại contract sau.
 * - `occurredAt`: thời điểm sự việc xảy ra (theo đồng hồ bên PHÁT). Hữu ích cho
 *   audit + sắp xếp, và để biết event "cũ" tới mức nào khi xử lý trễ.
 */
export class OtpRequestedEvent {
  @IsUUID('4')
  eventId: string;

  @IsISO8601()
  occurredAt: string;

  @IsEmail()
  email: string;

  @IsString()
  otp: string;

  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;

  @IsInt()
  @Min(1)
  expiresInMinutes: number;
}
