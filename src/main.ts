import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { LoggerService, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import {
  WINSTON_MODULE_NEST_PROVIDER,
  WINSTON_MODULE_PROVIDER,
} from 'nest-winston';
import { Logger } from 'winston';
import helmet from 'helmet';
// import { AllExceptionFilter } from './common/filters/all-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Security middleware - helmet helps secure Express apps by setting HTTP response headers
  app.use(
    helmet({
      // Content Security Policy - helps prevent XSS attacks
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
        },
      },
      // Prevents clickjacking by setting X-Frame-Options
      frameguard: { action: 'deny' },
      // Hides X-Powered-By header
      hidePoweredBy: true,
      // Enforces HTTPS connections (enable in production with valid SSL)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      // Prevents MIME type sniffing
      noSniff: true,
      // Disables DNS prefetching
      dnsPrefetchControl: { allow: false },
      // Sets Referrer-Policy header
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // Use Winston logger
  const nestLogger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(nestLogger);

  const winstonLogger = app.get<Logger>(WINSTON_MODULE_PROVIDER);
  app.useGlobalFilters(new AllExceptionsFilter(winstonLogger));
  app.useGlobalInterceptors(new TransformInterceptor(winstonLogger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown properties
      forbidNonWhitelisted: true, // throws error for unknown properties
      transform: true, // automatically converts types (like string -> number)
    }),
  );

  nestLogger.log('Application is starting...', 'Bootstrap');

  await app.listen(process.env.PORT ?? 5000, '0.0.0.0');

  nestLogger.log(
    `Application is running successfully on: ${await app.getUrl()}`,
    'Bootstrap',
  );
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
});
