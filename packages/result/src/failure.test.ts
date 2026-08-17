import { describe, expect, test } from "vitest";

import { failure } from "./failure.js";

describe(failure, () => {
	test("creates a failure result with error", () => {
		let error = new Error("Something went wrong");
		let result = failure(error);

		expect(result.status).toBe("failure");
		expect(result.error).toBe(error);
		expect(result.error.message).toBe("Something went wrong");
	});

	test("works with custom error classes", () => {
		class CustomError extends Error {
			code: string;
			constructor(message: string, code: string) {
				super(message);
				this.code = code;
			}
		}

		let error = new CustomError("Custom error", "E001");
		let result = failure(error);

		expect(result.error).toBe(error);
		expect(result.error.code).toBe("E001");
	});
});
