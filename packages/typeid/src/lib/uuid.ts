import { InvalidUUIDFormatError, InvalidUUIDLengthError, InvalidUUIDTypeError } from "./errors";

/** Canonical lowercase UUID string type. */
export type UUID = ReturnType<typeof crypto.randomUUID>;

/**
 * Asserts that a string is a canonical lowercase UUID.
 * @param string Value to validate.
 * @returns Assertion that narrows the value to UUID.
 * @throws {InvalidUUIDTypeError} If the value is not a string.
 * @throws {InvalidUUIDLengthError} If the UUID does not have 36 characters.
 * @throws {InvalidUUIDFormatError} If the UUID is not in canonical lowercase format.
 * @example
 * let value = "550e8400-e29b-41d4-a716-446655440000";
 * assertUUID(value);
 */
export function assertUUID(string: string): asserts string is UUID {
	if (typeof string !== "string") throw new InvalidUUIDTypeError(typeof string);
	if (string.length !== 36) throw new InvalidUUIDLengthError(string.length);
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(string)) {
		throw new InvalidUUIDFormatError(string);
	}
}
