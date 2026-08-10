import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Tên hiển thị tối đa 50 ký tự' })
  @Transform(({ value }) => value?.trim())
  fullName: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  @Matches(/(?=.*[A-Z])/, { message: 'Mật khẩu phải có ít nhất 1 chữ hoa' })
  @Matches(/(?=.*[0-9])/, { message: 'Mật khẩu phải có ít nhất 1 chữ số' })
  password: string;
}
