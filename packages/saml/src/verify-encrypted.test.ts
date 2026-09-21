/**
 * Verification of an encrypted assertion end to end: the session key out of
 * RSA-OAEP, the assertion out of AES in both modes providers emit, and the
 * signature checked over the plaintext — plus the outcomes that must all look
 * the same from outside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

import { randomBytes } from "@sdxc/crypto";
import { Base64 } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";
import { beforeAll, describe, expect, test } from "vitest";

import type { ReplayStore } from "./replay-store.js";

import { Certificate } from "./certificate.js";
import { encryptAssertion } from "./fixtures/encrypt-assertion.js";
import {
	buildResponse,
	findElement,
	reparse,
	signDocument,
	stringify,
} from "./fixtures/sign-response.js";
import { buildCertificate, buildTbsCertificate } from "./lib/der.js";
import { ASSERTION_NS, PROTOCOL_NS } from "./lib/namespaces.js";
import { verifyResponse } from "./verify-response.js";

/** The moment every fixture's window is drawn around. */
const NOW = new Date("2026-09-21T12:00:00Z");

/** The audience every fixture addresses. */
const AUDIENCE = "https://sp.example.com/metadata";

/** The consumer service every fixture is sent to. */
const ACS = "https://sp.example.com/acs";

/** The identity provider's signing key, and the certificate carrying its public half. */
let signing: CryptoKeyPair;
let signingCertificate: Certificate;

/** The service provider's own key pair, which assertions are encrypted to. */
let transport: CryptoKeyPair;

/** A second service-provider key pair nothing encrypts to. */
let otherTransport: CryptoKeyPair;

beforeAll(async () => {
	signing = await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: Uint8Array.of(0x01, 0x00, 0x01),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	);

	let transportParameters = {
		name: "RSA-OAEP",
		modulusLength: 2048,
		publicExponent: Uint8Array.of(0x01, 0x00, 0x01),
		hash: "SHA-256",
	} as const;

	transport = await crypto.subtle.generateKey(transportParameters, true, ["encrypt", "decrypt"]);
	otherTransport = await crypto.subtle.generateKey(transportParameters, true, [
		"encrypt",
		"decrypt",
	]);

	let spki = new Uint8Array(await crypto.subtle.exportKey("spki", signing.publicKey));
	let tbs = buildTbsCertificate({
		spki,
		commonName: "idp",
		serial: randomBytes(8),
		notBefore: new Date("2026-01-01T00:00:00Z"),
		notAfter: new Date("2027-01-01T00:00:00Z"),
	});
	if (isFailure(tbs)) throw tbs.error;

	let signature = await crypto.subtle.sign(
		{ name: "RSASSA-PKCS1-v1_5" },
		signing.privateKey,
		tbs.data,
	);
	let parsed = await Certificate.parse(
		Base64.encode(buildCertificate(tbs.data, new Uint8Array(signature))),
	);
	if (isFailure(parsed)) throw parsed.error;
	signingCertificate = parsed.data;
});

/**
 * Signs an assertion as its own document, which is what an encrypted assertion
 * is once it has been opened, and the form its signature was taken over.
 */
async function signedAssertion(nameId?: string): Promise<string> {
	let response = buildResponse(nameId ? { nameId } : {}, "assertion");
	let assertion = findElement(response, "saml:Assertion");
	if (!assertion) throw new Error("the fixture carries no assertion");

	assertion.attributes = { "xmlns:saml": ASSERTION_NS, ...assertion.attributes };
	return signDocument(assertion, signing.privateKey);
}

/**
 * Builds a response whose assertion arrives encrypted, which is the document a
 * provider configured for encryption actually posts.
 */
async function encryptedResponse(mode: "GCM" | "CBC", bits: 128 | 256): Promise<string> {
	let plaintext = await signedAssertion();
	let encrypted = await encryptAssertion({
		plaintext,
		publicKey: transport.publicKey,
		mode,
		bits,
	});

	let shell = reparse(stringify(buildResponse({}, "response")));
	replaceAssertion(shell, encrypted);
	stripSignature(shell);

	return stringify(shell);
}

/** Swaps the cleartext assertion in a shell response for an encrypted one. */
function replaceAssertion(root: XML.Element, encrypted: XML.Element): void {
	let assertion = findElement(root, "saml:Assertion");
	root.children = root.children?.map((child) => (child === assertion ? encrypted : child));
}

/** Removes the shell's own placeholder signature, leaving the assertion's the only one. */
function stripSignature(root: XML.Element): void {
	let signature = findElement(root, "ds:Signature");
	root.children = root.children?.filter((child) => child !== signature);
}

/** A replay store that remembers what it was told, for one verification each. */
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

/** Runs a verification configured to accept an encrypted assertion. */
async function verify(
	source: string,
	overrides: Partial<Parameters<typeof verifyResponse>[1]> = {},
) {
	return verifyResponse(source, {
		certificates: [signingCertificate],
		audience: AUDIENCE,
		destination: ACS,
		recipient: ACS,
		inResponseTo: "_req1",
		decryptionKey: transport.privateKey,
		replay: emptyStore(),
		clock: { now: NOW, skew: "60 seconds" },
		...overrides,
	});
}

describe("verifyResponse, encrypted assertions", () => {
	test.each([
		["GCM", 256],
		["GCM", 128],
		["CBC", 256],
		["CBC", 128],
	] as const)("opens an assertion encrypted with AES-%s-%d", async (mode, bits) => {
		let result = await verify(await encryptedResponse(mode, bits));
		if (isFailure(result)) throw new Error(`${result.error.name}: ${result.error.message}`);

		expect(result.data.nameId?.value).toBe("user@example.com");
		expect(result.data.id).toBe("_assertion1");
	});

	test("accepts one of several private keys", async () => {
		let source = await encryptedResponse("GCM", 256);
		let result = await verify(source, {
			decryptionKey: [otherTransport.privateKey, transport.privateKey],
		});

		expect(isSuccess(result)).toBe(true);
	});

	test("refuses an assertion encrypted to another key with one indistinguishable failure", async () => {
		let source = await encryptedResponse("GCM", 256);
		let result = await verify(source, { decryptionKey: otherTransport.privateKey });

		if (isSuccess(result)) throw new Error("the assertion decrypted");
		expect(result.error.name).toBe("DecryptionFailedError");
	});

	test("answers the same failure for a damaged ciphertext", async () => {
		let source = await encryptedResponse("CBC", 256);
		let damaged = stringify(
			mutate(reparse(source), (root) => {
				let values = collect(root, "xenc:CipherValue");
				let content = values.at(-1)?.children?.[0];
				if (typeof content === "string") {
					let target = values.at(-1);
					if (target) target.children = [`${content[0] === "A" ? "B" : "A"}${content.slice(1)}`];
				}
			}),
		);

		let result = await verify(damaged);
		if (isSuccess(result)) throw new Error("the assertion decrypted");
		expect(result.error.name).toBe("DecryptionFailedError");
	});

	test("refuses a response carrying both a cleartext and an encrypted assertion", async () => {
		let source = await encryptedResponse("GCM", 256);
		let both = stringify(
			mutate(reparse(source), (root) => {
				let assertion = findElement(
					reparse(stringify(buildResponse({}, "response"))),
					"saml:Assertion",
				);
				if (assertion) root.children?.push(assertion);
			}),
		);

		let result = await verify(both);
		if (isSuccess(result)) throw new Error("the response verified");
		expect(result.error.name).toBe("WrappedAssertionError");
	});

	test("answers the same failure for a plaintext that is not an assertion", async () => {
		let encrypted = await encryptAssertion({
			plaintext: `<samlp:Response xmlns:samlp="${PROTOCOL_NS}"/>`,
			publicKey: transport.publicKey,
			mode: "GCM",
			bits: 256,
		});

		let shell = reparse(stringify(buildResponse({}, "response")));
		replaceAssertion(shell, encrypted);
		stripSignature(shell);

		let result = await verify(stringify(shell));
		if (isSuccess(result)) throw new Error("the response verified");
		expect(result.error.name).toBe("DecryptionFailedError");
	});

	test("answers the same failure for a DOCTYPE hidden inside the ciphertext", async () => {
		let encrypted = await encryptAssertion({
			plaintext: `<!DOCTYPE a><saml:Assertion xmlns:saml="${ASSERTION_NS}"/>`,
			publicKey: transport.publicKey,
			mode: "GCM",
			bits: 256,
		});

		let shell = reparse(stringify(buildResponse({}, "response")));
		replaceAssertion(shell, encrypted);
		stripSignature(shell);

		let result = await verify(stringify(shell));
		if (isSuccess(result)) throw new Error("the response verified");
		expect(result.error.name).toBe("DecryptionFailedError");
	});
});

/** Applies a mutation to a tree and answers it, so a test reads as one expression. */
function mutate(root: XML.Element, change: (root: XML.Element) => void): XML.Element {
	change(root);
	return root;
}

/** Every element in a plain tree carrying one raw name, in document order. */
function collect(root: XML.Element, name: string): XML.Element[] {
	let found: XML.Element[] = root.name === name ? [root] : [];
	for (let node of root.children ?? []) {
		if (typeof node !== "string") found.push(...collect(node, name));
	}
	return found;
}
