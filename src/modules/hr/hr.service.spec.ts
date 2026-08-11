import { BadRequestException, ConflictException } from '@nestjs/common';
import { HrService } from './hr.service';

describe('HrService department management', () => {
  let service: HrService;
  let mongo: any;
  let cloudinary: any;

  beforeEach(() => {
    mongo = {
      department: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      hrPlan: { count: jest.fn() },
      teamMember: {
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    cloudinary = {
      uploadTeamMemberPhoto: jest.fn(),
      removePhoto: jest.fn(),
    };
    service = new HrService(mongo, cloudinary);
  });

  it('creates a simple department without a department head', async () => {
    mongo.department.findFirst.mockResolvedValue(null);
    mongo.department.create.mockResolvedValue({
      id: 'department-1',
      name: 'Human Resources',
      description: 'People operations',
    });

    await expect(
      service.createDepartment({
        name: '  Human Resources  ',
        description: 'People operations',
      }),
    ).resolves.toEqual({
      id: 'department-1',
      name: 'Human Resources',
      description: 'People operations',
    });

    expect(mongo.department.create).toHaveBeenCalledWith({
      data: {
        name: 'Human Resources',
        description: 'People operations',
      },
    });
  });

  it('does not expose a legacy department-head field in department responses', async () => {
    mongo.department.findUnique.mockResolvedValue({
      id: 'department-1',
      name: 'Human Resources',
      description: 'People operations',
      headId: 'legacy-user-id',
    });

    await expect(service.findDepartment('department-1')).resolves.toEqual({
      id: 'department-1',
      name: 'Human Resources',
      description: 'People operations',
    });
  });

  it('rejects duplicate department names regardless of casing', async () => {
    mongo.department.findFirst.mockResolvedValue({ id: 'department-1' });

    await expect(
      service.createDepartment({
        name: 'Human Resources',
        description: 'People operations',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not delete a department that has plans or team members', async () => {
    mongo.department.findUnique.mockResolvedValue({ id: 'department-1' });
    mongo.hrPlan.count.mockResolvedValue(1);

    await expect(
      service.removeDepartment('department-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mongo.department.delete).not.toHaveBeenCalled();

    mongo.hrPlan.count.mockResolvedValue(0);
    mongo.teamMember.count.mockResolvedValue(1);

    await expect(
      service.removeDepartment('department-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mongo.department.delete).not.toHaveBeenCalled();
  });

  it('uploads a team-member photo to Cloudinary and stores its URL', async () => {
    mongo.department.findUnique.mockResolvedValue({ id: 'department-1' });
    mongo.teamMember.findFirst = jest.fn().mockResolvedValue(null);
    cloudinary.uploadTeamMemberPhoto.mockResolvedValue({
      publicId: 'ionutadrian91/team-members/photo-1',
      url: 'https://res.cloudinary.com/demo/image/upload/photo-1.jpg',
    });
    mongo.teamMember.create.mockImplementation(({ data }) => data);

    await service.createTeamMember(
      {
        fullName: 'Jane Stewart',
        jobTitle: 'Field Engineer',
        departmentId: 'department-1',
        workerType: 'Full-time',
        startDate: new Date('2026-08-10'),
        startTime: '08:00',
        endTime: '18:00',
        shiftName: 'Day shift',
        weekendDays: ['SA', 'SU'],
        workEmail: 'JANE.STEWART@example.com',
        phoneNumber: '+44 7000 000 000',
        emergencyContactName: 'John Stewart',
        emergencyContactPhoneNumber: '+44 7000 000 001',
      },
      { buffer: Buffer.from('photo'), mimetype: 'image/jpeg' },
    );

    expect(cloudinary.uploadTeamMemberPhoto).toHaveBeenCalledWith(
      Buffer.from('photo'),
      'image/jpeg',
    );
    expect(mongo.teamMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        photoUrl: 'https://res.cloudinary.com/demo/image/upload/photo-1.jpg',
        photoPublicId: 'ionutadrian91/team-members/photo-1',
        hasPhoto: true,
        workEmail: 'jane.stewart@example.com',
      }),
    });
  });
});
