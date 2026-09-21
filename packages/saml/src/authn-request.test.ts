/**
 * Pins what an identity provider is actually handed: the document a request
 * serializes to, the literal string the redirect binding signs, and a posted
 * document whose signature verifies against the key that made it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";
import { describe, expect, test } from "vitest";

import type { CreateAuthnRequestOptions } from "./authn-request.js";
import type { Element } from "./lib/tree.js";

import { createAuthnRequest } from "./authn-request.js";
import { canonicalize } from "./lib/canonicalize.js";
import { deflateRaw, inflateRaw } from "./lib/deflate.js";
import {
	ASSERTION_NS,
	ENVELOPED_SIGNATURE,
	EXC_C14N,
	HTTP_POST_BINDING,
	PROTOCOL_NS,
	SIGNATURE_NS,
} from "./lib/namespaces.js";
import { attribute, child, children, locate, text } from "./lib/tree.js";

/** UTF-8 pair used wherever a test measures the same bytes the package does. */
const ENCODER = new TextEncoder();

/** Reads back what the encoder wrote, for the documents these tests parse. */
const DECODER = new TextDecoder();

/** Fixed instant, so `IssueInstant` is a value a test can assert on. */
const NOW = new Date("2026-01-01T12:00:00.000Z");

/** The identity provider endpoint every request in this file is aimed at. */
const DESTINATION = "https://idp.example.com/sso";

/** How a persistent name id is asked for, the format providers most often pin. */
const PERSISTENT_FORMAT = "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent";

/**
 * A base set of options each test narrows, so one test names only the fields it
 * is about and every other field stays the same across the file.
 */
function options(overrides: Partial<CreateAuthnRequestOptions> = {}): CreateAuthnRequestOptions {
	return {
		binding: "post",
		destination: DESTINATION,
		issuer: "https://sp.example.com/metadata",
		assertionConsumerService: "https://sp.example.com/acs",
		nameIdFormat: null,
		forceAuthn: false,
		relayState: null,
		signingKey: null,
		now: NOW,
		...overrides,
	};
}

/**
 * Unwraps a `Result` the test expects to have succeeded, so a failure names
 * itself instead of surfacing as a type error on the line that reads the data.
 */
function unwrapped<T, E extends Error>(result: Result<T, E>): T {
	if (isFailure(result)) throw result.error;
	return result.data;
}

/**
 * Asserts a lookup that must have found something, keeping the tests free of
 * non-null assertions while still failing at the line that looked.
 */
function required<T>(value: T | undefined, what: string): T {
	if (value === undefined) throw new Error(`Expected ${what}`);
	return value;
}

/** Parses a serialized request the way the verifier would read it. */
function parse(source: string): Element {
	let parsed = XML.parse(source, { whitespace: "preserve" });
	return locate(unwrapped(parsed).root);
}

/** Decodes a base64 payload back into the document text it carries. */
function decodeDocument(payload: string): string {
	return DECODER.decode(unwrapped(Base64.decode(payload)));
}

/** The XML a POST binding would submit, as text. */
async function postedDocument(overrides: Partial<CreateAuthnRequestOptions> = {}) {
	let result = unwrapped(await createAuthnRequest(options({ binding: "post", ...overrides })));
	let form = required(result.form ?? undefined, "a form");
	return {
		id: result.id,
		url: result.url,
		document: parse(decodeDocument(form.samlRequest)),
		form,
	};
}

/**
 * Splits a redirect URL's query into pairs whose values are still encoded,
 * which is what the signed string is built from and what decoding would lose.
 */
function rawPairs(url: string): [string, string][] {
	let pairs: [string, string][] = [];
	for (let pair of url.slice(url.indexOf("?") + 1).split("&")) {
		let separator = pair.indexOf("=");
		pairs.push([pair.slice(0, separator), pair.slice(separator + 1)]);
	}
	return pairs;
}

/** An RSA key pair in the shape a service provider signs its requests with. */
async function rsaKeys(): Promise<CryptoKeyPair> {
	return await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	);
}

/** A P-256 key pair, the elliptic curve alternative the package accepts. */
async function ecKeys(): Promise<CryptoKeyPair> {
	return await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
		"sign",
		"verify",
	]);
}

/**
 * One key kind a request may be signed with, paired with what the document must
 * name it by and what a verifier checks it with, so both keys run the same test.
 */
interface SigningSubject {
	kind: string;
	keys: () => Promise<CryptoKeyPair>;
	method: string;
	parameters: AlgorithmIdentifier | EcdsaParams;
}

/** The key kinds this package signs with, each measured end to end. */
const SIGNING_SUBJECTS: SigningSubject[] = [
	{
		kind: "RSA",
		keys: rsaKeys,
		method: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
		parameters: { name: "RSASSA-PKCS1-v1_5" },
	},
	{
		kind: "EC",
		keys: ecKeys,
		method: "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
		parameters: { name: "ECDSA", hash: "SHA-256" },
	},
];

describe("createAuthnRequest", () => {
	test("mints an id that may open an xsd:ID and never repeats", async () => {
		let first = unwrapped(await createAuthnRequest(options()));
		let second = unwrapped(await createAuthnRequest(options()));

		expect(first.id).toMatch(/^_[0-9a-f]{32}$/);
		expect(second.id).toMatch(/^_[0-9a-f]{32}$/);
		expect(first.id).not.toBe(second.id);
	});

	test("writes the protocol attributes an identity provider reads", async () => {
		let { id, document } = await postedDocument();

		expect(document.uri).toBe(PROTOCOL_NS);
		expect(document.local).toBe("AuthnRequest");
		expect(attribute(document, "ID")).toBe(id);
		expect(attribute(document, "Version")).toBe("2.0");
		expect(attribute(document, "IssueInstant")).toBe(NOW.toISOString());
		expect(attribute(document, "Destination")).toBe(DESTINATION);
		expect(attribute(document, "AssertionConsumerServiceURL")).toBe("https://sp.example.com/acs");
		expect(attribute(document, "ProtocolBinding")).toBe(HTTP_POST_BINDING);
	});

	test("carries the issuer as the first child", async () => {
		let { document } = await postedDocument();
		let issuer = required(child(document, ASSERTION_NS, "Issuer"), "an Issuer");

		expect(text(issuer)).toBe("https://sp.example.com/metadata");
		expect(document.children[0]).toBe(issuer);
	});

	test("leaves ForceAuthn off unless it was asked for", async () => {
		let relaxed = await postedDocument({ forceAuthn: false });
		let forced = await postedDocument({ forceAuthn: true });

		expect(attribute(relaxed.document, "ForceAuthn")).toBeUndefined();
		expect(attribute(forced.document, "ForceAuthn")).toBe("true");
	});

	test("writes a NameIDPolicy only for a format that was named", async () => {
		let open = await postedDocument({ nameIdFormat: null });
		let pinned = await postedDocument({ nameIdFormat: PERSISTENT_FORMAT });

		expect(children(open.document, PROTOCOL_NS, "NameIDPolicy")).toHaveLength(0);

		let policy = required(child(pinned.document, PROTOCOL_NS, "NameIDPolicy"), "a NameIDPolicy");
		expect(attribute(policy, "Format")).toBe(PERSISTENT_FORMAT);
		expect(attribute(policy, "AllowCreate")).toBe("true");
	});

	test("posts an unsigned document with no signature in it", async () => {
		let { document, form } = await postedDocument({ relayState: "/dashboard" });

		expect(children(document, SIGNATURE_NS, "Signature")).toHaveLength(0);
		expect(form.action).toBe(DESTINATION);
		expect(form.relayState).toBe("/dashboard");
	});

	test("refuses a key it cannot name a signature method for", async () => {
		let key = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, true, ["sign"]);
		let result = await createAuthnRequest(options({ signingKey: key }));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.name).toBe("UnsupportedFeatureError");
	});
});

describe("deflate", () => {
	test("round trips a document through raw DEFLATE", async () => {
		let source = ENCODER.encode('<samlp:AuthnRequest ID="_abc"/>'.repeat(16));
		let compressed = unwrapped(await deflateRaw(source));
		let restored = unwrapped(await inflateRaw(compressed));

		expect(DECODER.decode(restored)).toBe(DECODER.decode(source));
	});

	test("refuses a payload that expands past the limit", async () => {
		let compressed = unwrapped(await deflateRaw(new Uint8Array(2 * 1024 * 1024)));
		let restored = await inflateRaw(compressed);

		expect(isFailure(restored)).toBe(true);
	});
});

describe("createAuthnRequest over the redirect binding", () => {
	test("carries the document as a deflated, base64 parameter", async () => {
		let posted = await postedDocument();
		let result = unwrapped(await createAuthnRequest(options({ binding: "redirect" })));
		let url = required(result.url ?? undefined, "a url");

		expect(result.form).toBeNull();
		expect(url.startsWith(`${DESTINATION}?`)).toBe(true);

		let raw = new Map(rawPairs(url));
		let payload = decodeURIComponent(required(raw.get("SAMLRequest"), "a SAMLRequest"));
		let inflated = unwrapped(await inflateRaw(unwrapped(Base64.decode(payload))));
		let document = parse(DECODER.decode(inflated));

		expect(attribute(document, "ID")).toBe(result.id);
		expect(document.local).toBe(posted.document.local);
		expect(attribute(document, "Destination")).toBe(DESTINATION);
	});

	test("joins onto a destination that already carries a query", async () => {
		let destination = `${DESTINATION}?tenant=acme`;
		let result = unwrapped(await createAuthnRequest(options({ binding: "redirect", destination })));
		let url = required(result.url ?? undefined, "a url");

		expect(url.startsWith(`${destination}&SAMLRequest=`)).toBe(true);
	});

	test("sends no SigAlg or Signature when the request is unsigned", async () => {
		let result = unwrapped(
			await createAuthnRequest(options({ binding: "redirect", relayState: "/back" })),
		);
		let names = rawPairs(required(result.url ?? undefined, "a url")).map(([name]) => name);

		expect(names).toEqual(["SAMLRequest", "RelayState"]);
	});

	test("signs the query string exactly as the specification orders it", async () => {
		let keys = await rsaKeys();
		let result = unwrapped(
			await createAuthnRequest(
				options({ binding: "redirect", relayState: "/back home", signingKey: keys.privateKey }),
			),
		);

		let pairs = rawPairs(required(result.url ?? undefined, "a url"));
		expect(pairs.map(([name]) => name)).toEqual([
			"SAMLRequest",
			"RelayState",
			"SigAlg",
			"Signature",
		]);

		let raw = new Map(pairs);
		expect(decodeURIComponent(required(raw.get("RelayState"), "a RelayState"))).toBe("/back home");
		expect(decodeURIComponent(required(raw.get("SigAlg"), "a SigAlg"))).toBe(
			"http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
		);

		let signed = [
			`SAMLRequest=${required(raw.get("SAMLRequest"), "a SAMLRequest")}`,
			`RelayState=${required(raw.get("RelayState"), "a RelayState")}`,
			`SigAlg=${required(raw.get("SigAlg"), "a SigAlg")}`,
		].join("&");

		let signature = unwrapped(
			Base64.decode(decodeURIComponent(required(raw.get("Signature"), "a Signature"))),
		);

		let verified = await crypto.subtle.verify(
			{ name: "RSASSA-PKCS1-v1_5" },
			keys.publicKey,
			signature,
			ENCODER.encode(signed),
		);

		expect(verified).toBe(true);
	});

	test("leaves RelayState out of the signed string when none was given", async () => {
		let keys = await ecKeys();
		let result = unwrapped(
			await createAuthnRequest(
				options({ binding: "redirect", relayState: null, signingKey: keys.privateKey }),
			),
		);

		let pairs = rawPairs(required(result.url ?? undefined, "a url"));
		expect(pairs.map(([name]) => name)).toEqual(["SAMLRequest", "SigAlg", "Signature"]);

		let raw = new Map(pairs);
		expect(decodeURIComponent(required(raw.get("SigAlg"), "a SigAlg"))).toBe(
			"http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
		);

		let signed = [
			`SAMLRequest=${required(raw.get("SAMLRequest"), "a SAMLRequest")}`,
			`SigAlg=${required(raw.get("SigAlg"), "a SigAlg")}`,
		].join("&");

		let signature = unwrapped(
			Base64.decode(decodeURIComponent(required(raw.get("Signature"), "a Signature"))),
		);

		let verified = await crypto.subtle.verify(
			{ name: "ECDSA", hash: "SHA-256" },
			keys.publicKey,
			signature,
			ENCODER.encode(signed),
		);

		expect(verified).toBe(true);
	});
});

describe("createAuthnRequest over the POST binding", () => {
	test.each(SIGNING_SUBJECTS)(
		"embeds a signature a verifier accepts with an $kind key",
		async (subject) => {
			let keys = await subject.keys();
			let posted = await postedDocument({
				nameIdFormat: PERSISTENT_FORMAT,
				forceAuthn: true,
				signingKey: keys.privateKey,
			});

			let document = posted.document;
			let signature = required(child(document, SIGNATURE_NS, "Signature"), "a Signature");
			let issuer = required(child(document, ASSERTION_NS, "Issuer"), "an Issuer");

			expect(document.children[0]).toBe(issuer);
			expect(document.children[1]).toBe(signature);
			expect(posted.url).toBeNull();

			let signedInfo = required(child(signature, SIGNATURE_NS, "SignedInfo"), "a SignedInfo");
			let canonicalization = required(
				child(signedInfo, SIGNATURE_NS, "CanonicalizationMethod"),
				"a CanonicalizationMethod",
			);
			let method = required(
				child(signedInfo, SIGNATURE_NS, "SignatureMethod"),
				"a SignatureMethod",
			);
			let reference = required(child(signedInfo, SIGNATURE_NS, "Reference"), "a Reference");
			let transforms = required(child(reference, SIGNATURE_NS, "Transforms"), "Transforms");
			let digestMethod = required(child(reference, SIGNATURE_NS, "DigestMethod"), "a DigestMethod");
			let digestValue = required(child(reference, SIGNATURE_NS, "DigestValue"), "a DigestValue");

			expect(attribute(canonicalization, "Algorithm")).toBe(EXC_C14N);
			expect(attribute(method, "Algorithm")).toBe(subject.method);
			expect(attribute(reference, "URI")).toBe(`#${posted.id}`);
			expect(
				children(transforms, SIGNATURE_NS, "Transform").map((transform) =>
					attribute(transform, "Algorithm"),
				),
			).toEqual([ENVELOPED_SIGNATURE, EXC_C14N]);
			expect(attribute(digestMethod, "Algorithm")).toBe("http://www.w3.org/2001/04/xmlenc#sha256");

			let digest = await crypto.subtle.digest(
				"SHA-256",
				ENCODER.encode(canonicalize(document, { omit: signature })),
			);
			expect(text(digestValue)).toBe(Base64.encode(new Uint8Array(digest)));

			let value = unwrapped(
				Base64.decode(text(required(child(signature, SIGNATURE_NS, "SignatureValue"), "a value"))),
			);

			let verified = await crypto.subtle.verify(
				subject.parameters,
				keys.publicKey,
				value,
				ENCODER.encode(canonicalize(signedInfo)),
			);

			expect(verified).toBe(true);
		},
	);
});
