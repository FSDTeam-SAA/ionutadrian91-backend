import { DashboardController } from './dashboard.controller';

describe('DashboardController engineer overview', () => {
  it('requests an overview scoped to the authenticated engineer', () => {
    const dashboard = { getEngineerOverview: jest.fn() };
    const controller = new DashboardController(dashboard as any);

    (controller as any).myOverview({ userId: 'engineer-user-id' });

    expect(dashboard.getEngineerOverview).toHaveBeenCalledWith('engineer-user-id');
  });
});
