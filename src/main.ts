import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
// import { AllExceptionFilter } from './common/filters/all-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Winston logger
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalInterceptors(new TransformInterceptor(logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown properties
      forbidNonWhitelisted: true, // throws error for unknown properties
      transform: true, // automatically converts types (like string -> number)
    }),
  );

  logger.log('Application is starting...', 'Bootstrap');

  await app.listen(process.env.PORT ?? 5000, '0.0.0.0');

  logger.log(
    `Application is running successfully on: ${await app.getUrl()}`,
    'Bootstrap',
  );
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
});
