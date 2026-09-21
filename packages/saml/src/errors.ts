/**
 * Every failure this package answers with, as a value. The kinds are drawn so a
 * caller can tell a document it will never accept from one that arrived late or
 * twice, and so a refusal names the feature it refused rather than reading as a
 * generic rejection somebody has to reverse-engineer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Base class for every failure this package returns inside a `Result`. Read
 * `name` as the failure kind. No message carries key material, a decrypted
 * fragment, or anything an unauthenticated document supplied beyond a
 * fixed-vocabulary identifier, because these values are what gets logged.
 *
 * @example
 * if (isFailure(result)) logger.warn("assertion rejected", { kind: result.error.name });
 */
export class SAMLError extends Error {
	override name = "SAMLError";
}

/**
 * The document uses something this package will not implement, named so a
 * tenant reads which part of their identity provider's configuration to change
 * rather than meeting a refusal they cannot act on.
 */
export class UnsupportedFeatureError extends SAMLError {
	override name = "UnsupportedFeatureError";

	/** Fixed identifier for the feature, safe to log and to branch on. */
	feature: string;

	/**
	 * @param feature Fixed identifier for the refused feature.
	 * @param detail Fixed description of why it is refused.
	 */
	constructor(feature: string, detail: string) {
		super(`Unsupported ${feature}: ${detail}`);
		this.feature = feature;
	}
}

/**
 * The source is not XML this package can read, or a required element or
 * attribute is absent from it. This says nothing about authenticity: a document
 * that never parsed was never checked.
 */
export class MalformedDocumentError extends SAMLError {
	override name = "MalformedDocumentError";

	/**
	 * @param detail Fixed description of what the document is missing.
	 */
	constructor(detail: string) {
		super(`Malformed document: ${detail}`);
	}
}

/**
 * The document does not carry exactly one signature. Zero means nothing in it
 * was ever signed; more than one means the reader would have to choose which
 * one decides, and that choice is what a wrapped document is built around.
 */
export class UnsignedDocumentError extends SAMLError {
	override name = "UnsignedDocumentError";

	/** How many `ds:Signature` elements the document actually held. */
	count: number;

	/**
	 * @param count Number of signatures found.
	 */
	constructor(count: number) {
		super(`Expected exactly one signature, found ${count}`);
		this.count = count;
	}
}

/**
 * The signature's reference does not name exactly one element. A value no
 * element carries signs nothing, and a value two elements carry leaves the
 * digest able to match one while the claims are read from the other.
 */
export class UnresolvedReferenceError extends SAMLError {
	override name = "UnresolvedReferenceError";

	/** How many elements in the document carried the referenced id. */
	count: number;

	/**
	 * @param count Number of elements carrying the referenced id.
	 */
	constructor(count: number) {
		super(`Expected the reference to name exactly one element, found ${count}`);
		this.count = count;
	}
}

/**
 * The digest or the signature value did not match under any active certificate.
 * One value covers both, and covers every certificate, so a rejection reveals
 * nothing about which stage or which key came closest.
 */
export class SignatureMismatchError extends SAMLError {
	override name = "SignatureMismatchError";

	constructor() {
		super("Signature did not verify");
	}
}

/**
 * The element the claims would be read from is not the element the signature
 * covered. A document shaped this way verifies and still means nothing, which
 * is the whole family of wrapping attacks and the reason this check exists.
 */
export class WrappedAssertionError extends SAMLError {
	override name = "WrappedAssertionError";

	/**
	 * @param detail Fixed description of how the two elements diverged.
	 */
	constructor(detail: string) {
		super(`Signed element and read element differ: ${detail}`);
	}
}

/**
 * The encrypted assertion could not be opened. Every decryption outcome — a key
 * that does not fit, a tag that does not check, padding that does not hold,
 * plaintext that is not an assertion — arrives as this one value, so nothing a
 * caller does with it can answer questions on the cipher's behalf.
 */
export class DecryptionFailedError extends SAMLError {
	override name = "DecryptionFailedError";

	constructor() {
		super("Encrypted assertion could not be decrypted");
	}
}

/**
 * The response reports something other than success, so it carries no assertion
 * to read. The status code travels on the error because it is what tells a
 * refused sign-in apart from a provider that could not reach its directory.
 */
export class ResponseStatusError extends SAMLError {
	override name = "ResponseStatusError";

	/** Top-level `samlp:StatusCode` value the response reported. */
	status: string;

	/** Second-level status code, where the provider supplied one. */
	substatus: string | null;

	/**
	 * @param status Top-level status code URI.
	 * @param substatus Second-level status code URI, when present.
	 */
	constructor(status: string, substatus: string | null) {
		super(`Response status ${status}`);
		this.status = status;
		this.substatus = substatus;
	}
}

/**
 * The assertion is authentic and still does not apply here: it names another
 * audience or recipient, answers another request, or falls outside its own
 * validity window. Authenticity and applicability are separate answers, and a
 * caller that logs this one is looking at configuration rather than an attack.
 */
export class AssertionConditionError extends SAMLError {
	override name = "AssertionConditionError";

	/** Fixed identifier for the condition that failed, safe to branch on. */
	condition:
		| "audience"
		| "destination"
		| "recipient"
		| "in-response-to"
		| "not-before"
		| "not-on-or-after"
		| "subject";

	/**
	 * @param condition Which condition the assertion failed.
	 * @param detail Fixed description of the failure.
	 */
	constructor(condition: AssertionConditionError["condition"], detail: string) {
		super(`Assertion condition ${condition} failed: ${detail}`);
		this.condition = condition;
	}
}

/**
 * This assertion id was already accepted. A bearer assertion is replayable for
 * as long as its window is open, and remembering the ids is what closes that
 * window ahead of the clock.
 */
export class ReplayedAssertionError extends SAMLError {
	override name = "ReplayedAssertionError";

	constructor() {
		super("Assertion was already accepted");
	}
}

/**
 * The replay store could not be consulted, so no verdict was reached. This is
 * an infrastructure failure that says nothing about the assertion, and a caller
 * must never report it as an authentication failure.
 */
export class ReplayStoreError extends SAMLError {
	override name = "ReplayStoreError";

	/**
	 * @param cause Underlying error from the store, kept for diagnostics.
	 */
	constructor(cause?: unknown) {
		super("Replay store could not be consulted", { cause });
	}
}

/**
 * A certificate could not be read, or its key could not be imported. A
 * connection whose certificates all fail this verifies nothing, which is what a
 * rotation left half-finished looks like from here.
 */
export class CertificateError extends SAMLError {
	override name = "CertificateError";

	/**
	 * @param detail Fixed description of what the certificate is missing.
	 */
	constructor(detail: string) {
		super(`Invalid certificate: ${detail}`);
	}
}
