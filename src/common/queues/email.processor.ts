import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../services/email.service';
import { PrismaService } from '../services/prisma.service';
import { EmailJob } from './email.queue';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prismaService: PrismaService,
  ) {
    super();
  }

  async process(job: Job<EmailJob>): Promise<void> {
    this.logger.log(`Processing email job: ${job.name} (ID: ${job.id})`);

    try {
      switch (job.data.type) {
        case 'verification':
          await this.handleVerificationEmail(job);
          break;
        case 'welcome':
          await this.handleWelcomeEmail(job);
          break;
        default:
          this.logger.warn(
            `Unknown email job type: ${String((job.data as { type?: string }).type || 'undefined')}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process email job ${job.id}:`,
        error instanceof Error ? error.stack : error,
      );
      throw error; // Re-throw to trigger retry
    }
  }

  private async handleVerificationEmail(job: Job<EmailJob>): Promise<void> {
    const data = job.data as Extract<EmailJob, { type: 'verification' }>;
    const { email, username, verificationCode, authId } = data;

    try {
      // Send the email
      await this.emailService.sendVerificationEmail(
        email,
        username,
        verificationCode,
      );

      // Update email history status to 'sent'
      await this.prismaService.emailHistory.updateMany({
        where: {
          authId,
          emailType: 'verification',
          emailStatus: 'pending',
        },
        data: {
          emailStatus: 'sent',
        },
      });

      this.logger.log(
        `Verification email sent successfully to ${email} (Job: ${job.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}:`,
        error,
      );

      // Update email history status to 'failed'
      await this.prismaService.emailHistory.updateMany({
        where: {
          authId,
          emailType: 'verification',
          emailStatus: 'pending',
        },
        data: {
          emailStatus: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Failed to send email',
        },
      });

      throw error; // Re-throw to trigger retry
    }
  }

  private async handleWelcomeEmail(job: Job<EmailJob>): Promise<void> {
    const data = job.data as Extract<EmailJob, { type: 'welcome' }>;
    const { email, username } = data;

    try {
      await this.emailService.sendWelcomeEmail(email, username);
      this.logger.log(
        `Welcome email sent successfully to ${email} (Job: ${job.id})`,
      );
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      // Don't throw for welcome emails - they're non-critical
      // Just log the error and mark job as complete
    }
  }
}
