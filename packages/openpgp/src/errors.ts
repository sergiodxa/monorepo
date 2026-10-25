/**
 * The one failure every function in this package answers with. Its code says which step
 * failed, so a caller can tell a corrupt key from a wrong passphrase or a forged
 * signature without matching on message text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why an OpenPGP operation failed:
 *
 * - `malformed`: armor, a packet, a key or a signature breaks RFC 9580's grammar.
 * - `unsupported`: a version, algorithm, S2K or AEAD mode this package cannot handle with Web Crypto.
 * - `locked`: the private key is passphrase-protected and no passphrase was given.
 * - `bad-passphrase`: the passphrase does not unlock the private key.
 * - `no-signature`: the input carries no signature this package could evaluate.
 * - `unknown-signer`: no key given issued the signature.
 * - `invalid-signature`: a signature does not verify, or its signing key is unusable (revoked, expired, unbound).
 * - `crypto`: the runtime refused a Web Crypto operation.
 */
export type OpenPgpErrorCode =
	| "malformed"
	| "unsupported"
	| "locked"
	| "bad-passphrase"
	| "no-signature"
	| "unknown-signer"
	| "invalid-signature"
	| "crypto";

/** Returned inside a `Failure` by every function in this package, never thrown. */
export class OpenPgpError extends Error {
	override name = "OpenPgpError";

	/** Machine-readable cause, for a caller that maps it to a status or its own error. */
	readonly code: OpenPgpErrorCode;

	/**
	 * @param code - Which step failed.
	 * @param message - The explanation a log shows.
	 * @param options - The underlying error, when one was raised.
	 */
	constructor(code: OpenPgpErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.code = code;
	}
}
