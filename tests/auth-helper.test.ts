import { getPrimaryRole, getUserRoleNames } from '../src/helpers/auth-helper';
import { Roles } from '../src/types/role.types';
import { AuthenticatedRequest } from '../src/types/common.types';

const createRequest = (
  userRoles?: Array<{ role?: { name?: string } }>
): AuthenticatedRequest =>
  ({
    user: userRoles ? ({ userRoles } as any) : undefined
  }) as AuthenticatedRequest;

describe('auth-helper', () => {
  it('returns empty role names when user is missing', () => {
    const req = createRequest();

    expect(getUserRoleNames(req)).toEqual([]);
    expect(getPrimaryRole(req)).toBeUndefined();
  });

  it('returns empty role names when user exists but has no userRoles array', () => {
    const req = ({
      user: {}
    } as unknown) as AuthenticatedRequest;

    expect(getUserRoleNames(req)).toEqual([]);
    expect(getPrimaryRole(req)).toBeUndefined();
  });

  it('returns role names in order and skips undefined role names', () => {
    const req = createRequest([
      { role: { name: Roles.REVIEWER } },
      { role: {} },
      { role: { name: Roles.APPROVER } }
    ]);

    expect(getUserRoleNames(req)).toEqual([Roles.REVIEWER, Roles.APPROVER]);
  });

  it('returns first role as primary role', () => {
    const req = createRequest([
      { role: { name: Roles.ADMIN } },
      { role: { name: Roles.APPROVER } }
    ]);

    expect(getPrimaryRole(req)).toBe(Roles.ADMIN);
  });
});
