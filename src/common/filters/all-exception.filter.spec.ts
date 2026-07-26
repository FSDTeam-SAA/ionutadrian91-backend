import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import type { Logger } from 'winston';
import { AllExceptionsFilter } from './all-exception.filter';

describe('AllExceptionsFilter', () => {
  it('logs handled HTTP exceptions as warnings and preserves response details', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const loggerError = jest.fn();
    const loggerWarn = jest.fn();
    const logger = {
      error: loggerError,
      warn: loggerWarn,
    } as unknown as Logger;
    const filter = new AllExceptionsFilter(logger);
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'POST',
          url: '/auth/register',
        }),
      }),
    } as ArgumentsHost;
    const exception = new HttpException(
      {
        message:
          'Too many registration attempts. Please wait 48 seconds before creating another account.',
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 48,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );

    filter.catch(exception, host);

    expect(loggerWarn).toHaveBeenCalledWith(
      'Handled HTTP exception',
      expect.objectContaining({
        statusCode: 429,
        path: '/auth/register',
      }),
    );
    expect(loggerError).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 429,
        message:
          'Too many registration attempts. Please wait 48 seconds before creating another account.',
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 48,
        path: '/auth/register',
      }),
    );
  });
});
