import { UserRole } from '../../common/schemas';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { TimesheetsController } from './timesheets.controller';

describe('TimesheetsController rate-card permissions', () => {
  it('allows HR users to create rate cards alongside administrators', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      TimesheetsController.prototype.createRateCard,
    );

    expect(roles).toEqual(
      expect.arrayContaining([UserRole.Administrator, UserRole.HR]),
    );
  });
});
