import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from 'zod';
import { badRequest } from '../utils/errors';

interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and coerces parts of the request against zod schemas. Parsed
 * values replace the originals so downstream handlers get typed, clean data.
 */
export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        throw badRequest('Validation failed', err.flatten());
      }
      throw err;
    }
  };
}

/** Helper to infer the validated body type from a schema. */
export type Infer<T extends ZodTypeAny> = ZodInfer<T>;
