/**
 * The verification suite. Beyond the documents that should pass, it carries the
 * wrapped corpus: a genuine signature with a forged assertion parked wherever a
 * reader might look for one, each recording the outcome it must produce, so a
 * change that keeps a refusal while moving its reason is caught here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

import { Base64, randomBytes } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";
import { beforeAll, describe, expect, test } from "vitest";

import type { ResponseFixture, SignTarget } from "./fixtures/sign-response.js";
import type { ReplayStore } from "./replay-store.js";

import { Certificate } from "./certificate.js";
import {
	buildResponse,
	findElement,
	findParent,
	reparse,
	signDocument,
	stringify,
} from "./fixtures/sign-response.js";
import { buildCertificate, buildTbsCertificate } from "./lib/der.js";
import { verifyResponse } from "./verify-response.js";

/** The moment every fixture's window is drawn around, so no test depends on the real clock. */
const NOW = new Date("2026-09-21T12:00:00Z");

/** The audience every fixture addresses, and the one the options expect. */
const AUDIENCE = "https://sp.example.com/metadata";

/** The consumer service every fixture is sent to. */
const ACS = "https://sp.example.com/acs";

/** A replay store that remembers nothing, for the tests replay is not the subject of. */
function emptyStore(): ReplayStore {
	let seen = new Set<string>();
	return {
		seen: (id) => Promise.resolve(seen.has(id)),
		remember: (id) => {
			seen.add(id);
			return Promise.resolve();
		},
	};
}

/** One RSA key pair and the certificate carrying its public half. */
let rsa: CryptoKeyPair;
let rsaCertificate: Certificate;

/** One EC key pair and the certificate carrying its public half. */
let ec: CryptoKeyPair;
let ecCertificate: Certificate;

/** A key pair nothing in a fixture ever signs with. */
let stranger: CryptoKeyPair;
let strangerCertificate: Certificate;

/**
 * Wraps a public key in a certificate, signed by an RSA key that need not be
 * the subject's own, which is what lets an EC subject key be carried by the
 * RSA-signed certificate this package builds.
 */
async function certificateFor(publicKey: CryptoKey, signer: CryptoKeyPair): Promise<Certificate> {
	let spki = new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));
	let tbs = buildTbsCertificate({
		spki,
		commonName: "fixture",
		serial: randomBytes(8),
		notBefore: new Date("2026-01-01T00:00:00Z"),
		notAfter: new Date("2027-01-01T00:00:00Z"),
	});
	if (isFailure(tbs)) throw tbs.error;

	let signature = await crypto.subtle.sign(
		{ name: "RSASSA-PKCS1-v1_5" },
		signer.privateKey,
		tbs.data,
	);
	let parsed = await Certificate.parse(
		Base64.encode(buildCertificate(tbs.data, new Uint8Array(signature))),
	);
	if (isFailure(parsed)) throw parsed.error;

	return parsed.data;
}

beforeAll(async () => {
	let rsaParameters = {
		name: "RSASSA-PKCS1-v1_5",
		modulusLength: 2048,
		publicExponent: Uint8Array.of(0x01, 0x00, 0x01),
		hash: "SHA-256",
	} as const;

	rsa = await crypto.subtle.generateKey(rsaParameters, true, ["sign", "verify"]);
	stranger = await crypto.subtle.generateKey(rsaParameters, true, ["sign", "verify"]);
	ec = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
		"sign",
		"verify",
	]);

	rsaCertificate = await certificateFor(rsa.publicKey, rsa);
	ecCertificate = await certificateFor(ec.publicKey, rsa);
	strangerCertificate = await certificateFor(stranger.publicKey, stranger);
});

/**
 * Builds and signs one fixture, answering the document text, so a test that is
 * about tampering can start from a document that genuinely verifies.
 */
async function signed(
	target: SignTarget = "assertion",
	fixture: ResponseFixture = {},
	key?: CryptoKey,
): Promise<string> {
	return signDocument(buildResponse(fixture, target), key ?? rsa.privateKey);
}

/**
 * Runs a verification with the options every fixture is built to satisfy, so a
 * test overrides only the one option it is about.
 */
async function verify(
	source: string,
	overrides: Partial<Parameters<typeof verifyResponse>[1]> = {},
) {
	return verifyResponse(source, {
		certificates: [rsaCertificate],
		audience: AUDIENCE,
		destination: ACS,
		recipient: ACS,
		inResponseTo: "_req1",
		decryptionKey: null,
		replay: emptyStore(),
		clock: { now: NOW, skew: "60 seconds" },
		...overrides,
	});
}

/** Unwraps a verification the test expects to succeed. */
function expectSuccess(result: Awaited<ReturnType<typeof verify>>) {
	if (isFailure(result))
		throw new Error(`Expected success, got ${result.error.name}: ${result.error.message}`);
	return result.data;
}

/** Unwraps a verification the test expects to fail. */
function expectFailure(result: Awaited<ReturnType<typeof verify>>) {
	if (isSuccess(result)) throw new Error("Expected a failure, the document verified");
	return result.error;
}

/** Re-serializes a signed document after a test has tampered with its tree. */
function tamper(source: string, mutate: (root: XML.Element) => void): string {
	let root = reparse(source);
	mutate(root);
	return stringify(root);
}

/** A complete assertion naming somebody else, which every wrapping test plants. */
function forgedAssertion(): XML.Element {
	let response = buildResponse(
		{ assertionId: "_forged", nameId: "attacker@evil.test" },
		"response",
	);
	let assertion = findElement(response, "saml:Assertion");
	if (!assertion) throw new Error("The fixture carries no assertion to forge from");
	return assertion;
}

describe("verifyResponse, documents that verify", () => {
	test("reads the claims out of an assertion-level signature", async () => {
		let assertion = expectSuccess(await verify(await signed("assertion")));

		expect(assertion.id).toBe("_assertion1");
		expect(assertion.issuer).toBe("https://idp.example.com");
		expect(assertion.nameId?.value).toBe("user@example.com");
		expect(assertion.sessionIndex).toBe("session-1");
		expect(assertion.attribute("email")).toBe("user@example.com");
	});

	test("reads the claims out of a response-level signature", async () => {
		let assertion = expectSuccess(await verify(await signed("response")));
		expect(assertion.nameId?.value).toBe("user@example.com");
	});

	test("verifies an ECDSA signature", async () => {
		let source = await signDocument(
			mutateSignatureMethod(
				buildResponse({}, "assertion"),
				"http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
			),
			ec.privateKey,
		);

		let assertion = expectSuccess(await verify(source, { certificates: [ecCertificate] }));
		expect(assertion.nameId?.value).toBe("user@example.com");
	});

	test("accepts the document under any one of the trusted certificates", async () => {
		let assertion = expectSuccess(
			await verify(await signed(), { certificates: [strangerCertificate, rsaCertificate] }),
		);
		expect(assertion.id).toBe("_assertion1");
	});

	test("accepts a provider-started sign-in that answers no request", async () => {
		let source = await signed("assertion", { inResponseTo: null });
		let assertion = expectSuccess(await verify(source, { inResponseTo: null }));
		expect(assertion.nameId?.value).toBe("user@example.com");
	});

	test("reads a repeated attribute as every value it carried", async () => {
		let source = await signed("assertion", { attributes: { groups: ["admin", "staff"] } });
		let assertion = expectSuccess(await verify(source));

		expect(assertion.values("groups")).toEqual(["admin", "staff"]);
		expect(assertion.claims()).toEqual({ groups: ["admin", "staff"] });
	});

	test("takes the narrowest expiry the document named", async () => {
		let assertion = expectSuccess(await verify(await signed()));
		expect(assertion.notOnOrAfter.toISOString()).toBe("2026-09-21T12:05:00.000Z");
	});

	test("absorbs a drift inside the allowed skew", async () => {
		let source = await signed("assertion", {
			notBefore: new Date("2026-09-21T12:00:30Z"),
			notOnOrAfter: new Date("2026-09-21T12:10:00Z"),
		});

		expect(isSuccess(await verify(source))).toBe(true);
	});
});

describe("verifyResponse, the wrapped corpus", () => {
	test("reads the signed assertion when a forged one sits beside it", async () => {
		let source = tamper(await signed("assertion"), (root) => {
			root.children?.unshift(forgedAssertion());
		});

		let assertion = expectSuccess(await verify(source));
		expect(assertion.nameId?.value).toBe("user@example.com");
		expect(assertion.id).toBe("_assertion1");
	});

	test("refuses an assertion added to a signed response after the fact", async () => {
		let source = tamper(await signed("response"), (root) => {
			root.children?.push(forgedAssertion());
		});

		expect(expectFailure(await verify(source)).name).toBe("SignatureMismatchError");
	});

	test("refuses a signed response that covers two assertions", async () => {
		let tree = buildResponse({}, "response");
		tree.children?.push(forgedAssertion());

		let source = await signDocument(tree, rsa.privateKey);
		expect(expectFailure(await verify(source)).name).toBe("WrappedAssertionError");
	});

	test("reads the signed assertion when a forged one hides in Extensions", async () => {
		let source = tamper(await signed("assertion"), (root) => {
			root.children?.unshift({
				name: "samlp:Extensions",
				attributes: {},
				children: [forgedAssertion()],
			});
		});

		expect(expectSuccess(await verify(source)).nameId?.value).toBe("user@example.com");
	});

	test("reads the signed assertion when a forged one hides in a signature object", async () => {
		let source = tamper(await signed("assertion"), (root) => {
			let signature = findElement(root, "ds:Signature");
			signature?.children?.push({
				name: "ds:Object",
				attributes: {},
				children: [forgedAssertion()],
			});
		});

		expect(expectSuccess(await verify(source)).nameId?.value).toBe("user@example.com");
	});

	test("refuses a second element carrying the signed element's id", async () => {
		let source = tamper(await signed("assertion"), (root) => {
			let forged = forgedAssertion();
			forged.attributes = { ...forged.attributes, ID: "_assertion1" };
			root.children?.unshift(forged);
		});

		let error = expectFailure(await verify(source));
		expect(error.name).toBe("UnresolvedReferenceError");
	});

	test("refuses a signature sitting outside the element it references", async () => {
		let source = tamper(await signed("assertion"), (root) => {
			let assertion = findElement(root, "saml:Assertion");
			let signature = findElement(root, "ds:Signature");
			if (!assertion || !signature) throw new Error("fixture shape changed");

			assertion.children = assertion.children?.filter((child) => child !== signature);
			root.children?.push(signature);
		});

		expect(expectFailure(await verify(source)).name).toBe("WrappedAssertionError");
	});

	test("refuses a document carrying two signatures", async () => {
		let source = tamper(await signed("assertion"), (root) => {
			let signature = findElement(root, "ds:Signature");
			if (signature) root.children?.push(structuredClone(signature));
		});

		let error = expectFailure(await verify(source));
		expect(error.name).toBe("UnsignedDocumentError");
	});

	test("refuses a document carrying no signature", async () => {
		let source = stringify(buildResponse({}, "assertion"));
		let stripped = tamper(source, (root) => {
			let parent = findParent(root, "ds:Signature");
			let signature = findElement(root, "ds:Signature");
			if (parent) parent.children = parent.children?.filter((child) => child !== signature);
		});

		expect(expectFailure(await verify(stripped)).name).toBe("UnsignedDocumentError");
	});
});

describe("verifyResponse, mutations", () => {
	test("refuses a flipped byte in the signature value", async () => {
		let source = tamper(await signed(), (root) => {
			flipBase64(findElement(root, "ds:SignatureValue"));
		});

		expect(expectFailure(await verify(source)).name).toBe("SignatureMismatchError");
	});

	test("refuses a flipped byte in the digest value", async () => {
		let source = tamper(await signed(), (root) => {
			flipBase64(findElement(root, "ds:DigestValue"));
		});

		expect(expectFailure(await verify(source)).name).toBe("SignatureMismatchError");
	});

	test("refuses a changed byte inside the canonicalized region", async () => {
		let source = tamper(await signed(), (root) => {
			let nameId = findElement(root, "saml:NameID");
			if (nameId) nameId.children = ["attacker@evil.test"];
		});

		expect(expectFailure(await verify(source)).name).toBe("SignatureMismatchError");
	});

	test("refuses a changed attribute inside the canonicalized region", async () => {
		let source = tamper(await signed(), (root) => {
			let statement = findElement(root, "saml:AuthnStatement");
			if (statement) statement.attributes = { ...statement.attributes, SessionIndex: "other" };
		});

		expect(expectFailure(await verify(source)).name).toBe("SignatureMismatchError");
	});

	test("refuses a signature made by a key nothing trusts", async () => {
		let source = await signed("assertion", {}, stranger.privateKey);
		expect(expectFailure(await verify(source)).name).toBe("SignatureMismatchError");
	});
});

describe("verifyResponse, refusals", () => {
	test("refuses a document type declaration before parsing", async () => {
		let source = `<!DOCTYPE x [<!ENTITY a "b">]>${await signed()}`;
		let error = expectFailure(await verify(source));

		expect(error.name).toBe("UnsupportedFeatureError");
		expect(error.message).toContain("document type declaration");
	});

	test("refuses a processing instruction", async () => {
		let source = `<?php echo 1 ?>${await signed()}`;
		expect(expectFailure(await verify(source)).name).toBe("UnsupportedFeatureError");
	});

	test("allows the XML declaration a document may open with", async () => {
		let source = `<?xml version="1.0" encoding="UTF-8"?>${await signed()}`;
		expect(isSuccess(await verify(source))).toBe(true);
	});

	test("refuses a SHA-1 signature method", async () => {
		let source = tamper(await signed(), (root) => {
			let method = findElement(root, "ds:SignatureMethod");
			if (method) {
				method.attributes = { Algorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" };
			}
		});

		let error = expectFailure(await verify(source));
		expect(error.message).toContain("signature algorithm");
	});

	test("refuses a SHA-1 digest method", async () => {
		let source = tamper(await signed(), (root) => {
			let method = findElement(root, "ds:DigestMethod");
			if (method) method.attributes = { Algorithm: "http://www.w3.org/2000/09/xmldsig#sha1" };
		});

		expect(expectFailure(await verify(source)).message).toContain("digest algorithm");
	});

	test("refuses inclusive canonicalization", async () => {
		let source = tamper(await signed(), (root) => {
			let method = findElement(root, "ds:CanonicalizationMethod");
			if (method) {
				method.attributes = { Algorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" };
			}
		});

		expect(expectFailure(await verify(source)).message).toContain("canonicalization");
	});

	test("refuses a reference naming the whole document", async () => {
		let source = tamper(await signed(), (root) => {
			let reference = findElement(root, "ds:Reference");
			if (reference) reference.attributes = { URI: "" };
		});

		expect(expectFailure(await verify(source)).message).toContain("reference form");
	});

	test("refuses an XPath transform", async () => {
		let source = tamper(await signed(), (root) => {
			let transform = findElement(root, "ds:Transform");
			if (transform) {
				transform.attributes = { Algorithm: "http://www.w3.org/TR/1999/REC-xpath-19991116" };
			}
		});

		expect(expectFailure(await verify(source)).message).toContain("transform chain");
	});

	test("refuses an encrypted assertion where the connection takes cleartext", async () => {
		let source = tamper(await signed("response"), (root) => {
			let assertion = findElement(root, "saml:Assertion");
			root.children = root.children?.map((child) =>
				child === assertion
					? { name: "saml:EncryptedAssertion", attributes: {}, children: [] }
					: child,
			);
		});

		let error = expectFailure(await verify(source));
		expect(error.message).toContain("encrypted assertion");
	});
});

describe("verifyResponse, conditions", () => {
	test("refuses an assertion addressed to another audience", async () => {
		let error = expectFailure(await verify(await signed(), { audience: "https://other.example" }));
		expect(error.name).toBe("AssertionConditionError");
		expect(error).toHaveProperty("condition", "audience");
	});

	test("refuses a confirmation naming another recipient", async () => {
		let error = expectFailure(
			await verify(await signed(), { recipient: "https://other.example/acs" }),
		);
		expect(error).toHaveProperty("condition", "recipient");
	});

	test("refuses a response sent to another destination", async () => {
		let error = expectFailure(
			await verify(await signed(), { destination: "https://other.example/acs" }),
		);
		expect(error).toHaveProperty("condition", "destination");
	});

	test("refuses an assertion answering another request", async () => {
		let error = expectFailure(await verify(await signed(), { inResponseTo: "_other" }));
		expect(error).toHaveProperty("condition", "in-response-to");
	});

	test("refuses a request-bound assertion where none was expected", async () => {
		let error = expectFailure(await verify(await signed(), { inResponseTo: null }));
		expect(error).toHaveProperty("condition", "in-response-to");
	});

	test("refuses an expired assertion", async () => {
		let source = await signed("assertion", {
			notBefore: new Date("2026-09-21T11:00:00Z"),
			notOnOrAfter: new Date("2026-09-21T11:30:00Z"),
		});

		expect(expectFailure(await verify(source))).toHaveProperty("condition", "not-on-or-after");
	});

	test("refuses an assertion that is not yet valid", async () => {
		let source = await signed("assertion", {
			notBefore: new Date("2026-09-21T13:00:00Z"),
			notOnOrAfter: new Date("2026-09-21T14:00:00Z"),
		});

		expect(expectFailure(await verify(source))).toHaveProperty("condition", "not-before");
	});

	test("reports a status the provider did not succeed with", async () => {
		let source = await signed("assertion", {
			status: "urn:oasis:names:tc:SAML:2.0:status:Requester",
		});

		let error = expectFailure(await verify(source));
		expect(error.name).toBe("ResponseStatusError");
		expect(error).toHaveProperty("status", "urn:oasis:names:tc:SAML:2.0:status:Requester");
	});
});

describe("verifyResponse, replay", () => {
	test("refuses an assertion id the store already holds", async () => {
		let store = emptyStore();
		let source = await signed();

		expect(isSuccess(await verify(source, { replay: store }))).toBe(true);
		expect(expectFailure(await verify(source, { replay: store })).name).toBe(
			"ReplayedAssertionError",
		);
	});

	test("remembers the id only once everything else has passed", async () => {
		let remembered: string[] = [];
		let store: ReplayStore = {
			seen: () => Promise.resolve(false),
			remember: (id) => {
				remembered.push(id);
				return Promise.resolve();
			},
		};

		await verify(await signed(), { replay: store, audience: "https://other.example" });
		expect(remembered).toEqual([]);
	});

	test("reports a store that could not be consulted as its own failure", async () => {
		let store: ReplayStore = {
			seen: () => Promise.reject(new Error("unreachable")),
			remember: () => Promise.resolve(),
		};

		expect(expectFailure(await verify(await signed(), { replay: store })).name).toBe(
			"ReplayStoreError",
		);
	});
});

/** Flips one base64 character in place, which changes exactly one byte of the value. */
function flipBase64(element: XML.Element | undefined): void {
	if (!element) throw new Error("fixture shape changed");
	let [value] = element.children ?? [];
	if (typeof value !== "string") throw new Error("fixture shape changed");

	let first = value[0] === "A" ? "B" : "A";
	element.children = [`${first}${value.slice(1)}`];
}

/** Rewrites a fixture's signature method, for the tests about other algorithms. */
function mutateSignatureMethod(root: XML.Element, algorithm: string): XML.Element {
	let method = findElement(root, "ds:SignatureMethod");
	if (method) method.attributes = { Algorithm: algorithm };
	return root;
}
