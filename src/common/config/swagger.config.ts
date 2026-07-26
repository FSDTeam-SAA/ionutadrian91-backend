import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export function setupScalarDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('ionutadrian91 backend')
    .setDescription(
      'Operational backend with MongoDB, three-role authentication, user management, logging, monitoring, and email workflows.',
    )
    .setVersion('1.0.0')
    .setContact(
      'API Support',
      'https://github.com/ionutadrian91/ionutadrian91-backend',
      '',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    // Add JWT Bearer authentication globally
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'JWT-auth', // This is the security name
    )
    // Add common tags for organization
    .addTag('Auth', 'Authentication and authorization endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('health', 'Health check endpoints')
    .addTag('metrics', 'Metrics and monitoring endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // Global API response decorator
    extraModels: [],
  });

  SwaggerModule.setup('openapi', app, document, { jsonDocumentUrl: 'openapi/json' });
  app.use(
    '/docs',
    apiReference({
      spec: {
        content: document,
      },
      pageTitle: 'ionutadrian91 backend API',
      theme: 'default',
      layout: 'modern',
      persistAuth: true,
    }),
  );
}
