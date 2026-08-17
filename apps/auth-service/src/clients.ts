/**
 * Token DI cho ClientProxy RMQ mà auth-service dùng để PHÁT event.
 * (auth vốn là service thuần nhận RPC; đây là lần đầu nó chủ động gửi đi.)
 */
export const NOTIFICATION_CLIENT = 'NOTIFICATION_CLIENT';
