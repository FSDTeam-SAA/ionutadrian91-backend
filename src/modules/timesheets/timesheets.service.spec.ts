import { BadRequestException } from '@nestjs/common';
import { TimesheetStatus, TimesheetWorkStatus } from '../../common/schemas';
import { TimesheetsService } from './timesheets.service';

const engineerId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';
const projectId = '507f1f77bcf86cd799439013';
const assignmentId = '507f1f77bcf86cd799439014';
const today = new Date().toISOString().slice(0, 10);
const query = (value: unknown) => ({ lean: jest.fn().mockResolvedValue(value), exec: jest.fn().mockResolvedValue(value) });

function createService() {
  const rateCards = { find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([{ code: 'CBT2', description: 'Cable installation', unit: 'Unit', price: 34 }]) })) };
  const timesheets = { create: jest.fn().mockResolvedValue({ toObject: () => ({ _id: 'sheet-1', projectId, assignmentId, engineerId, claimDate: new Date(today), workStatus: TimesheetWorkStatus.WORKING, totalValue: 68, status: TimesheetStatus.DRAFT, items: [] }) }), find: jest.fn(() => ({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) })) };
  const members = { findOne: jest.fn(() => ({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ _id: engineerId }) })) })) };
  const users = { findById: jest.fn(() => ({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ email: 'engineer@example.com' }) })) })) };
  const assignments = { findOne: jest.fn(() => query({ _id: assignmentId })) };
  const unlockRequests = { exists: jest.fn(), findOne: jest.fn(), find: jest.fn() };
  return { service: new TimesheetsService(rateCards as never, timesheets as never, members as never, users as never, assignments as never, unlockRequests as never), timesheets };
}

describe('TimesheetsService project daily timesheets', () => {
  it('uses the server rate-card price for a project-linked working submission', async () => {
    const { service, timesheets } = createService();
    await service.createForEngineer(userId, { claimDate: today, projectId, assignmentId, workStatus: TimesheetWorkStatus.WORKING, items: [{ rateCode: 'CBT2', quantity: 2 }] });
    expect(timesheets.create).toHaveBeenCalledWith(expect.objectContaining({ engineerId: expect.anything(), projectId: expect.anything(), assignmentId: expect.anything(), status: TimesheetStatus.DRAFT, totalValue: 68, items: [expect.objectContaining({ unitPrice: 34, total: 68 })] }));
  });

  it('rejects work items for an off-day submission', async () => {
    const { service } = createService();
    await expect(service.createForEngineer(userId, { claimDate: today, projectId, assignmentId, workStatus: TimesheetWorkStatus.OFF_DAY, items: [{ rateCode: 'CBT2', quantity: 1 }] })).rejects.toBeInstanceOf(BadRequestException);
  });
});
