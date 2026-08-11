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
import { setupScalarDocs } from './common/config/scalar.config';
// import { AllExceptionFilter } from './common/filters/all-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Winston logger
  const nestLogger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(nestLogger);

  const winstonLogger = app.get<Logger>(WINSTON_MODULE_PROVIDER);
  app.useGlobalFilters(new AllExceptionsFilter(winstonLogger));
  app.useGlobalInterceptors(new TransformInterceptor(winstonLogger));

  // Check environment for API documentation setup
  const isProduction = process.env.NODE_ENV === 'production';
  const enableDocs = process.env.ENABLE_API_DOCS !== 'false'; // Default to true

  // Local clients may run from any development origin.
  if (!isProduction) {
    app.enableCors({
      origin: '*',
      credentials: true,
    });
  }

  // Security middleware - helmet helps secure Express apps by setting HTTP response headers.
  // Scalar API Reference needs inline script/style permissions for its browser UI.
  const helmetConfig =
    !isProduction || enableDocs
      ? {
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdn.jsdelivr.net',
              ],
              imgSrc: ["'self'", 'data:', 'https:'],
              scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                'https://cdn.jsdelivr.net',
              ],
            },
          },
          frameguard: { action: 'deny' as const },
          hidePoweredBy: true,
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          },
          noSniff: true,
          dnsPrefetchControl: { allow: false },
          referrerPolicy: {
            policy: 'strict-origin-when-cross-origin' as const,
          },
        }
      : {
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdn.jsdelivr.net',
              ],
              imgSrc: ["'self'", 'data:', 'https:'],
              scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
            },
          },
          frameguard: { action: 'deny' as const },
          hidePoweredBy: true,
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          },
          noSniff: true,
          dnsPrefetchControl: { allow: false },
          referrerPolicy: {
            policy: 'strict-origin-when-cross-origin' as const,
          },
        };

  app.use(helmet(helmetConfig));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown properties
      forbidNonWhitelisted: true, // throws error for unknown properties
      transform: true, // automatically converts types (like string -> number)
    }),
  );

  // Setup Scalar API Reference backed by the generated OpenAPI document.
  // In production, you may want to disable or protect this endpoint.
  if (!isProduction || enableDocs) {
    setupScalarDocs(app);
    nestLogger.log(
      'Scalar API documentation available at /api-docs/',
      'Bootstrap',
    );
  } else {
    nestLogger.log('API documentation disabled in production', 'Bootstrap');
  }

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
