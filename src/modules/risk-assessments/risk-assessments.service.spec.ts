import { RiskAssessmentsService } from './risk-assessments.service';

describe('RiskAssessmentsService', () => {
  it('accepts a risk assessment for an assignment assigned to the current member', async () => {
    const memberId = '6a7b4ba2e27ef6f90ff0ce60';
    const assignmentId = '6a898ca8c07da5ae269193bf';
    const projectId = '6a7c47f409da58d5e8fdd987';
    const assessments = {
      create: jest.fn().mockResolvedValue({ id: 'assessment-id' }),
    };
    const assignments = {
      findById: jest.fn().mockReturnValue({
        lean: () => ({
          exec: jest
            .fn()
            .mockResolvedValue({
              projectId,
              engineers: [memberId],
              workers: [],
            }),
        }),
      }),
    };
    const projects = {
      exists: jest.fn().mockResolvedValue({ _id: projectId }),
    };
    const members = {
      db: {
        collection: jest
          .fn()
          .mockReturnValue({
            findOne: jest
              .fn()
              .mockResolvedValue({ email: 'engineer@example.com' }),
          }),
      },
      findOne: jest
        .fn()
        .mockReturnValue({
          select: () => ({
            lean: () => ({
              exec: jest.fn().mockResolvedValue({ _id: memberId }),
            }),
          }),
        }),
    };
    const service = new RiskAssessmentsService(
      assessments as any,
      assignments as any,
      projects as any,
      members as any,
    );

    await expect(
      service.create(
        {
          projectId,
          assignmentId,
          workActivity: 'Install equipment',
          hazards: [],
          engineerConfirmed: true,
        } as any,
        '6a7b4ba3e27ef6f90ff0ce61',
      ),
    ).resolves.toEqual({ id: 'assessment-id' });
    expect(assignments.findById).toHaveBeenCalledWith(assignmentId);
  });
});
