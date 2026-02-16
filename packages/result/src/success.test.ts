import { describe, expect, test } from "bun:test";

import { success } from "./success.js";

describe(success, () => {
	test("creates a success result with data", () => {
		let result = success({ id: 1, name: "Test" });

		expect(result.status).toBe("success");
		expect(result.data).toEqual({ id: 1, name: "Test" });
	});

	test("works with primitives", () => {
		let numberResult = success(42);
		let stringResult = success("hello");
		let booleanResult = success(true);

		expect(numberResult.data).toBe(42);
		expect(stringResult.data).toBe("hello");
		expect(booleanResult.data).toBe(true);
	});

	test("works with null and undefined", () => {
		let nullResult = success(null);
		let undefinedResult = success(undefined);

		expect(nullResult.data).toBeNull();
		expect(undefinedResult.data).toBeUndefined();
	});
});
