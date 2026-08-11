import { describe, it, expect } from "vitest";
import { AppError, NotFoundError, ForbiddenError } from "../../src/utils/errors";

describe("Custom error classes", () => {
  it("AppError carries a status code", () => {
    const err = new AppError("Something broke", 418);
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe("Something broke");
  });

  it("NotFoundError defaults to 404", () => {
    const err = new NotFoundError("Product");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Product not found");
  });

  it("ForbiddenError defaults to 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });
});
