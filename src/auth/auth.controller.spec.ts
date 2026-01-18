import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthUtilsService } from './services/auth-utils.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import type { Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    create: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
  };

  const mockAuthUtilsService = {
    checkRateLimit: jest.fn(),
    validatePassword: jest.fn(),
    generateVerificationCode: jest.fn(),
    hashToken: jest.fn(),
    createAccessToken: jest.fn(),
    createRefreshToken: jest.fn(),
    generateSecureId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: AuthUtilsService,
          useValue: mockAuthUtilsService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user with correct payload and metadata', async () => {
      const createAuthDto: CreateAuthDto = {
        username: 'testuser',
        password: 'Test@1234',
        email: 'test@example.com',
      };

      const mockRequest = {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'Jest Test Agent',
          'x-device': 'test-device',
        },
      } as unknown as Request;

      mockAuthService.create.mockResolvedValue(undefined);

      await controller.create(createAuthDto, mockRequest);

      expect(mockAuthService.create).toHaveBeenCalledWith(createAuthDto, {
        ip: '127.0.0.1',
        userAgent: 'Jest Test Agent',
        device: 'test-device',
      });
      expect(mockAuthService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle missing IP and user agent', async () => {
      const createAuthDto: CreateAuthDto = {
        username: 'testuser',
        password: 'Test@1234',
        email: 'test@example.com',
      };

      const mockRequest = {
        headers: {},
      } as unknown as Request;

      mockAuthService.create.mockResolvedValue(undefined);

      await controller.create(createAuthDto, mockRequest);

      expect(mockAuthService.create).toHaveBeenCalledWith(createAuthDto, {
        ip: 'unknown',
        userAgent: 'unknown',
        device: undefined,
      });
    });

    it('should extract device from x-device-id header if x-device is not present', async () => {
      const createAuthDto: CreateAuthDto = {
        username: 'testuser',
        password: 'Test@1234',
        email: 'test@example.com',
      };

      const mockRequest = {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mobile Agent',
          'x-device-id': 'mobile-device-123',
        },
      } as unknown as Request;

      mockAuthService.create.mockResolvedValue(undefined);

      await controller.create(createAuthDto, mockRequest);

      expect(mockAuthService.create).toHaveBeenCalledWith(createAuthDto, {
        ip: '192.168.1.1',
        userAgent: 'Mobile Agent',
        device: 'mobile-device-123',
      });
    });

    it('should extract device from sec-ch-ua-platform if other device headers are not present', async () => {
      const createAuthDto: CreateAuthDto = {
        username: 'testuser',
        password: 'Test@1234',
        email: 'test@example.com',
      };

      const mockRequest = {
        ip: '10.0.0.1',
        headers: {
          'user-agent': 'Chrome Browser',
          'sec-ch-ua-platform': '"Windows"',
        },
      } as unknown as Request;

      mockAuthService.create.mockResolvedValue(undefined);

      await controller.create(createAuthDto, mockRequest);

      expect(mockAuthService.create).toHaveBeenCalledWith(createAuthDto, {
        ip: '10.0.0.1',
        userAgent: 'Chrome Browser',
        device: '"Windows"',
      });
    });
  });
});
