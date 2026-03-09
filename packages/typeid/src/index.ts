import type { Base32 } from "./lib/base32";
import type { UUID } from "./lib/uuid";

import { decode, encode } from "./lib/base32";
import {
	EmptyPrefixError,
	InvalidPrefixError,
	InvalidSuffixLengthError,
	MissingSeparatorError,
	PrefixMismatchError,
} from "./lib/errors";
import { isValidPrefix } from "./lib/is-valid-prefix";
import { assertUUID } from "./lib/uuid";

/** Delimiter between a TypeID prefix and suffix. */
const SEPARATOR = "_";

/** Number of Base32 characters used to encode a UUID. */
const SUFFIX_LENGTH = 26;

/**
 * Represents a TypeID value with a typed prefix and Base32 suffix.
 *
 * @template prefix String literal type of the prefix, such as "user" or "post".
 * @example
 * let userId = TypeID.fromUUID("user", crypto.randomUUID());
 * userId.toString();
 * // "user_01h455vb4pex5vsknk084sn02q"
 */
export class TypeID<const prefix extends string> {
	#prefix: prefix;
	#suffix: Base32;

	/**
	 * Creates a TypeID from a validated prefix and Base32 suffix.
	 *
	 * @param prefix TypeID prefix such as "user" or "post".
	 * @param suffix 26-character Base32 UUID suffix.
	 * @throws {InvalidPrefixError} If the prefix does not satisfy TypeID prefix rules.
	 * @example
	 * let value = new TypeID("user", "01h455vb4pex5vsknk084sn02q" as Base32);
	 * value.toString();
	 * // "user_01h455vb4pex5vsknk084sn02q"
	 */
	constructor(prefix: prefix, suffix: Base32) {
		if (!isValidPrefix(prefix)) throw new InvalidPrefixError(prefix);
		this.#prefix = prefix;
		this.#suffix = suffix;
	}

	/**
	 * The prefix stored in this TypeID instance.
	 * @returns Prefix string, such as "user" or "post".
	 * @example
	 * let value = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q");
	 * value.prefix;
	 * // "user"
	 */
	public get prefix() {
		return this.#prefix;
	}

	/**
	 * The Base32 suffix stored in this TypeID instance.
	 * @returns 26-character Base32 string encoding a UUID.
	 * @example
	 * let value = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q");
	 * value.suffix;
	 * // "01h455vb4pex5vsknk084sn02q"
	 */
	public get suffix() {
		return this.#suffix;
	}

	/**
	 * Decodes this TypeID suffix back into a UUID string.
	 * @returns UUID string represented by this TypeID suffix.
	 * @throws {InvalidBase32CharacterError} If the suffix contains characters outside the TypeID Base32 alphabet.
	 * @throws {InvalidBase32StringError} If the suffix overflows 128 bits or is not a valid TypeID Base32 value.
	 * @throws {InvalidUUIDFormatError} If decoded content cannot be represented as a canonical UUID.
	 * @throws {InvalidUUIDLengthError} If decoded content has an invalid UUID length.
	 * @throws {InvalidUUIDTypeError} If decoded content is not a string UUID value.
	 * @example
	 * let userId = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q");
	 * userId.toUUID();
	 * // "8e03978e-40d5-43e8-bc93-6894a57f9324"
	 */
	toUUID(): UUID {
		let decoded = decode(this.suffix);
		assertUUID(decoded);
		return decoded;
	}

	/**
	 * Serializes this TypeID into its canonical string representation.
	 * @returns String representation of this TypeID, such as "user_01h455vb4pex5vsknk084sn02q".
	 * @throws {InvalidBase32CharacterError} If the suffix contains invalid Base32 characters while decoding.
	 * @throws {InvalidBase32StringError} If the suffix cannot be decoded to a valid 128-bit value.
	 * @throws {InvalidUUIDFormatError} If decoded content cannot be represented as a canonical UUID.
	 * @throws {InvalidUUIDLengthError} If decoded content has an invalid UUID length.
	 * @throws {InvalidUUIDTypeError} If decoded content is not a string UUID value.
	 * @example
	 * let userId = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q");
	 * userId.toString();
	 * // "user_01h455vb4pex5vsknk084sn02q"
	 */
	toString() {
		let suffix = encode(this.toUUID());
		if (this.prefix.length === 0) return suffix;
		return [this.prefix, suffix].join(SEPARATOR);
	}

	/**
	 * Parses a TypeID string and optionally enforces the expected prefix.
	 *
	 * @template prefix String literal prefix type to enforce.
	 * @param value Incoming TypeID string.
	 * @param prefix Optional expected prefix to enforce.
	 * @returns Parsed TypeID instance.
	 * @throws {EmptyPrefixError} If the value includes a separator but has an empty prefix.
	 * @throws {InvalidBase32CharacterError} If the suffix includes invalid Base32 characters.
	 * @throws {InvalidBase32StringError} If the suffix overflows 128 bits or is otherwise invalid.
	 * @throws {InvalidPrefixError} If the parsed prefix does not satisfy TypeID prefix rules.
	 * @throws {InvalidSuffixLengthError} If the suffix length is not exactly 26 characters.
	 * @throws {MissingSeparatorError} If a non-empty prefix is present without the separator.
	 * @throws {PrefixMismatchError} If the parsed prefix does not match the expected prefix.
	 * @example
	 * let value = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q", "user");
	 * value.prefix;
	 * // "user"
	 */
	static fromString<const prefix extends string>(value: string, prefix?: prefix): TypeID<prefix> {
		let separator = value.lastIndexOf(SEPARATOR);

		if (separator === -1) {
			if (value.length < SUFFIX_LENGTH) throw new InvalidSuffixLengthError(value.length);
			if (value.length > SUFFIX_LENGTH) throw new MissingSeparatorError(value);
			decode(value as Base32);
			return new TypeID("" as prefix, value as Base32);
		}

		let actualPrefix = value.slice(0, separator);
		let suffix = value.slice(separator + 1);
		if (!actualPrefix) throw new EmptyPrefixError(value);
		if (suffix.length !== SUFFIX_LENGTH) throw new InvalidSuffixLengthError(suffix.length);
		if (prefix && actualPrefix !== prefix) throw new PrefixMismatchError(prefix, actualPrefix);
		decode(suffix as Base32);
		return new TypeID(actualPrefix as prefix, suffix as Base32);
	}

	/**
	 * Builds a TypeID from an existing UUID and prefix.
	 *
	 * @template prefix String literal prefix type to apply.
	 * @param prefix Prefix to apply.
	 * @param uuid UUID to encode.
	 * @returns TypeID instance for the provided prefix.
	 * @throws {InvalidPrefixError} If the prefix does not satisfy TypeID prefix rules.
	 * @throws {InvalidUUIDFormatError} If the UUID is not in canonical lowercase format.
	 * @throws {InvalidUUIDLengthError} If the UUID does not have 36 characters.
	 * @throws {InvalidUUIDTypeError} If the UUID is not a string.
	 * @example
	 * let userId = TypeID.fromUUID("user", "550e8400-e29b-41d4-a716-446655440000");
	 * userId.toString();
	 * // "user_01arz3ndektsv4rrffq69g5fav"
	 */
	static fromUUID<const prefix extends string>(prefix: prefix, uuid: UUID) {
		let suffix = encode(uuid);
		return new TypeID(prefix, suffix);
	}

	/**
	 * Returns whether a value is a valid TypeID string.
	 *
	 * When `prefix` is provided, this also validates that the parsed prefix matches it.
	 *
	 * @template prefix String literal prefix type to enforce.
	 * @param value Value to validate.
	 * @param prefix Optional expected prefix.
	 * @returns Whether the value is valid.
	 * @example
	 * TypeID.isValid("user_01h455vb4pex5vsknk084sn02q", "user");
	 * // true
	 * TypeID.isValid("user_01h455vb4pex5vsknk084sn02q", "org");
	 * // false
	 */
	static isValid<const prefix extends string>(value: string, prefix?: prefix): boolean {
		try {
			TypeID.fromString(value, prefix);
			return true;
		} catch {
			return false;
		}
	}
}

/**
 * Creates a prefix-specific TypeID factory.
 *
 * @template prefix String literal prefix type to lock into the factory.
 * @param prefix Prefix to lock into the factory.
 * @returns Function that accepts a UUID and returns a TypeID.
 * @throws {InvalidPrefixError} If the captured prefix is invalid when the returned function is called.
 * @throws {InvalidUUIDFormatError} If the UUID passed to the returned function is invalid.
 * @throws {InvalidUUIDLengthError} If the UUID passed to the returned function has invalid length.
 * @throws {InvalidUUIDTypeError} If the UUID passed to the returned function is not a string.
 * @example
 * let createInvoiceId = typeid("invoice");
 * let invoiceId = createInvoiceId(crypto.randomUUID());
 */
export function typeid<prefix extends string>(prefix: prefix) {
	return (uuid: UUID) => TypeID.fromUUID(prefix, uuid);
}
