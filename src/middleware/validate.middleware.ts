import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ValidationError } from "@utils/errors";

/**
 * Validates req.body (or req.query/params if you pass a schema shaped for
 * those) against a Zod schema before the request reaches the controller.
 *
 * Usage: router.post('/products', validate(createProductSchema), controller)
 */
export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        throw new ValidationError(message);
      }
      throw err;
    }
  };
}
