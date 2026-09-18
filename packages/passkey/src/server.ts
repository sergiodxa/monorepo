/**
 * The server half of a passkey: a relying party that issues ceremony options
 * and verifies what the browser signs.
 *
 * Registration and assertion are checked here against WebAuthn Level 3 using
 * only WebCrypto, so the same code runs on Workers, Node and Deno, and every
 * refusal comes back as a typed value naming which check failed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { AuthenticatedPasskey, StoredPasskey } from "./server/authentication.js";
export type { RegisteredPasskey } from "./server/registration.js";

export {
	AttestationError,
	ChallengeMismatchError,
	CounterError,
	CredentialMismatchError,
	CrossOriginError,
	MalformedResponseError,
	OriginMismatchError,
	PasskeyError,
	RelyingPartyMismatchError,
	UnsupportedAlgorithmError,
	UserPresenceError,
	UserVerificationError,
} from "./errors.js";
export { EDDSA, ES256, RS256 } from "./lib/cose.js";
export { RelyingParty } from "./server/relying-party.js";
