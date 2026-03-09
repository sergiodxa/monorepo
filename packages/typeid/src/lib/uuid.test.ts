import { describe, expect, test } from "bun:test";

import {
	InvalidUUIDFormatError,
	InvalidUUIDLengthError,
	InvalidUUIDTypeError,
	TypeIdError,
} from "./errors";
import { assertUUID } from "./uuid";

describe(assertUUID.name, () => {
	test("accepts a valid UUID", () => {
		let uuid = crypto.randomUUID();

		expect(() => assertUUID(uuid)).not.toThrow();
	});

	test("throws for invalid UUID length", () => {
		expect(() => assertUUID("short-uuid")).toThrow(InvalidUUIDLengthError);
	});

	test("throws for invalid UUID format", () => {
		expect(() => assertUUID("550e8400_e29b_41d4_a716_446655440000")).toThrow(
			InvalidUUIDFormatError,
		);
	});

	test("throws for non-string values", () => {
		expect(() => assertUUID(null as never)).toThrow(InvalidUUIDTypeError);
	});

	test("UUID validation errors extend TypeIdError", () => {
		try {
			assertUUID("short-uuid");
			throw new Error("Expected assertUUID to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(TypeIdError);
		}
	});
});
