import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function createMockContext(role: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'u1', email: 'test@test.com', role } }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow when no @Roles() decorator present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = createMockContext('kiosk');

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when user role matches required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['technician', 'admin']);
    const ctx = createMockContext('technician');

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow admin when admin is in allowed roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const ctx = createMockContext('admin');

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when role not authorized', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const ctx = createMockContext('kiosk');

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when kiosk tries technician endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['technician', 'admin']);
    const ctx = createMockContext('kiosk');

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when technician tries activation endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const ctx = createMockContext('technician');

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
