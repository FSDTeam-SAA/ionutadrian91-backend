import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RedisModule } from './common/modules/redis.module';
import { RateLimitModule } from './common/modules/rate-limit.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/config/winston.config';
import { LoggerModule } from './common/modules/logger.module';
import { MongoModule } from './common/modules/mongo.module';
import { QueueModule } from './common/modules/queue.module';
import { HrModule } from './modules/hr/hr.module';
import { LeaveModule } from './modules/leave/leave.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { WhereaboutsModule } from './modules/whereabouts/whereabouts.module';
import { DutyOfCareModule } from './modules/duty-of-care/duty-of-care.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { RiskAssessmentsModule } from './modules/risk-assessments/risk-assessments.module';
import { WorkspaceFilesModule } from './modules/workspace-files/workspace-files.module';
import { TimesheetsModule } from './modules/timesheets/timesheets.module';
import { VehicleChecksModule } from './modules/vehicle-checks/vehicle-checks.module';

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // Winston logger module (global - can be injected anywhere)
    WinstonModule.forRoot(winstonConfig),
    // Custom logger module (global - can be injected anywhere)
    LoggerModule,
    // MongoDB module (global - provides Mongoose models and repositories)
    MongoModule,
    // Redis module (global - can be injected anywhere)
    RedisModule,
    // Rate limiting module (global - throttles requests using Redis)
    RateLimitModule,
    // Metrics module (global - Prometheus metrics)
    MetricsModule,
    // Background email queue
    QueueModule,
    AuthModule,
    HrModule,
    UserModule,
    LeaveModule,
    ProjectsModule,
    WhereaboutsModule,
    DutyOfCareModule,
    IncidentsModule,
    VehiclesModule,
    RiskAssessmentsModule,
    WorkspaceFilesModule,
    TimesheetsModule,
    VehicleChecksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
