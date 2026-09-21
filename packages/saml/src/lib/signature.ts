/**
 * XML Signature verification, from the reference a signature names to the
 * element it turns out to cover. It answers with that element and nothing else,
 * so a caller has no way to read claims out of one the signature did not reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { timingSafeEqual } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import type { SAMLError } from "../errors.js";

import {
	MalformedDocumentError,
	SignatureMismatchError,
	UnresolvedReferenceError,
	UnsupportedFeatureError,
	WrappedAssertionError,
} from "../errors.js";

import type { PublicKeyAlgorithm } from "./der.js";
import type { SignatureAlgorithm } from "./namespaces.js";
import type { Element } from "./tree.js";

import { decodeBase64Text, toBufferSource } from "./bytes.js";
import { canonicalize } from "./canonicalize.js";
import {
	DIGEST_ALGORITHMS,
	ENVELOPED_SIGNATURE,
	EXC_C14N,
	SIGNATURE_ALGORITHMS,
	SIGNATURE_NS,
} from "./namespaces.js";
import { attribute, child, children, elementsWithId, text } from "./tree.js";

/**
 * A public key a signature may be verified against, in the form Web Crypto
 * imports it from.
 */
export interface SigningKey {
	algorithm: PublicKeyAlgorithm;
	spki: Uint8Array;
}

/**
 * What a verified signature establishes: the one element it covered. Nothing
 * else from the document travels with it, because everything else is unsigned.
 */
export interface VerifiedSignature {
	covered: Element;
}

/**
 * Verifies one signature against a set of keys, answering the element it
 * covered. A signature that verifies under any key is accepted, so a provider
 * mid-rotation keeps working while both of its certificates are configured.
 *
 * @param document - Root of the document the signature was found in
 * @param signature - The `ds:Signature` element to verify
 * @param keys - Public keys the connection currently trusts
 * @returns The covered element, or the failure that stopped verification
 */
export async function verifySignature(
	document: Element,
	signature: Element,
	keys: readonly SigningKey[],
): Promise<Result<VerifiedSignature, SAMLError>> {
	let signedInfo = child(signature, SIGNATURE_NS, "SignedInfo");
	if (!signedInfo) return failure(new MalformedDocumentError("signature carries no SignedInfo"));

	let method = readCanonicalizationMethod(signedInfo);
	if (method.status === "failure") return method;

	let algorithm = readSignatureMethod(signedInfo);
	if (algorithm.status === "failure") return algorithm;

	let covered = await verifyReference(document, signature, signedInfo);
	if (covered.status === "failure") return covered;

	let signatureValue = child(signature, SIGNATURE_NS, "SignatureValue");
	if (!signatureValue) {
		return failure(new MalformedDocumentError("signature carries no SignatureValue"));
	}

	let provided = decodeBase64Text(text(signatureValue), "SignatureValue");
	if (provided.status === "failure") return provided;

	let signed = canonicalize(signedInfo, { inclusivePrefixes: method.data });
	let verified = await verifyAgainstKeys(algorithm.data, keys, provided.data, signed);
	if (!verified) return failure(new SignatureMismatchError());

	return success({ covered: covered.data });
}

/**
 * Reads the canonicalization the signer applied to `SignedInfo`, refusing every
 * form whose result this package cannot reproduce — the inclusive algorithms,
 * which keep ancestor declarations, and the commented forms, which a tree
 * holding no comments cannot express.
 */
function readCanonicalizationMethod(
	signedInfo: Element,
): Result<ReadonlySet<string>, UnsupportedFeatureError | MalformedDocumentError> {
	let method = child(signedInfo, SIGNATURE_NS, "CanonicalizationMethod");
	if (!method) {
		return failure(new MalformedDocumentError("SignedInfo carries no CanonicalizationMethod"));
	}

	let algorithm = attribute(method, "Algorithm") ?? "";
	if (algorithm !== EXC_C14N) {
		return failure(
			new UnsupportedFeatureError(
				"canonicalization",
				"only exclusive XML canonicalization 1.0 without comments is performed",
			),
		);
	}

	return success(readPrefixList(method));
}

/**
 * Reads the signature and digest algorithms, which SHA-1, DSA and RSA-PSS are
 * absent from, so a document naming one of those is refused here rather than
 * verified against a primitive this package will not stand behind.
 */
function readSignatureMethod(
	signedInfo: Element,
): Result<SignatureAlgorithm, UnsupportedFeatureError | MalformedDocumentError> {
	let method = child(signedInfo, SIGNATURE_NS, "SignatureMethod");
	if (!method) {
		return failure(new MalformedDocumentError("SignedInfo carries no SignatureMethod"));
	}

	let algorithm = SIGNATURE_ALGORITHMS[attribute(method, "Algorithm") ?? ""];
	if (!algorithm) {
		return failure(
			new UnsupportedFeatureError(
				"signature algorithm",
				"only RSASSA-PKCS1-v1_5 and ECDSA over SHA-256, SHA-384 and SHA-512 are accepted",
			),
		);
	}

	return success(algorithm);
}

/**
 * Resolves the one reference to the one element it names, then checks that the
 * element's canonical form still digests to what the signer recorded. The
 * reference must name an id exactly one element carries and must be enveloped
 * by that element, which together are what a wrapped document cannot satisfy.
 */
async function verifyReference(
	document: Element,
	signature: Element,
	signedInfo: Element,
): Promise<Result<Element, SAMLError>> {
	let references = children(signedInfo, SIGNATURE_NS, "Reference");
	if (references.length !== 1 || !references[0]) {
		return failure(
			new UnsupportedFeatureError(
				"reference count",
				"a signature covering anything other than exactly one element is refused",
			),
		);
	}

	let reference = references[0];
	let uri = attribute(reference, "URI") ?? "";
	if (!uri.startsWith("#") || uri.length === 1) {
		return failure(
			new UnsupportedFeatureError(
				"reference form",
				"only a same-document reference naming an element id is resolved",
			),
		);
	}

	let transforms = readTransforms(reference);
	if (transforms.status === "failure") return transforms;

	let matches = elementsWithId(document, uri.slice(1));
	if (matches.length !== 1 || !matches[0]) {
		return failure(new UnresolvedReferenceError(matches.length));
	}

	let covered = matches[0];
	if (signature.parent !== covered) {
		return failure(
			new WrappedAssertionError("the signature is not enveloped by the element it references"),
		);
	}

	let digestMethod = child(reference, SIGNATURE_NS, "DigestMethod");
	let digestValue = child(reference, SIGNATURE_NS, "DigestValue");
	if (!digestMethod || !digestValue) {
		return failure(new MalformedDocumentError("reference carries no digest"));
	}

	let hash = DIGEST_ALGORITHMS[attribute(digestMethod, "Algorithm") ?? ""];
	if (!hash) {
		return failure(
			new UnsupportedFeatureError(
				"digest algorithm",
				"only SHA-256, SHA-384 and SHA-512 are accepted",
			),
		);
	}

	let expected = decodeBase64Text(text(digestValue), "DigestValue");
	if (expected.status === "failure") return expected;

	let form = canonicalize(covered, { inclusivePrefixes: transforms.data, omit: signature });
	let actual = await crypto.subtle.digest(hash, new TextEncoder().encode(form));
	if (!timingSafeEqual(new Uint8Array(actual), expected.data)) {
		return failure(new SignatureMismatchError());
	}

	return success(covered);
}

/**
 * Reads the transform chain, which must be the enveloped-signature removal
 * followed by exclusive canonicalization and nothing else. An XPath or XSLT
 * transform would put an evaluator inside the check it is part of, and the
 * feature it serves is the one wrapping is built on.
 */
function readTransforms(
	reference: Element,
): Result<ReadonlySet<string>, UnsupportedFeatureError | MalformedDocumentError> {
	let container = child(reference, SIGNATURE_NS, "Transforms");
	if (!container) return failure(new MalformedDocumentError("reference carries no Transforms"));

	let transforms = children(container, SIGNATURE_NS, "Transform");
	let algorithms = transforms.map((transform) => attribute(transform, "Algorithm") ?? "");

	if (
		algorithms.length !== 2 ||
		algorithms[0] !== ENVELOPED_SIGNATURE ||
		algorithms[1] !== EXC_C14N
	) {
		return failure(
			new UnsupportedFeatureError(
				"transform chain",
				"only the enveloped-signature transform followed by exclusive canonicalization is applied",
			),
		);
	}

	let exclusive = transforms[1];
	return success(exclusive ? readPrefixList(exclusive) : new Set<string>());
}

/**
 * Reads an `InclusiveNamespaces PrefixList`, whose entries are canonicalized as
 * though the element had used them, so the signer's choice to pin a prefix
 * reaches the verifier that has to reproduce those same bytes.
 */
function readPrefixList(element: Element): ReadonlySet<string> {
	let inclusive = child(element, EXC_C14N, "InclusiveNamespaces");
	if (!inclusive) return new Set<string>();

	let list = attribute(inclusive, "PrefixList") ?? "";
	return new Set(list.split(/\s+/).filter((prefix) => prefix.length > 0));
}

/**
 * Tries every trusted key in turn, answering only whether one of them verified.
 * Which key it was stays here, so a rejection tells a caller nothing about
 * which certificate came closest.
 */
async function verifyAgainstKeys(
	algorithm: SignatureAlgorithm,
	keys: readonly SigningKey[],
	signature: Bytes,
	signed: string,
): Promise<boolean> {
	let data = new TextEncoder().encode(signed);
	let verified = false;

	for (let key of keys) {
		if (key.algorithm.kind !== algorithm.key) continue;

		let imported = await importVerificationKey(key, algorithm);
		if (!imported) continue;

		let parameters =
			algorithm.key === "RSA"
				? { name: "RSASSA-PKCS1-v1_5" }
				: { name: "ECDSA", hash: algorithm.hash };

		let matched = await crypto.subtle
			.verify(parameters, imported, signature, data)
			.catch(() => false);

		verified ||= matched;
	}

	return verified;
}

/**
 * Imports one key for the algorithm the document named, answering `null` where
 * the runtime refuses it — a certificate carrying a key the signature method
 * does not fit is one more key that did not verify, never a thrown failure. The
 * bytes are copied so the view handed in is one Web Crypto accepts.
 */
async function importVerificationKey(
	key: SigningKey,
	algorithm: SignatureAlgorithm,
): Promise<CryptoKey | null> {
	let parameters =
		key.algorithm.kind === "RSA"
			? { name: "RSASSA-PKCS1-v1_5", hash: algorithm.hash }
			: { name: "ECDSA", namedCurve: key.algorithm.curve };

	return crypto.subtle
		.importKey("spki", toBufferSource(key.spki), parameters, false, ["verify"])
		.catch(() => null);
}
