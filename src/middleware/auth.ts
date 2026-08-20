import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { forbidden, unauthorized } from '../utils/errors';

/**
 * Authenticates a request via the `Authorization: Bearer <token>` header.
 * On success, attaches `req.user`. Throws 401 otherwise.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, memberId: payload.memberId };
    next();
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
}

/**
 * Restricts a route to the given roles. Must run after `authenticate`.
 * SUPER_ADMIN is always allowed.
 */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw unauthorized();
    if (req.user.role === 'SUPER_ADMIN' || roles.includes(req.user.role)) {
      next();
      return;
    }
    throw forbidden();
  };
}

/**
 * Requires the authenticated account to be linked to a Member. Use this for
 * member actions such as RSVP, donating, and mutual-aid contributions.
 */
export function requireLinkedMember(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw unauthorized();
  if (!req.user.memberId) {
    throw forbidden('Your account must be linked to a member record for this action');
  }
  next();
}
