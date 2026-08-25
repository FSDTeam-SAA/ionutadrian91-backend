import { BadRequestException } from '@nestjs/common';
import { TimesheetStatus } from '../../common/schemas';
import { TimesheetsService } from './timesheets.service';

const engineerId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';

function createService() {
  const rateCards = {
    find: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue([
        { code: 'CBT2', description: 'Cable installation', unit: 'Unit', price: 34 },
      ]),
    })),
  };
  const timesheets = { create: jest.fn().mockResolvedValue({ id: 'new-timesheet' }) };
  const members = {
    findOne: jest.fn(() => ({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ _id: engineerId }) })) })),
    countDocuments: jest.fn().mockResolvedValue(1),
  };
  const users = {
    findById: jest.fn(() => ({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ email: 'engineer@example.com' }) })) })),
  };

  return { service: new TimesheetsService(rateCards as never, timesheets as never, members as never, users as never), timesheets, rateCards };
}

describe('TimesheetsService.createForEngineer', () => {
  const dto = {
    claimDate: '2026-08-24', townCity: 'London', jobNumber: 'job-1024',
    polygonType: 'Build', polygonId: 'POL-123', featureId: 'FEAT-456',
    items: [{ rateCode: 'CBT2', quantity: 2, price: 999999 }],
  };

  it('creates an engineer-owned draft using the rate card price from the database', async () => {
    const { service, timesheets } = createService();

    await service.createForEngineer(userId, dto);

    expect(timesheets.create).toHaveBeenCalledWith(expect.objectContaining({
      engineerIds: [expect.anything()],
      status: TimesheetStatus.DRAFT,
      totalValue: 68,
      items: [expect.objectContaining({ unitPrice: 34, total: 68 })],
    }));
  });

  it('rejects a duplicate rate code in one timesheet', async () => {
    const { service } = createService();

    await expect(service.createForEngineer(userId, { ...dto, items: [...dto.items, { rateCode: 'CBT2', quantity: 1 }] }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
