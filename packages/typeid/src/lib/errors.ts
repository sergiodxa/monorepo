/** Base error class for all TypeID package errors. */
export class TypeIdError extends Error {
	override name = "TypeIdError";

	/**
	 * Creates a new TypeID error.
	 * @param message Human-readable error message.
	 * @example
	 * throw new TypeIdError("Invalid TypeID value");
	 */
	constructor(message: string) {
		super(message);
	}
}

/** Error thrown when a TypeID prefix is invalid. */
export class InvalidPrefixError extends TypeIdError {
	override name = "InvalidPrefixError";

	/**
	 * Creates an invalid prefix error.
	 * @param prefix Prefix that failed validation.
	 * @example
	 * throw new InvalidPrefixError("User");
	 */
	constructor(prefix: string) {
		super(`Invalid prefix "${prefix}". Must be at most 63 ASCII letters [a-z_]`);
	}
}

/** Error thrown when a parsed prefix does not match the expected one. */
export class PrefixMismatchError extends TypeIdError {
	override name = "PrefixMismatchError";

	/**
	 * Creates a prefix mismatch error.
	 * @param expected Expected prefix value.
	 * @param actual Actual prefix parsed from the TypeID.
	 * @example
	 * throw new PrefixMismatchError("user", "org");
	 */
	constructor(expected: string, actual: string) {
		super(`Invalid TypeId. Prefix mismatch. Expected ${expected}, got ${actual}`);
	}
}

/** Error thrown when a TypeID uses a separator but has an empty prefix. */
export class EmptyPrefixError extends TypeIdError {
	override name = "EmptyPrefixError";

	/**
	 * Creates an empty prefix error.
	 * @param typeId Raw TypeID string that failed validation.
	 * @example
	 * throw new EmptyPrefixError("_01h455vb4pex5vsknk084sn02q");
	 */
	constructor(typeId: string) {
		super(`Invalid TypeId. Prefix cannot be empty when there's a separator: ${typeId}`);
	}
}

/** Error thrown when a TypeID is missing the prefix/suffix separator. */
export class MissingSeparatorError extends TypeIdError {
	override name = "MissingSeparatorError";

	/**
	 * Creates a missing separator error.
	 * @param typeId Raw TypeID string that failed validation.
	 * @example
	 * throw new MissingSeparatorError("user01h455vb4pex5vsknk084sn02q");
	 */
	constructor(typeId: string) {
		super(`Invalid TypeId. Missing separator "_": ${typeId}`);
	}
}

/** Error thrown when a TypeID suffix does not have 26 characters. */
export class InvalidSuffixLengthError extends TypeIdError {
	override name = "InvalidSuffixLengthError";

	/**
	 * Creates an invalid suffix length error.
	 * @param length Actual suffix length.
	 * @example
	 * throw new InvalidSuffixLengthError(3);
	 */
	constructor(length: number) {
		super(`Invalid length. Suffix should have 26 characters, got ${length}`);
	}
}

/** Error thrown when a Base32 string contains an invalid character. */
export class InvalidBase32CharacterError extends TypeIdError {
	override name = "InvalidBase32CharacterError";

	/**
	 * Creates an invalid Base32 character error.
	 * @param character Character that is not allowed by the TypeID Base32 alphabet.
	 * @example
	 * throw new InvalidBase32CharacterError("i");
	 */
	constructor(character: string) {
		super(`Invalid base32 character: ${character}`);
	}
}

/** Error thrown when a Base32 string is malformed or out of range. */
export class InvalidBase32StringError extends TypeIdError {
	override name = "InvalidBase32StringError";

	/**
	 * Creates an invalid Base32 string error.
	 * @example
	 * throw new InvalidBase32StringError();
	 */
	constructor() {
		super("Invalid base32 string");
	}
}

/** Error thrown when a UUID string has an invalid length. */
export class InvalidUUIDLengthError extends TypeIdError {
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
export class InvalidUUIDTypeError extends TypeIdError {
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
export class InvalidUUIDFormatError extends TypeIdError {
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
