import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTeamMemberDto } from './create-team-member.dto';

describe('CreateTeamMemberDto', () => {
  it('accepts multipart-form values for a photo, times, and weekend days', async () => {
    const dto = plainToInstance(CreateTeamMemberDto, {
      photo: 'multipart-file-placeholder',
      fullName: 'Jane Stewart',
      jobTitle: 'Field Engineer',
      departmentId: '507f1f77bcf86cd799439011',
      workerType: 'Full-time',
      startDate: '2026-08-10',
      startTime: '08:00',
      endTime: '18:00',
      shiftName: 'Day shift',
      weekendDays: ['SA', 'SU'],
      workEmail: 'jane.stewart@example.com',
      phoneNumber: '+44 7000 000 000',
      emergencyContactName: 'John Stewart',
      emergencyContactPhoneNumber: '+44 7000 000 001',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.weekendDays).toEqual(['SA', 'SU']);
  });
});
