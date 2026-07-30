/**
 * Error values returned by every failing operation in this package.
 *
 * All of them extend `CryptoError`, so one `instanceof` check covers the whole
 * package while the subclasses let callers branch on the cause. Messages carry
 * only the shape of the problem, never secrets, hashes, or ciphertext.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Longest algorithm tag kept in an error message before it is truncated. */
const MAX_TAG_LENGTH = 32;

/**
 * Reduces a value to a short `[A-Za-z0-9-]` tag safe to place in a message.
 *
 * Algorithm identifiers are read back from stored values, so they are treated as
 * untrusted input: anything outside the allowed characters is dropped and the
 * result is truncated, which keeps stored material out of error messages.
 */
function sanitizeTag(value: string): string {
	let tag = value.replaceAll(/[^A-Za-z0-9-]/g, "").slice(0, MAX_TAG_LENGTH);
	return tag.length > 0 ? tag : "unknown";
}

/**
 * Base class for every error this package returns inside a `Result`.
 *
 * Use it as the error type in signatures and as the `instanceof` check when the
 * specific cause does not change the caller's behavior.
 *
 * @example
 * if (isFailure(result) && result.error instanceof CryptoError) reportFailure();
 */
export class CryptoError extends Error {
	override name = "CryptoError";
}

/**
 * A string could not be decoded with the encoding it was expected to use.
 *
 * The offending input is deliberately absent from the message, because the same
 * error covers secrets such as TOTP seeds and sealed payloads.
 *
 * @example
 * let bytes = Hex.decode("zz"); // failure(new InvalidEncodingError("hex"))
 */
export class InvalidEncodingError extends CryptoError {
	override name = "InvalidEncodingError";

	/**
	 * @param encoding Name of the expected encoding, such as "hex" or "base64url".
	 */
	constructor(encoding: string) {
		super(`Invalid ${encoding} input`);
	}
}

/**
 * A stored password hash does not follow the encoded format this package writes.
 *
 * Callers see this for values produced by a different hashing scheme, which is
 * the signal to fall back to a compatibility path or to force a reset.
 */
export class MalformedHashError extends CryptoError {
	override name = "MalformedHashError";

	/**
	 * @param reason Fixed description of the structural problem, free of stored material.
	 */
	constructor(reason: string) {
		super(`Malformed password hash: ${reason}`);
	}
}

/**
 * An algorithm identifier is syntactically valid but not supported here.
 *
 * The identifier is sanitized before it reaches the message, so a hostile stored
 * value cannot smuggle content into logs.
 */
export class UnsupportedAlgorithmError extends CryptoError {
	override name = "UnsupportedAlgorithmError";

	/**
	 * @param algorithm Algorithm identifier, sanitized down to a short tag.
	 */
	constructor(algorithm: string) {
		super(`Unsupported algorithm: ${sanitizeTag(algorithm)}`);
	}
}

/**
 * Raw key material could not be turned into a usable `CryptoKey`.
 *
 * Raised for wrong key sizes and for material the runtime rejects; the key bytes
 * themselves never appear in the message.
 */
export class InvalidKeyError extends CryptoError {
	override name = "InvalidKeyError";

	/**
	 * @param reason Fixed description of why the key was rejected.
	 */
	constructor(reason: string) {
		super(`Invalid key: ${reason}`);
	}
}

/**
 * A sealed value does not match the versioned envelope format.
 *
 * Distinct from `DecryptionError`: the envelope never reached the cipher, so this
 * says nothing about whether the key or the authentication tag was correct.
 */
export class InvalidEnvelopeError extends CryptoError {
	override name = "InvalidEnvelopeError";

	/**
	 * @param reason Fixed description of the envelope problem, free of ciphertext.
	 */
	constructor(reason: string) {
		super(`Invalid sealed value: ${reason}`);
	}
}

/**
 * Authenticated decryption failed for a well-formed envelope.
 *
 * The message is intentionally identical for a wrong key and for tampered
 * ciphertext, so failures cannot be used as an oracle.
 */
export class DecryptionError extends CryptoError {
	override name = "DecryptionError";

	constructor() {
		super("Decryption failed");
	}
}
