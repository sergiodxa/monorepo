/**
 * Tests for Signed Statements, Receipts and Transparent Statements, built from the RFC 9943
 * examples (the Figure 5 protected header, the Figure 11 eight-entry proof) and signed by the
 * key pair RFC 9052 Appendix C publishes, which SCRAPI's key set example also lists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CBORValue } from "@sdxc/cbor";

import { decode, encode } from "@sdxc/cbor";
import * as COSE from "@sdxc/cbor/cose";
import { Base64Url, Hex } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SigningKey } from "./statement.js";

import { readReceipt, verifyReceipt, verifyTransparentStatement } from "./receipt.js";
import {
	attachReceipts,
	readStatement,
	registeredEntry,
	signStatement,
	verifyStatement,
} from "./statement.js";
import { issueReceipt } from "./test/tree.js";

/** Bytes from hex. */
function hex(text: string): Uint8Array<ArrayBuffer> {
	return unwrap(Hex.decode(text));
}

/**
 * The SCRAPI Section 2.1 key set: RFC 9052 Appendix C.7's P-256 keys "meriadoc" and "11",
 * under the kids `kid1` and `kid2` the SCRAPI example gives them.
 */
const SERVICE_KEYS: COSE.Key[] = [
	new Map<CBORValue, CBORValue>([
		[-1, 1],
		[-2, hex("65eda5a12577c2bae829437fe338701a10aaa375e1bb5b5de108de439c08551d")],
		[-3, hex("1e52ed75701163f7f9e40ddf9f341b3dc9ba860af7e0ca7ca7e9eecd0084d19c")],
		[1, 2],
		[2, new TextEncoder().encode("kid1")],
	]),
	new Map<CBORValue, CBORValue>([
		[-1, 1],
		[-2, hex("bac5b11cad8f99f9c72b05cf4b9e26d244dc189f745228255a219a86d6a09eff")],
		[-3, hex("20138bf82dc1b6d562be0fa54ab7804a3a64b6d72ccfed6b6fb6ed28bbfc117e")],
		[1, 2],
		[2, new TextEncoder().encode("kid2")],
	]),
];

/** The service's signing key: RFC 9052 Appendix C.7.2's private half of key "11". */
async function serviceSigningKey(): Promise<CryptoKey> {
	let key = new Map(SERVICE_KEYS[1]).set(
		-4,
		hex("57c92077664146e876760c9520d054aa93c3afb04e306705db6090308507b4d3"),
	);
	return unwrap(await COSE.importKey(key));
}

/** A fresh ES256 issuer key, shaped as an `@sdxc/jwt` key pair. */
async function issuerKey(): Promise<SigningKey & { public: CryptoKey }> {
	let pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
		"sign",
		"verify",
	])) as CryptoKeyPair;
	return { id: "issuer-key", alg: "ES256", private: pair.privateKey, public: pair.publicKey };
}

/** A statement shaped like RFC 9943 Figure 5. */
async function figure5Statement(
	key: SigningKey,
	payload = new TextEncoder().encode('{"sbom":true}'),
) {
	return unwrap(
		await signStatement({
			issuer: "software.vendor.example",
			subject: "vendor.product.example",
			contentType: "application/example+json",
			payload,
			key,
		}),
	);
}

/** A log of eight entries whose last one is `entry`, as the Figure 11 proof (size 8, leaf 7) assumes. */
function logEndingWith(entry: Uint8Array): Uint8Array[] {
	return [...Array.from({ length: 7 }, (_, index) => Uint8Array.of(index)), entry];
}

describe("signStatement", () => {
	test("writes the RFC 9943 Figure 5 protected header", async () => {
		let key = await issuerKey();
		let statement = unwrap(readStatement(await figure5Statement(key)));
		let header = statement.message.protected;
		expect(header.get(1)).toBe(-7);
		expect(header.get(3)).toBe("application/example+json");
		expect(header.get(4)).toEqual(new TextEncoder().encode("issuer-key"));
		expect(header.get(15)).toEqual(
			new Map([
				[1, "software.vendor.example"],
				[2, "vendor.product.example"],
			]),
		);
		expect(statement.issuer).toBe("software.vendor.example");
		expect(statement.subject).toBe("vendor.product.example");
		expect(statement.receipts).toEqual([]);
	});

	test("verifies under the issuer's public key, detached or not", async () => {
		let key = await issuerKey();
		let embedded = await figure5Statement(key);
		expect(isFailure(await verifyStatement(embedded, key.public))).toBe(false);

		let digest = new Uint8Array(32).fill(7);
		let detached = unwrap(
			await signStatement({
				issuer: "https://vendor.example",
				subject: "cli@1.2.3",
				payload: digest,
				detached: true,
				key,
			}),
		);
		expect(unwrap(readStatement(detached)).payload).toBeNull();
		expect(isFailure(await verifyStatement(detached, key.public, { payload: digest }))).toBe(false);
		let other = await verifyStatement(detached, key.public, { payload: new Uint8Array(32) });
		expect(isFailure(other) && other.error.code).toBe("invalid-signature");
	});

	test("writes the issue time as the iat claim", async () => {
		let key = await issuerKey();
		let bytes = unwrap(
			await signStatement({
				issuer: "i",
				subject: "s",
				payload: Uint8Array.of(1),
				issuedAt: new Date("2026-10-24T00:00:00Z"),
				key,
			}),
		);
		expect(unwrap(readStatement(bytes)).claims.get(6)).toBe(1_792_800_000);
	});

	test("refuses an unknown algorithm name and an empty subject", async () => {
		let key = await issuerKey();
		let algorithm = await signStatement({
			issuer: "i",
			subject: "s",
			payload: Uint8Array.of(1),
			key: { ...key, alg: "HS256" },
		});
		expect(isFailure(algorithm) && algorithm.error.code).toBe("unsupported-algorithm");
		let subject = await signStatement({ issuer: "i", subject: "", payload: Uint8Array.of(1), key });
		expect(isFailure(subject) && subject.error.code).toBe("missing-claim");
	});
});

describe("readStatement", () => {
	test("refuses a COSE_Sign1 without CWT claims or a kid", async () => {
		let pair = await issuerKey();
		let bare = unwrap(
			await COSE.sign1({
				protected: new Map([[1, -7]]),
				payload: Uint8Array.of(1),
				key: pair.private,
			}),
		);
		let noClaims = readStatement(bare);
		expect(isFailure(noClaims) && noClaims.error.code).toBe("missing-claim");

		let claims = new Map([
			[1, "i"],
			[2, "s"],
		]);
		let noKid = unwrap(
			await COSE.sign1({
				protected: new Map<CBORValue, CBORValue>([
					[1, -7],
					[15, claims],
				]),
				payload: Uint8Array.of(1),
				key: pair.private,
			}),
		);
		let result = readStatement(noKid);
		expect(isFailure(result) && result.error.code).toBe("malformed");
	});
});

describe("verifyReceipt", () => {
	test("verifies a Figure 11 shaped receipt for the registered entry", async () => {
		let statement = await figure5Statement(await issuerKey());
		let entry = unwrap(registeredEntry(statement));
		let receipt = await issueReceipt(logEndingWith(entry), 7, {
			key: await serviceSigningKey(),
			kid: new TextEncoder().encode("kid2"),
			issuer: "transparency.vendor.example",
			subject: "vendor.product.example",
		});

		let read = unwrap(readReceipt(receipt));
		expect(read.vds).toBe(1);
		expect(read.inclusionProofs).toHaveLength(1);
		expect(read.inclusionProofs[0]?.treeSize).toBe(8);
		expect(read.inclusionProofs[0]?.leafIndex).toBe(7);
		expect(read.inclusionProofs[0]?.path).toHaveLength(3);

		let verified = unwrap(await verifyReceipt(receipt, { entry, keys: SERVICE_KEYS }));
		expect(verified.issuer).toBe("transparency.vendor.example");
		expect(verified.root).toHaveLength(32);
	});

	test("refuses the receipt for any other entry", async () => {
		let entry = Uint8Array.of(42);
		let receipt = await issueReceipt(logEndingWith(entry), 7, {
			key: await serviceSigningKey(),
			kid: new TextEncoder().encode("kid2"),
			issuer: "ts",
			subject: "s",
		});
		let result = await verifyReceipt(receipt, { entry: Uint8Array.of(43), keys: SERVICE_KEYS });
		expect(isFailure(result) && result.error.code).toBe("invalid-signature");
	});

	test("refuses a receipt signed by another key under the same kid", async () => {
		let entry = Uint8Array.of(42);
		let receipt = await issueReceipt(logEndingWith(entry), 7, {
			key: await serviceSigningKey(),
			kid: new TextEncoder().encode("kid1"),
			issuer: "ts",
			subject: "s",
		});
		let result = await verifyReceipt(receipt, { entry, keys: SERVICE_KEYS });
		expect(isFailure(result) && result.error.code).toBe("invalid-signature");
	});

	test("finds the key by a text kid holding its base64url thumbprint, as SCRAPI's example does", async () => {
		let entry = Uint8Array.of(42);
		let thumbprint = unwrap(await COSE.thumbprint(SERVICE_KEYS[1] as COSE.Key));
		let receipt = await issueReceipt(logEndingWith(entry), 7, {
			key: await serviceSigningKey(),
			kid: Base64Url.encode(thumbprint),
			issuer: "https://blue.notary.example",
			subject: "https://green.software.example/cli@v1.2.3",
		});
		let result = await verifyReceipt(receipt, {
			entry,
			keys: SERVICE_KEYS,
			issuer: "https://blue.notary.example",
		});
		expect(isFailure(result)).toBe(false);
	});

	test("refuses an unknown kid, another issuer and another VDS", async () => {
		let entry = Uint8Array.of(42);
		let key = await serviceSigningKey();
		let unknown = await issueReceipt(logEndingWith(entry), 7, {
			key,
			kid: "kid9",
			issuer: "ts",
			subject: "s",
		});
		let missing = await verifyReceipt(unknown, { entry, keys: SERVICE_KEYS });
		expect(isFailure(missing) && missing.error.code).toBe("unknown-key");

		let issuer = await verifyReceipt(unknown, { entry, keys: SERVICE_KEYS, issuer: "other" });
		expect(isFailure(issuer) && issuer.error.code).toBe("untrusted-issuer");

		let message = unwrap(COSE.decodeSign1(unknown));
		let header = unwrap(decode(message.encodedProtected)) as Map<CBORValue, CBORValue>;
		let otherVds = unwrap(
			COSE.encodeSign1({ ...message, encodedProtected: unwrap(encode(header.set(395, 2))) }),
		);
		let vds = readReceipt(otherVds);
		expect(isFailure(vds) && vds.error.code).toBe("unsupported-vds");
	});
});

describe("verifyTransparentStatement", () => {
	test("verifies the statement and the receipts attached to it", async () => {
		let issuer = await issuerKey();
		let statement = await figure5Statement(issuer);
		let entry = unwrap(registeredEntry(statement));
		let receipt = await issueReceipt(logEndingWith(entry), 7, {
			key: await serviceSigningKey(),
			kid: new TextEncoder().encode("kid2"),
			issuer: "transparency.vendor.example",
			subject: "vendor.product.example",
		});
		let foreign = await issueReceipt([entry], 0, {
			key: await serviceSigningKey(),
			kid: "elsewhere",
			issuer: "x",
			subject: "y",
		});

		let transparent = unwrap(attachReceipts(statement, [receipt, foreign]));
		expect(unwrap(readStatement(transparent)).receipts).toHaveLength(2);
		expect(unwrap(registeredEntry(transparent))).toEqual(entry);

		let result = unwrap(
			await verifyTransparentStatement(transparent, {
				keys: SERVICE_KEYS,
				issuerKey: issuer.public,
			}),
		);
		expect(result.receipts).toHaveLength(1);
		expect(result.statement.subject).toBe("vendor.product.example");
	});

	test("fails when no receipt verifies under the given keys", async () => {
		let statement = await figure5Statement(await issuerKey());
		let result = await verifyTransparentStatement(statement, { keys: SERVICE_KEYS });
		expect(isFailure(result) && result.error.code).toBe("unknown-key");
	});
});
