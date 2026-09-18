/**
 * Every failure this package reports, as a value rather than a thrown exception.
 *
 * All of them extend `PasskeyError`, so one `instanceof` check covers the whole
 * package while the subclasses let a caller tell "the user closed the sheet"
 * apart from "the signature did not verify" and answer each accordingly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Base class for every error this package returns inside a `Result`.
 *
 * Use it as the error type in signatures and as the `instanceof` check when a
 * caller treats every cause the same way.
 *
 * @example
 * if (isFailure(result) && result.error instanceof PasskeyError) showRetry();
 */
export class PasskeyError extends Error {
	override name = "PasskeyError";
}

/**
 * The browser exposes no WebAuthn API, or the page is not a secure context.
 *
 * Reaching this means the ceremony never started, so the sign-in form should
 * keep offering whatever other credential the account has.
 */
export class UnsupportedError extends PasskeyError {
	override name = "UnsupportedError";

	constructor() {
		super("This browser cannot create or use passkeys");
	}
}

/**
 * The person dismissed the passkey sheet, or the ceremony was aborted.
 *
 * This is the ordinary outcome of a conditional-UI prompt nobody answered, so
 * it deserves silence rather than an error message.
 */
export class CancelledError extends PasskeyError {
	override name = "CancelledError";

	constructor() {
		super("The passkey request was dismissed");
	}
}

/**
 * The authenticator already holds one of the credentials registration excluded.
 *
 * The person is trying to enroll a device they enrolled before, so the answer
 * is to send them to sign in rather than to retry registration.
 */
export class AlreadyRegisteredError extends PasskeyError {
	override name = "AlreadyRegisteredError";

	constructor() {
		super("This device already has a passkey for this account");
	}
}

/**
 * The browser refused the ceremony for a reason the caller can act on only by
 * retrying or offering another credential.
 *
 * The originating `DOMException` is kept as `cause`, because its `name` is the
 * only detail that distinguishes a timeout from a blocked relying-party id.
 */
export class CeremonyError extends PasskeyError {
	override name = "CeremonyError";

	/**
	 * @param cause The exception the credentials API rejected with.
	 */
	constructor(cause: unknown) {
		super("The browser refused the passkey request", { cause });
	}
}

/**
 * The options handed to a ceremony are not the ones a relying party issues.
 *
 * Reaching this means the sign-in page and the endpoint that issues options
 * have drifted apart, so it is a wiring problem rather than a failed attempt.
 */
export class InvalidOptionsError extends PasskeyError {
	override name = "InvalidOptionsError";

	constructor() {
		super("The ceremony options are unreadable");
	}
}

/**
 * The submitted body is not a WebAuthn response this package can read.
 *
 * Covers a body that fails the schema, a base64url field that will not decode,
 * and authenticator data too short to hold the fields it claims.
 */
export class MalformedResponseError extends PasskeyError {
	override name = "MalformedResponseError";

	/**
	 * @param detail Shape of the problem, free of any submitted value.
	 */
	constructor(detail: string) {
		super(`Malformed passkey response: ${detail}`);
	}
}

/**
 * The attestation statement is absent where one is required, inconsistent with
 * the credential it accompanies, or in a format this package cannot check.
 *
 * Registration fails closed: a statement that cannot be verified is refused
 * rather than accepted unverified.
 */
export class AttestationError extends PasskeyError {
	override name = "AttestationError";

	/**
	 * @param detail Shape of the problem, free of any submitted value.
	 */
	constructor(detail: string) {
		super(`Attestation refused: ${detail}`);
	}
}

/**
 * The ceremony ran inside a cross-origin frame.
 *
 * An embedded frame running a ceremony is indistinguishable, to the person, from
 * the top-level site doing it, so the response is refused unless the relying
 * party opted into framed ceremonies.
 */
export class CrossOriginError extends PasskeyError {
	override name = "CrossOriginError";

	constructor() {
		super("The ceremony ran inside a cross-origin frame");
	}
}

/**
 * The challenge the client signed is not the one issued for this ceremony.
 *
 * Both a replayed response and a mixed-up ceremony land here, so treat it as a
 * failed attempt and issue a fresh challenge.
 */
export class ChallengeMismatchError extends PasskeyError {
	override name = "ChallengeMismatchError";

	constructor() {
		super("The signed challenge does not match the one issued");
	}
}

/**
 * The page that ran the ceremony is not an origin this relying party accepts.
 */
export class OriginMismatchError extends PasskeyError {
	override name = "OriginMismatchError";

	/**
	 * @param origin Origin the client reported, which is already public to it.
	 */
	constructor(origin: string) {
		super(`Origin ${origin} is not allowed for this relying party`);
	}
}

/**
 * The authenticator signed for a different relying party id than this one.
 *
 * A credential is bound to the id it was created under, so this also catches a
 * passkey enrolled before the relying party id changed.
 */
export class RelyingPartyMismatchError extends PasskeyError {
	override name = "RelyingPartyMismatchError";

	constructor() {
		super("The credential belongs to a different relying party");
	}
}

/**
 * The authenticator reported no user presence, so nobody touched the device.
 */
export class UserPresenceError extends PasskeyError {
	override name = "UserPresenceError";

	constructor() {
		super("The authenticator reported no user presence");
	}
}

/**
 * User verification was required and the authenticator did not perform it.
 *
 * The credential proves possession of the device but not of the biometric or
 * PIN, which is the difference a second factor is asked for.
 */
export class UserVerificationError extends PasskeyError {
	override name = "UserVerificationError";

	constructor() {
		super("The authenticator did not verify the user");
	}
}

/**
 * The assertion came from a different credential than the stored one.
 */
export class CredentialMismatchError extends PasskeyError {
	override name = "CredentialMismatchError";

	constructor() {
		super("The assertion is for a different credential");
	}
}

/**
 * The assertion signature does not verify under the stored public key.
 */
export class SignatureError extends PasskeyError {
	override name = "SignatureError";

	constructor() {
		super("The assertion signature is invalid");
	}
}

/**
 * The authenticator's signature counter did not advance past the stored one.
 *
 * A counter that stands still or goes backwards is the one signal WebAuthn
 * gives that a credential has been cloned, so the assertion is refused.
 */
export class CounterError extends PasskeyError {
	override name = "CounterError";

	/**
	 * @param stored Counter last recorded for the credential.
	 * @param received Counter the authenticator just reported.
	 */
	constructor(stored: number, received: number) {
		super(`Signature counter went from ${stored} to ${received}`);
	}
}

/**
 * The credential's key uses a COSE algorithm this package cannot verify.
 *
 * Only the algorithms a relying party advertises can come back, so this means
 * `algorithms` asked for something wider than what is supported.
 */
export class UnsupportedAlgorithmError extends PasskeyError {
	override name = "UnsupportedAlgorithmError";

	/**
	 * @param algorithm COSE algorithm identifier the credential carries.
	 */
	constructor(algorithm: number) {
		super(`COSE algorithm ${algorithm} is not supported`);
	}
}
