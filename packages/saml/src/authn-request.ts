/**
 * The authentication request a service provider sends to start a sign-in, over
 * either binding and signed or not. It mints the id the eventual response has
 * to answer, and produces the exact bytes each binding puts a signature over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64, Hex, randomBytes } from "@sdxc/crypto";
import { failure, success, wrap } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import type { SAMLError } from "./errors.js";
import type { SignatureAlgorithm } from "./lib/namespaces.js";
import type { Element } from "./lib/tree.js";

import { MalformedDocumentError, UnsupportedFeatureError } from "./errors.js";
import { toBufferSource } from "./lib/bytes.js";
import { canonicalize } from "./lib/canonicalize.js";
import { deflateRaw } from "./lib/deflate.js";
import {
	ASSERTION_NS,
	ENVELOPED_SIGNATURE,
	EXC_C14N,
	HTTP_POST_BINDING,
	PROTOCOL_NS,
	SIGNATURE_ALGORITHMS,
	SIGNATURE_NS,
} from "./lib/namespaces.js";
import { child, locate } from "./lib/tree.js";

/** UTF-8 encoder for the bytes a digest and a signature are taken over. */
const ENCODER = new TextEncoder();

/** How many random bytes the request id is minted from. */
const ID_BYTES = 16;

/**
 * The signature method each kind of key is used with, keyed by the name Web
 * Crypto gives the key's own algorithm. SHA-256 is what every identity provider
 * accepts, so the key alone decides the method and no caller has to choose one.
 */
const SIGNATURE_METHODS: Record<string, string> = {
	"RSASSA-PKCS1-v1_5": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
	ECDSA: "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
};

/** The digest the reference is taken with, named as `ds:DigestMethod` writes it. */
const SHA256_DIGEST_METHOD = "http://www.w3.org/2001/04/xmlenc#sha256";

/** Types the authentication request surface is described in. */
export namespace AuthnRequest {
	/** How the request reaches the identity provider. */
	export type Binding = "redirect" | "post";
}

/**
 * How one authentication request is built. Every field is required, so a
 * request that leaves out the audience it is for, or sends itself unsigned,
 * says so rather than inheriting a default nobody wrote.
 */
export interface CreateAuthnRequestOptions {
	binding: AuthnRequest.Binding;

	/** The identity provider's `SingleSignOnService` location for this binding. */
	destination: string;

	/** This service provider's entity id, which the provider matches a connection on. */
	issuer: string;

	/** Where the assertion is posted back to, repeated in the assertion's `Recipient`. */
	assertionConsumerService: string;

	/** The `NameIDPolicy Format` to request, or null to take whatever the provider sends. */
	nameIdFormat: string | null;

	forceAuthn: boolean;

	/** Opaque state handed back with the response, which is where a return URL travels. */
	relayState: string | null;

	/**
	 * The key the request is signed with, or null to send it unsigned.
	 * Must be an RSASSA-PKCS1-v1_5 or ECDSA private key.
	 */
	signingKey: CryptoKey | null;

	now: Date;
}

/** An authentication request, ready to send over the binding it was built for. */
export interface AuthnRequestResult {
	/** The request's own id, which the response must answer with InResponseTo. */
	id: string;

	/** The URL to redirect the browser to, for the redirect binding. */
	url: string | null;

	/** The form target and the base64 SAMLRequest to POST, for the POST binding. */
	form: { action: string; samlRequest: string; relayState: string | null } | null;
}

/**
 * The key a request is signed with, together with the method the document and
 * the query string name it by, resolved once so the naming and the signing can
 * never disagree about which algorithm ran.
 */
interface RequestSignature {
	key: CryptoKey;
	uri: string;
	algorithm: SignatureAlgorithm;
}

/**
 * The elements a signature's values are written into after the document they
 * sit in has been serialized and measured.
 */
interface SignatureTemplate {
	element: XML.Element;
	digestValue: XML.Element;
	signatureValue: XML.Element;
}

/**
 * Builds one authentication request and the transport around it: a signed
 * redirect URL, or the document a form posts. The id comes back because it is
 * what the response is matched against, and nothing else recovers it.
 *
 * @param options - Everything the request is built from
 * @returns The request over the binding it was asked for, or why it was refused
 *
 * @example
 * let request = await createAuthnRequest({ binding: "redirect", ...options });
 */
export async function createAuthnRequest(
	options: CreateAuthnRequestOptions,
): Promise<Result<AuthnRequestResult, SAMLError>> {
	let id = mintRequestId();
	let signature: RequestSignature | null = null;

	if (options.signingKey) {
		let resolved = resolveSignature(options.signingKey);
		if (resolved.status === "failure") return resolved;
		signature = resolved.data;
	}

	if (options.binding === "redirect") return await buildRedirect(id, options, signature);
	return await buildPost(id, options, signature);
}

/**
 * Mints the request id. An `xsd:ID` may not begin with a digit and hex often
 * does, which is what the leading underscore is there for.
 */
function mintRequestId(): string {
	return `_${Hex.encode(randomBytes(ID_BYTES))}`;
}

/**
 * Reads the signature method off the key itself, so the method named in the
 * document is the one that actually ran. A key of any other kind is refused
 * here rather than producing a signature no identity provider would check.
 */
function resolveSignature(key: CryptoKey): Result<RequestSignature, UnsupportedFeatureError> {
	let uri = SIGNATURE_METHODS[key.algorithm.name];
	let algorithm = uri ? SIGNATURE_ALGORITHMS[uri] : undefined;

	if (!uri || !algorithm) {
		return failure(
			new UnsupportedFeatureError(
				"signing key algorithm",
				"a request is signed with an RSASSA-PKCS1-v1_5 or ECDSA key",
			),
		);
	}

	return success({ key, uri, algorithm });
}

/**
 * Builds the redirect binding, where the query string itself is what gets
 * signed. The parameters are concatenated in the order the specification fixes,
 * because the provider reconstructs that literal string to verify it.
 */
async function buildRedirect(
	id: string,
	options: CreateAuthnRequestOptions,
	signature: RequestSignature | null,
): Promise<Result<AuthnRequestResult, SAMLError>> {
	let document = serialize(buildDocument(id, options, null));
	if (document.status === "failure") return document;

	let compressed = await deflateRaw(ENCODER.encode(document.data));
	if (compressed.status === "failure") {
		return failure(new MalformedDocumentError("the request could not be compressed"));
	}

	let query = `SAMLRequest=${encodeURIComponent(Base64.encode(compressed.data))}`;
	if (options.relayState !== null) {
		query += `&RelayState=${encodeURIComponent(options.relayState)}`;
	}

	if (signature) {
		query += `&SigAlg=${encodeURIComponent(signature.uri)}`;

		let signed = await sign(signature, ENCODER.encode(query));
		if (signed.status === "failure") return signed;

		query += `&Signature=${encodeURIComponent(Base64.encode(signed.data))}`;
	}

	let separator = options.destination.includes("?") ? "&" : "?";
	return success({ id, url: `${options.destination}${separator}${query}`, form: null });
}

/**
 * Builds the POST binding, where the signature travels inside the document. An
 * unsigned request is the same document without the `ds:Signature`, which is
 * what a provider that authenticates the connection some other way expects.
 */
async function buildPost(
	id: string,
	options: CreateAuthnRequestOptions,
	signature: RequestSignature | null,
): Promise<Result<AuthnRequestResult, SAMLError>> {
	let document = signature
		? await signDocument(id, options, signature)
		: serialize(buildDocument(id, options, null));

	if (document.status === "failure") return document;

	return success({
		id,
		url: null,
		form: {
			action: options.destination,
			samlRequest: Base64.encode(document.data),
			relayState: options.relayState,
		},
	});
}

/**
 * Embeds an enveloped signature, measuring the document in the shape it is sent
 * in: the digest covers the document with the signature element in place and
 * omitted, and `SignedInfo` is canonicalized from the re-read bytes.
 */
async function signDocument(
	id: string,
	options: CreateAuthnRequestOptions,
	signature: RequestSignature,
): Promise<Result<string, SAMLError>> {
	let template = buildSignature(id, signature.uri);
	let root = buildDocument(id, options, template.element);

	let placed = serialize(root);
	if (placed.status === "failure") return placed;

	let located = parseLocated(placed.data);
	if (located.status === "failure") return located;

	let embedded = child(located.data, SIGNATURE_NS, "Signature");
	if (!embedded) return failure(new MalformedDocumentError("the signature was not written"));

	let digest = await digestOf(canonicalize(located.data, { omit: embedded }));
	if (digest.status === "failure") return digest;

	template.digestValue.children = [Base64.encode(digest.data)];

	let digested = serialize(root);
	if (digested.status === "failure") return digested;

	let reread = parseLocated(digested.data);
	if (reread.status === "failure") return reread;

	let signedInfo = signedInfoOf(reread.data);
	if (!signedInfo)
		return failure(new MalformedDocumentError("the signature carries no SignedInfo"));

	let value = await sign(signature, ENCODER.encode(canonicalize(signedInfo)));
	if (value.status === "failure") return value;

	template.signatureValue.children = [Base64.encode(value.data)];

	return serialize(root);
}

/**
 * The `SignedInfo` of the document's own signature, which is the element whose
 * canonical form the signature value is taken over.
 */
function signedInfoOf(root: Element): Element | undefined {
	let signature = child(root, SIGNATURE_NS, "Signature");
	if (!signature) return undefined;
	return child(signature, SIGNATURE_NS, "SignedInfo");
}

/**
 * Builds the request document. The signature, when there is one, goes directly
 * after `saml:Issuer`, which is the position the SAML schema gives it and the
 * only one a provider validating against that schema accepts.
 */
function buildDocument(
	id: string,
	options: CreateAuthnRequestOptions,
	signature: XML.Element | null,
): XML.Element {
	let attributes: Record<string, string> = {
		"xmlns:samlp": PROTOCOL_NS,
		"xmlns:saml": ASSERTION_NS,
		ID: id,
		Version: "2.0",
		IssueInstant: options.now.toISOString(),
		Destination: options.destination,
		AssertionConsumerServiceURL: options.assertionConsumerService,
		ProtocolBinding: HTTP_POST_BINDING,
	};

	if (options.forceAuthn) attributes.ForceAuthn = "true";

	let children: XML.Node[] = [{ name: "saml:Issuer", children: [options.issuer] }];
	if (signature) children.push(signature);

	if (options.nameIdFormat !== null) {
		children.push({
			name: "samlp:NameIDPolicy",
			attributes: { Format: options.nameIdFormat, AllowCreate: "true" },
		});
	}

	return { name: "samlp:AuthnRequest", attributes, children };
}

/**
 * Builds the signature element with its two values still empty, handing back
 * the elements they are written into once the document around them has been
 * measured.
 */
function buildSignature(id: string, method: string): SignatureTemplate {
	let digestValue: XML.Element = { name: "ds:DigestValue", children: [""] };
	let signatureValue: XML.Element = { name: "ds:SignatureValue", children: [""] };

	let element: XML.Element = {
		name: "ds:Signature",
		attributes: { "xmlns:ds": SIGNATURE_NS },
		children: [
			{
				name: "ds:SignedInfo",
				children: [
					{ name: "ds:CanonicalizationMethod", attributes: { Algorithm: EXC_C14N } },
					{ name: "ds:SignatureMethod", attributes: { Algorithm: method } },
					{
						name: "ds:Reference",
						attributes: { URI: `#${id}` },
						children: [
							{
								name: "ds:Transforms",
								children: [
									{ name: "ds:Transform", attributes: { Algorithm: ENVELOPED_SIGNATURE } },
									{ name: "ds:Transform", attributes: { Algorithm: EXC_C14N } },
								],
							},
							{ name: "ds:DigestMethod", attributes: { Algorithm: SHA256_DIGEST_METHOD } },
							digestValue,
						],
					},
				],
			},
			signatureValue,
		],
	};

	return { element, digestValue, signatureValue };
}

/**
 * Serializes the request tree, reporting a refusal rather than a thrown error
 * so every path out of this module is a value.
 */
function serialize(root: XML.Element): Result<string, MalformedDocumentError> {
	let text = XML.stringify(root);
	if (text.status === "failure") {
		return failure(new MalformedDocumentError("the request could not be serialized"));
	}
	return success(text.data);
}

/**
 * Reads a serialized request back into the located tree, with whitespace kept,
 * since the digest is taken over the document exactly as it was written.
 */
function parseLocated(source: string): Result<Element, MalformedDocumentError> {
	let parsed = XML.parse(source, { whitespace: "preserve" });
	if (parsed.status === "failure") {
		return failure(new MalformedDocumentError("the request could not be read back"));
	}
	return success(locate(parsed.data.root));
}

/** Digests one canonical form as the UTF-8 bytes a verifier will digest. */
async function digestOf(form: string): Promise<Result<Bytes, MalformedDocumentError>> {
	let digest = await wrap(() => crypto.subtle.digest("SHA-256", ENCODER.encode(form)));
	if (digest.status === "failure") {
		return failure(new MalformedDocumentError("the request could not be digested"));
	}
	return success(new Uint8Array(digest.data));
}

/**
 * Signs the given bytes with the resolved key. A key the runtime will not sign
 * with — a public half, or one imported without the signing usage — comes back
 * as the same refusal an unusable algorithm does.
 */
async function sign(
	signature: RequestSignature,
	data: Uint8Array,
): Promise<Result<Bytes, UnsupportedFeatureError>> {
	let parameters =
		signature.algorithm.key === "RSA"
			? { name: "RSASSA-PKCS1-v1_5" }
			: { name: "ECDSA", hash: signature.algorithm.hash };

	let signed = await wrap(() =>
		crypto.subtle.sign(parameters, signature.key, toBufferSource(data)),
	);

	if (signed.status === "failure") {
		return failure(
			new UnsupportedFeatureError("signing key", "the key must be a private key that signs"),
		);
	}

	return success(new Uint8Array(signed.data));
}
