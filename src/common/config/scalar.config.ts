import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export function setupScalarDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('ionutadrian91 Backend API')
    .setDescription(
      [
        'Production API for the ionutadrian91 operational platform.',
        '',
        'Core capabilities:',
        '- Email-first authentication: register, verify email, login, forgot password, verify OTP, resend OTP, change password, logout.',
        '- Four-role access model: Administrator, Office, Field, and HR.',
        '- HR users can directly create, view, update, and delete departments and manage department-level plans; department changes do not require administrator approval.',
        '- Team-member profile photos are uploaded to Cloudinary and returned as secure URLs.',
        '- Field users are mobile-only and must send `x-client-platform: mobile` with authenticated requests.',
        '- MongoDB persistence, Redis-backed token/session cache, BullMQ email processing, and Redis rate limiting.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .setContact(
      'API Support',
      'https://github.com/FSDTeam-SAA/ionutadrian91-backend',
      '',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:5000', 'Local development')
    .addServer('https://api.ionutadrian91.com', 'Production')
    .setExternalDoc(
      'Source repository',
      'https://github.com/FSDTeam-SAA/ionutadrian91-backend',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste the JWT access token returned from `POST /auth/login`.',
        in: 'header',
      },
      'bearer',
    )
    .addTag(
      'Auth',
      'Authentication, verification, password reset, token refresh, and logout.',
    )
    .addTag(
      'Users',
      'Administrator/Office user management and self-service profile endpoints.',
    )
    .addTag(
      'HR',
      'HR can directly manage simple departments and team members, planning, and plan tracking. Administrator approval is not required for department CRUD.',
    )
    .addTag('health', 'Runtime health checks.')
    .addTag('metrics', 'Operational metrics and monitoring endpoints.')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [],
  });

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api-docs/openapi.json', (_request, response) => {
    response.type('application/json').send(document);
  });

  app.use(
    '/api-docs',
    apiReference({
      content: document,
      pageTitle: 'ionutadrian91 Backend API Reference',
      theme: 'kepler',
      layout: 'modern',
      darkMode: true,
      hideDarkModeToggle: false,
      hideDownloadButton: false,
      hideModels: false,
      hideSearch: false,
      hideTestRequestButton: false,
      isEditable: false,
      persistAuth: true,
      searchHotKey: 'k',
      documentDownloadType: 'both',
      defaultHttpClient: {
        targetKey: 'shell',
        clientKey: 'curl',
      },
      authentication: {
        preferredSecurityScheme: 'bearer',
      },
    }),
  );
}
