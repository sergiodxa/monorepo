export class TypeIdError extends Error {
	override name = "TypeIdError";

	constructor(message: string) {
		super(message);
	}
}

export class InvalidPrefixError extends TypeIdError {
	override name = "InvalidPrefixError";

	constructor(prefix: string) {
		super(`Invalid prefix "${prefix}". Must be at most 63 ASCII letters [a-z_]`);
	}
}

export class PrefixMismatchError extends TypeIdError {
	override name = "PrefixMismatchError";

	constructor(expected: string, actual: string) {
		super(`Invalid TypeId. Prefix mismatch. Expected ${expected}, got ${actual}`);
	}
}

export class EmptyPrefixError extends TypeIdError {
	override name = "EmptyPrefixError";

	constructor(typeId: string) {
		super(`Invalid TypeId. Prefix cannot be empty when there's a separator: ${typeId}`);
	}
}

export class MissingSeparatorError extends TypeIdError {
	override name = "MissingSeparatorError";

	constructor(typeId: string) {
		super(`Invalid TypeId. Missing separator "_": ${typeId}`);
	}
}

export class InvalidSuffixLengthError extends TypeIdError {
	override name = "InvalidSuffixLengthError";

	constructor(length: number) {
		super(`Invalid length. Suffix should have 26 characters, got ${length}`);
	}
}

export class InvalidBase32CharacterError extends TypeIdError {
	override name = "InvalidBase32CharacterError";

	constructor(character: string) {
		super(`Invalid base32 character: ${character}`);
	}
}

export class InvalidBase32StringError extends TypeIdError {
	override name = "InvalidBase32StringError";

	constructor() {
		super("Invalid base32 string");
	}
}

export class InvalidUUIDLengthError extends TypeIdError {
	override name = "InvalidUUIDLengthError";

	constructor(length: number) {
		super(`Invalid UUID length: ${length}`);
	}
}

export class InvalidUUIDTypeError extends TypeIdError {
	override name = "InvalidUUIDTypeError";

	constructor(type: string) {
		super(`Expected a string, got ${type}`);
	}
}

export class InvalidUUIDFormatError extends TypeIdError {
	override name = "InvalidUUIDFormatError";

	constructor(uuid: string) {
		super(`Invalid UUID format: ${uuid}`);
	}
}
