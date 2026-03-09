import { InvalidUUIDFormatError, InvalidUUIDLengthError, InvalidUUIDTypeError } from "./errors";

export type UUID = ReturnType<typeof crypto.randomUUID>;

export function assertUUID(string: string): asserts string is UUID {
	if (typeof string !== "string") throw new InvalidUUIDTypeError(typeof string);
	if (string.length !== 36) throw new InvalidUUIDLengthError(string.length);
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(string)) {
		throw new InvalidUUIDFormatError(string);
	}
}
