/** Error thrown when a UUID string has an invalid length. */
export class InvalidUUIDLengthError extends Error {
	override name = "InvalidUUIDLengthError";

	/**
	 * Creates an invalid UUID length error.
	 * @param length Actual UUID length.
	 * @example
	 * throw new InvalidUUIDLengthError(10);
	 */
	constructor(length: number) {
		super(`Invalid UUID length: ${length}`);
	}
}

/** Error thrown when a UUID value is not a string. */
export class InvalidUUIDTypeError extends Error {
	override name = "InvalidUUIDTypeError";

	/**
	 * Creates an invalid UUID type error.
	 * @param type Runtime type received instead of a UUID string.
	 * @example
	 * throw new InvalidUUIDTypeError("number");
	 */
	constructor(type: string) {
		super(`Expected a string, got ${type}`);
	}
}

/** Error thrown when a UUID string does not match the expected format. */
export class InvalidUUIDFormatError extends Error {
	override name = "InvalidUUIDFormatError";

	/**
	 * Creates an invalid UUID format error.
	 * @param uuid UUID value that failed format validation.
	 * @example
	 * throw new InvalidUUIDFormatError("not-a-uuid");
	 */
	constructor(uuid: string) {
		super(`Invalid UUID format: ${uuid}`);
	}
}
