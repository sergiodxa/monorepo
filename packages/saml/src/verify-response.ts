/**
 * The one call a service provider makes on an inbound response: it refuses what
 * it will not parse, verifies the single signature, and answers with an
 * assertion built from the element that signature covered and from nothing
 * else, so the signed element and the read element cannot be two elements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { failure, isFailure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import type { Certificate } from "./certificate.js";
import type { SAMLError } from "./errors.js";
import type { SigningKey } from "./lib/signature.js";
import type { Element } from "./lib/tree.js";
import type { ReplayStore } from "./replay-store.js";

import { Assertion } from "./assertion.js";
import {
	AssertionConditionError,
	DecryptionFailedError,
	MalformedDocumentError,
	ReplayedAssertionError,
	ReplayStoreError,
	ResponseStatusError,
	UnsignedDocumentError,
	UnsupportedFeatureError,
	WrappedAssertionError,
} from "./errors.js";
import { decryptAssertion } from "./lib/decrypt.js";
import {
	ASSERTION_NS,
	BEARER_CONFIRMATION,
	ENCRYPTION_NS,
	PROTOCOL_NS,
	SIGNATURE_NS,
	STATUS_SUCCESS,
} from "./lib/namespaces.js";
import { verifySignature } from "./lib/signature.js";
import { attribute, child, children, descendsFrom, locate, text, walk } from "./lib/tree.js";

/** A document type declaration, refused before anything reads the source. */
const DOCTYPE_PATTERN = /<!DOCTYPE/i;

/** Any processing instruction, of which only a leading XML declaration is allowed. */
const PROCESSING_INSTRUCTION_PATTERN = /<\?/g;

/** The XML declaration, which may open a document and is not a construct this refuses. */
const XML_DECLARATION_PATTERN = /^\s*<\?xml[\s?]/;

/**
 * How a caller configures a verification.
 *
 * Every field is required and none carries a default, so a call that forgets
 * the audience does not typecheck, `inResponseTo: null` is a sentence somebody
 * wrote, and the replay check that makes the others worth running is always
 * present.
 */
export interface VerifyResponseOptions {
	/** The connection's active signing certificates; any one of them may verify. */
	certificates: readonly Certificate[];

	/** The service provider's entity id, which the assertion must restrict itself to. */
	audience: string;

	/** The assertion consumer service URL the response names as where it was sent. */
	destination: string;

	/** The assertion consumer service URL the confirmation names as its recipient. */
	recipient: string;

	/**
	 * The id of the request this answers, or `null` for a sign-in the provider
	 * started on its own, where no request exists to be answered.
	 */
	inResponseTo: string | null;

	/**
	 * The private keys an encrypted assertion may be opened with, or `null` where
	 * the connection takes cleartext assertions alone. Several keys let one
	 * private half be presented under both OAEP digests providers emit, and let a
	 * key rotation stay open while both halves are configured.
	 */
	decryptionKey: CryptoKey | readonly CryptoKey[] | null;

	/** Where accepted assertion ids are remembered until their windows close. */
	replay: ReplayStore;

	/** The moment to judge every window against, and how far a provider's clock may drift. */
	clock: { now: Date; skew: DurationInput };
}

/**
 * Verifies a SAML response and answers with the assertion inside it.
 *
 * @param source - The decoded `SAMLResponse` XML, as the browser posted it
 * @param options - The connection's trust configuration and clock
 * @returns The verified assertion, or the failure that stopped verification
 */
export async function verifyResponse(
	source: string,
	options: VerifyResponseOptions,
): Promise<Result<Assertion, SAMLError>> {
	let refused = refuseUnreadableConstructs(source);
	if (refused) return failure(refused);

	let parsed = XML.parse(source, { whitespace: "preserve" });
	if (isFailure(parsed)) return failure(new MalformedDocumentError(parsed.error.message));

	let response = locate(parsed.data.root);
	if (response.uri !== PROTOCOL_NS || response.local !== "Response") {
		return failure(new MalformedDocumentError("root element is not a SAML Response"));
	}

	let status = readStatus(response);
	if (status) return failure(status);

	let resolved = await resolveAssertionDocument(response, options);
	if (isFailure(resolved)) return resolved;

	let signatures = [...signaturesIn(response), ...signaturesIn(resolved.data.root)].filter(
		(signature, index, all) => all.indexOf(signature) === index,
	);
	if (signatures.length !== 1 || !signatures[0]) {
		return failure(new UnsignedDocumentError(signatures.length));
	}

	let signature = signatures[0];
	let document = descendsFrom(response, signature) ? response : resolved.data.root;
	let keys: SigningKey[] = options.certificates.map((certificate) => ({
		algorithm: certificate.algorithm,
		spki: certificate.spki,
	}));

	let verified = await verifySignature(document, signature, keys);
	if (isFailure(verified)) return verified;

	let assertion = selectAssertion(verified.data.covered, resolved.data.assertion);
	if (isFailure(assertion)) return assertion;

	return finish(response, assertion.data, options);
}

/**
 * Refuses the constructs this package will not read before a parser is handed
 * the source. A document type declaration is where external entities and
 * expansion live, and a processing instruction survives canonicalization
 * elsewhere while this tree leaves it out, which would move the bytes a digest
 * covers.
 */
function refuseUnreadableConstructs(source: string): UnsupportedFeatureError | null {
	if (DOCTYPE_PATTERN.test(source)) {
		return new UnsupportedFeatureError(
			"document type declaration",
			"a document carrying a DOCTYPE is refused before it is parsed",
		);
	}

	let declared = XML_DECLARATION_PATTERN.test(source);
	let instructions = source.match(PROCESSING_INSTRUCTION_PATTERN)?.length ?? 0;
	if (instructions > (declared ? 1 : 0)) {
		return new UnsupportedFeatureError(
			"processing instruction",
			"only a leading XML declaration may appear",
		);
	}

	return null;
}

/**
 * Reads the response's status, which is what says whether an assertion is even
 * meant to be present. A provider that refused a sign-in reports it here and
 * sends nothing signed to read it from.
 */
function readStatus(response: Element): ResponseStatusError | MalformedDocumentError | null {
	let status = child(response, PROTOCOL_NS, "Status");
	if (!status) return new MalformedDocumentError("response carries no Status");

	let code = child(status, PROTOCOL_NS, "StatusCode");
	if (!code) return new MalformedDocumentError("response carries no StatusCode");

	let value = attribute(code, "Value") ?? "";
	if (value === STATUS_SUCCESS) return null;

	let nested = child(code, PROTOCOL_NS, "StatusCode");
	return new ResponseStatusError(value, nested ? (attribute(nested, "Value") ?? null) : null);
}

/**
 * The document the assertion is read out of, and the assertion itself. A
 * cleartext response is its own document; an encrypted one is opened into a
 * second document whose root is the assertion, and whose signature, where the
 * provider signed the assertion rather than the response, lives inside it.
 */
async function resolveAssertionDocument(
	response: Element,
	options: VerifyResponseOptions,
): Promise<Result<{ root: Element; assertion: Element[] }, SAMLError>> {
	let cleartext = children(response, ASSERTION_NS, "Assertion");
	let encrypted = children(response, ASSERTION_NS, "EncryptedAssertion");

	if (encrypted.length === 0) return success({ root: response, assertion: cleartext });

	if (encrypted.length > 1 || cleartext.length > 0) {
		return failure(
			new WrappedAssertionError("the response carries more than one assertion to choose from"),
		);
	}

	let keys = toKeyList(options.decryptionKey);
	if (keys.length === 0) {
		return failure(
			new UnsupportedFeatureError(
				"encrypted assertion",
				"this connection is configured for cleartext assertions",
			),
		);
	}

	let first = encrypted[0];
	if (!first) return failure(new MalformedDocumentError("response carries no EncryptedAssertion"));

	let plaintext = await decryptAssertion(first, keys);
	if (isFailure(plaintext)) return plaintext;

	let root = readDecryptedAssertion(plaintext.data);
	if (isFailure(root)) return root;

	return success({ root: root.data, assertion: [root.data] });
}

/**
 * Reads decrypted bytes into the assertion they have to be. Every way this can
 * fail answers as the one decryption failure, so a key that did not fit, a
 * plaintext that is not XML and a document that is not an assertion are one
 * outcome, and an attempt cannot be used to ask the cipher a question.
 */
function readDecryptedAssertion(plaintext: string): Result<Element, SAMLError> {
	if (refuseUnreadableConstructs(plaintext)) return failure(new DecryptionFailedError());

	let parsed = XML.parse(plaintext, { whitespace: "preserve" });
	if (isFailure(parsed)) return failure(new DecryptionFailedError());

	let root = locate(parsed.data.root);
	if (root.uri !== ASSERTION_NS || root.local !== "Assertion") {
		return failure(new DecryptionFailedError());
	}

	return success(root);
}

/**
 * Reads the option that may be one key or several into the list every later
 * step works from.
 */
function toKeyList(key: CryptoKey | readonly CryptoKey[] | null): readonly CryptoKey[] {
	if (!key) return [];
	return isKeyList(key) ? key : [key];
}

/**
 * Tells the two shapes the decryption option accepts apart, which a plain
 * array check cannot do for a readonly array on its own.
 */
function isKeyList(key: CryptoKey | readonly CryptoKey[]): key is readonly CryptoKey[] {
	return Array.isArray(key);
}

/** Every signature element in one document, in document order. */
function signaturesIn(root: Element): Element[] {
	let found: Element[] = [];
	for (let element of walk(root)) {
		if (element.uri === SIGNATURE_NS && element.local === "Signature") found.push(element);
		if (element.uri === ENCRYPTION_NS && element.local === "EncryptedData") found.pop();
	}
	return found;
}

/**
 * Settles which element the claims come from. Where the signature covered an
 * assertion, that assertion is the answer. Where it covered the response, the
 * document must hold exactly one assertion and it must descend from what was
 * signed, so an assertion parked beside the signed element reaches nothing.
 */
function selectAssertion(
	covered: Element,
	candidates: readonly Element[],
): Result<Element, SAMLError> {
	if (covered.uri === ASSERTION_NS && covered.local === "Assertion") return success(covered);

	if (covered.uri !== PROTOCOL_NS || covered.local !== "Response") {
		return failure(
			new WrappedAssertionError("the signature covers neither a Response nor an Assertion"),
		);
	}

	if (candidates.length !== 1 || !candidates[0]) {
		return failure(
			new WrappedAssertionError(
				`a signed response must hold exactly one assertion, and holds ${candidates.length}`,
			),
		);
	}

	let assertion = candidates[0];
	if (!descendsFrom(covered, assertion)) {
		return failure(new WrappedAssertionError("the assertion sits outside the signed element"));
	}

	return success(assertion);
}

/**
 * Runs everything an authentic assertion still has to satisfy to apply here,
 * then remembers its id. The replay store is written only once every other
 * check has passed, so a document that failed verification cannot fill it.
 */
async function finish(
	response: Element,
	assertion: Element,
	options: VerifyResponseOptions,
): Promise<Result<Assertion, SAMLError>> {
	let id = attribute(assertion, "ID");
	if (!id) return failure(new MalformedDocumentError("assertion carries no ID"));

	let issuerElement = child(assertion, ASSERTION_NS, "Issuer");
	let issuer = issuerElement ? text(issuerElement).trim() : "";
	if (issuer === "") return failure(new MalformedDocumentError("assertion carries no Issuer"));

	let skew = toMs(options.clock.skew);
	let now = options.clock.now.getTime();

	let destination = attribute(response, "Destination");
	if (destination !== undefined && destination !== options.destination) {
		return failure(
			new AssertionConditionError("destination", "the response names another consumer service"),
		);
	}

	let confirmation = readBearerConfirmation(assertion);
	if (isFailure(confirmation)) return confirmation;

	if (attribute(confirmation.data, "Recipient") !== options.recipient) {
		return failure(
			new AssertionConditionError("recipient", "the confirmation names another consumer service"),
		);
	}

	let answered = attribute(confirmation.data, "InResponseTo") ?? null;
	if (answered !== options.inResponseTo) {
		return failure(
			new AssertionConditionError("in-response-to", "the assertion answers another request"),
		);
	}

	let window = readWindow(assertion, confirmation.data);
	if (isFailure(window)) return window;

	if (window.data.notBefore && now + skew < window.data.notBefore.getTime()) {
		return failure(new AssertionConditionError("not-before", "the assertion is not yet valid"));
	}

	if (now - skew >= window.data.notOnOrAfter.getTime()) {
		return failure(new AssertionConditionError("not-on-or-after", "the assertion has expired"));
	}

	let audience = checkAudience(assertion, options.audience);
	if (audience) return failure(audience);

	let remembered = await remember(id, window.data.notOnOrAfter, options);
	if (remembered) return failure(remembered);

	return success(Assertion.read(assertion, id, issuer, window.data.notOnOrAfter));
}

/**
 * The bearer subject confirmation, which is where the values binding an
 * assertion to this service provider and to this request are written.
 */
function readBearerConfirmation(assertion: Element): Result<Element, SAMLError> {
	let subject = child(assertion, ASSERTION_NS, "Subject");
	if (!subject) return failure(new MalformedDocumentError("assertion carries no Subject"));

	for (let confirmation of children(subject, ASSERTION_NS, "SubjectConfirmation")) {
		if (attribute(confirmation, "Method") !== BEARER_CONFIRMATION) continue;
		let data = child(confirmation, ASSERTION_NS, "SubjectConfirmationData");
		if (data) return success(data);
	}

	return failure(
		new AssertionConditionError("subject", "the assertion carries no bearer subject confirmation"),
	);
}

/**
 * The window the assertion applies in, taken as the narrowest the document
 * offered, so the shortest expiry any part of it named is the one that governs
 * and the one an id is remembered until.
 */
function readWindow(
	assertion: Element,
	confirmation: Element,
): Result<{ notBefore: Date | null; notOnOrAfter: Date }, SAMLError> {
	let conditions = child(assertion, ASSERTION_NS, "Conditions");
	let expiries: Date[] = [];

	let confirmationExpiry = readInstant(attribute(confirmation, "NotOnOrAfter"));
	if (confirmationExpiry) expiries.push(confirmationExpiry);

	let conditionsExpiry = conditions
		? readInstant(attribute(conditions, "NotOnOrAfter"))
		: undefined;
	if (conditionsExpiry) expiries.push(conditionsExpiry);

	if (expiries.length === 0) {
		return failure(
			new AssertionConditionError("not-on-or-after", "the assertion names no expiry to judge"),
		);
	}

	let notOnOrAfter = expiries.reduce((earliest, candidate) =>
		candidate < earliest ? candidate : earliest,
	);

	let notBefore = conditions ? (readInstant(attribute(conditions, "NotBefore")) ?? null) : null;

	return success({ notBefore, notOnOrAfter });
}

/**
 * Reads one `xsd:dateTime`, answering nothing for a value that is absent or
 * that names no moment, so a window is judged on instants alone.
 */
function readInstant(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	let instant = new Date(value);
	return Number.isNaN(instant.getTime()) ? undefined : instant;
}

/**
 * Checks that the assertion restricts itself to this service provider. An
 * assertion issued for somebody else is authentic and still says nothing here,
 * which is the difference an audience exists to draw.
 */
function checkAudience(assertion: Element, expected: string): AssertionConditionError | null {
	let conditions = child(assertion, ASSERTION_NS, "Conditions");
	if (!conditions) {
		return new AssertionConditionError("audience", "the assertion restricts itself to no audience");
	}

	for (let restriction of children(conditions, ASSERTION_NS, "AudienceRestriction")) {
		for (let audience of children(restriction, ASSERTION_NS, "Audience")) {
			if (text(audience).trim() === expected) return null;
		}
	}

	return new AssertionConditionError("audience", "the assertion is addressed to another audience");
}

/**
 * Refuses an id the store already holds, then records it for the rest of the
 * window it was accepted in. A store that cannot answer stops the verification
 * as an infrastructure failure, which says nothing about the assertion.
 */
async function remember(
	id: string,
	notOnOrAfter: Date,
	options: VerifyResponseOptions,
): Promise<SAMLError | null> {
	let skew = toMs(options.clock.skew);
	let ttl = Math.max(notOnOrAfter.getTime() + skew - options.clock.now.getTime(), skew);

	try {
		if (await options.replay.seen(id)) return new ReplayedAssertionError();
		await options.replay.remember(id, ttl);
		return null;
	} catch (error) {
		return new ReplayStoreError(error);
	}
}
