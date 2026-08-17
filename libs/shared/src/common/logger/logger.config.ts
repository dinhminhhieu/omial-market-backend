import { Params } from 'nestjs-pino';

export const buildLoggerOptions = (serviceName: string): Params => ({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: serviceName }, // mọi dòng log tự có "service"
    // Dev: đẹp mắt. Prod: JSON thuần cho máy đọc.
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'HH:MM:ss' },
          }
        : undefined,
    redact: ['req.headers.authorization', 'req.body.password', 'req.body.otp'], // quan trọng
    customProps: (req) => ({ traceId: req.id }), // chỗ cắm correlationId Phase 4
  },
});
