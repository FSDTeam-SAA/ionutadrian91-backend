import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { BlogModule } from './blog/blog.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RedisModule } from './common/modules/redis.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // Redis module (global - can be injected anywhere)
    RedisModule,
    // Metrics module (global - Prometheus metrics)
    MetricsModule,
    // BlogModule,
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
