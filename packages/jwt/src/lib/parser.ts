/**
 * Type-checked reads over a decoded JWT claim set.
 *
 * A JWT payload arrives as `unknown`-shaped JSON, so every claim a token class
 * exposes has to be both looked up and type-checked before it can be returned.
 * This module is the one place that does it, and the errors it raises name the
 * claim and the type mismatch so a malformed token is diagnosable from the log
 * line alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Base class for every failure this parser raises.
 *
 * A single base means a caller that only wants to distinguish "the token's claims
 * were not what I expected" from a genuine bug needs one `instanceof` check, while
 * the subclasses still let it tell a missing claim from a mistyped one.
 */
export class ParserError extends Error {
	override name = "ParserError";
}

/** Raised when a claim a token class requires is absent from the payload. */
export class MissingKeyError extends ParserError {
	override name = "ParserMissingKeyError";

	/**
	 * Builds the error for an absent claim.
	 *
	 * @param key - Name of the claim that was not present.
	 */
	constructor(key: string) {
		super(`Key "${key}" does not exist`);
	}
}

/** Raised when a claim is present but holds a value of the wrong JSON type. */
export class InvalidTypeError extends ParserError {
	override name = "ParserInvalidTypeError";

	/**
	 * Builds the error for a claim of an unexpected type.
	 *
	 * @param key - Name of the claim that was read.
	 * @param expected - Type the caller asked for.
	 * @param actual - Type the payload actually carried.
	 */
	constructor(key: string, expected: string, actual: string) {
		super(`Key "${key}" expected ${expected} but got ${actual}`);
	}
}

/**
 * Reads values out of a plain object, checking the type of each one.
 *
 * ## Why this throws instead of returning a `Result`
 *
 * Everything else in this monorepo returns a `Result` rather than throwing, and
 * this class deliberately does not. It exists to be called from inside property
 * getters on `JWT` subclasses:
 *
 * ```ts
 * get email(): string {
 * 	return this.parser.string("email");
 * }
 * ```
 *
 * A getter has no room for a `Result`: returning one would change the type of
 * every claim accessor across every token class in the repo, and force each of
 * their call sites to unwrap a value that, at that point in the flow, has already
 * been through signature verification. Throwing keeps the accessor's type equal to
 * the claim's type.
 *
 * The trade is acceptable because of *where* these reads happen. A claim that is
 * missing or mistyped after a token has verified means the issuer sent something
 * the token class does not model — closer to a programming error than to a runtime
 * condition a caller is expected to branch on. Request handlers already convert an
 * escaped throw into a 500, and the code paths that must not fail hard (verifying
 * an untrusted token) guard with `has` first or catch around the whole verify.
 *
 * Do not "fix" this to match the house convention without changing every token
 * class at the same time.
 */
export class ObjectParser {
	/** The object being read from, kept as `object` so reads stay explicit. */
	readonly #value: object;

	/**
	 * Wraps an object for type-checked reads.
	 *
	 * @param value - The decoded payload to read from.
	 * @throws {InvalidTypeError} When the value is not a non-null object.
	 */
	constructor(value: unknown) {
		if (typeof value !== "object" || value === null) {
			throw new InvalidTypeError("object", "object", value === null ? "null" : typeof value);
		}

		this.#value = value;
	}

	/**
	 * Reports whether a key is present, including when it holds `null`.
	 *
	 * This is the guard an optional claim needs, since every typed read below throws
	 * on a key that is not there.
	 *
	 * @param key - Claim name to look for.
	 * @returns Whether the key exists on the object.
	 * @example
	 * if (this.parser.has("nonce")) return this.parser.string("nonce");
	 */
	has(key: string): boolean {
		return key in this.#value;
	}

	/**
	 * Reads a key without checking its type.
	 *
	 * @param key - Claim name to read.
	 * @returns The raw value, which the typed readers narrow.
	 * @throws {MissingKeyError} When the key is not present.
	 */
	get(key: string): unknown {
		if (!(key in this.#value)) throw new MissingKeyError(key);
		return (this.#value as Record<string, unknown>)[key];
	}

	/**
	 * Reads a key as a string.
	 *
	 * @param key - Claim name to read.
	 * @returns The string value.
	 * @throws {MissingKeyError} When the key is not present.
	 * @throws {InvalidTypeError} When the value is not a string.
	 * @example
	 * this.parser.string("sub"); // "user-123"
	 */
	string(key: string): string {
		let value = this.get(key);
		if (typeof value === "string") return value;
		throw new InvalidTypeError(key, "string", typeOf(value));
	}

	/**
	 * Reads a key as a number.
	 *
	 * Time claims (`exp`, `iat`, `nbf`) are numbers in seconds, so this is what the
	 * date-shaped accessors are built on.
	 *
	 * @param key - Claim name to read.
	 * @returns The number value.
	 * @throws {MissingKeyError} When the key is not present.
	 * @throws {InvalidTypeError} When the value is not a number.
	 */
	number(key: string): number {
		let value = this.get(key);
		if (typeof value === "number") return value;
		throw new InvalidTypeError(key, "number", typeOf(value));
	}

	/**
	 * Reads a key as a boolean.
	 *
	 * Strict: the string `"true"` is a type error, not a `true`. An identity provider
	 * that sends `email_verified` as a string is sending something the token class
	 * does not model, and silently coercing it would turn that into a trusted `true`.
	 *
	 * @param key - Claim name to read.
	 * @returns The boolean value.
	 * @throws {MissingKeyError} When the key is not present.
	 * @throws {InvalidTypeError} When the value is not a boolean.
	 */
	boolean(key: string): boolean {
		let value = this.get(key);
		if (typeof value === "boolean") return value;
		throw new InvalidTypeError(key, "boolean", typeOf(value));
	}

	/**
	 * Reads a key as a nested object, wrapped for further type-checked reads.
	 *
	 * @param key - Claim name to read.
	 * @returns A parser over the nested object.
	 * @throws {MissingKeyError} When the key is not present.
	 * @throws {InvalidTypeError} When the value is not a non-null object.
	 * @example
	 * this.parser.object("events").has("http://schemas.openid.net/event/backchannel-logout");
	 */
	object(key: string): ObjectParser {
		let value = this.get(key);
		if (typeof value === "object" && value !== null) return new ObjectParser(value);
		throw new InvalidTypeError(key, "object", typeOf(value));
	}

	/**
	 * Returns the wrapped object, so a claim set can be handed on whole.
	 *
	 * @returns The object this parser reads from.
	 */
	valueOf(): object {
		return this.#value;
	}
}

/**
 * Names the type of a value for an error message.
 *
 * `typeof null` is `"object"`, which reads as a lie in `expected object but got
 * object`, so `null` gets its own name.
 *
 * @param value - The value whose type to name.
 * @returns A short type name suitable for an error message.
 */
function typeOf(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}
