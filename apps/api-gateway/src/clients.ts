/**
 * Token DI cho các ClientProxy (kết nối RabbitMQ tới từng service).
 * Tách ra file riêng để cả module (đăng ký) và controller (inject) cùng dùng,
 * tránh import vòng.
 */
export const AUTH_CLIENT = 'AUTH_CLIENT';
