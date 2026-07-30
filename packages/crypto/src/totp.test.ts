/**
 * Tests for TOTP code generation, verification, and enrollment URIs.
 *
 * Every code case is an RFC 6238 Appendix B vector across all three hash
 * functions, so this suite proves interoperability with real authenticator apps
 * rather than only self-consistency between `code` and `verify`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure, unwrap } from "@pkg/result";

import { encode as encodeBase32 } from "./lib/base32";
import { totp } from "./totp";

/** RFC 6238 seed for SHA-1, base32 encoded as this API expects. */
const SEED_SHA1 = encodeBase32(new TextEncoder().encode("12345678901234567890"));

/** RFC 6238 seed for SHA-256, base32 encoded. */
const SEED_SHA256 = encodeBase32(new TextEncoder().encode("12345678901234567890123456789012"));

/** RFC 6238 seed for SHA-512, base32 encoded. */
const SEED_SHA512 = encodeBase32(
	new TextEncoder().encode("1234567890123456789012345678901234567890123456789012345678901234"),
);

/** Appendix B uses 8-digit codes on the default 30 second step. */
const RFC_DIGITS = 8;

/** Appendix B vectors: seconds since the epoch and the expected code per hash. */
const RFC_VECTORS = [
	{ seconds: 59, sha1: "94287082", sha256: "46119246", sha512: "90693936" },
	{ seconds: 1111111109, sha1: "07081804", sha256: "68084774", sha512: "25091201" },
	{ seconds: 1111111111, sha1: "14050471", sha256: "67062674", sha512: "99943326" },
	{ seconds: 1234567890, sha1: "89005924", sha256: "91819424", sha512: "93441116" },
	{ seconds: 2000000000, sha1: "69279037", sha256: "90698825", sha512: "38618901" },
	{ seconds: 20000000000, sha1: "65353130", sha256: "77737706", sha512: "47863826" },
] as const;

describe("totp.code", () => {
	test.each(RFC_VECTORS.map((vector) => [vector.seconds, vector.sha1] as const))(
		"matches the RFC 6238 SHA-1 vector at T=%i",
		async (seconds, expected) => {
			let code = await totp.code(SEED_SHA1, { at: seconds * 1000, digits: RFC_DIGITS });

			expect(unwrap(code)).toBe(expected);
		},
	);

	test.each(RFC_VECTORS.map((vector) => [vector.seconds, vector.sha256] as const))(
		"matches the RFC 6238 SHA-256 vector at T=%i",
		async (seconds, expected) => {
			let code = await totp.code(SEED_SHA256, {
				at: seconds * 1000,
				digits: RFC_DIGITS,
				algorithm: "SHA-256",
			});

			expect(unwrap(code)).toBe(expected);
		},
	);

	test.each(RFC_VECTORS.map((vector) => [vector.seconds, vector.sha512] as const))(
		"matches the RFC 6238 SHA-512 vector at T=%i",
		async (seconds, expected) => {
			let code = await totp.code(SEED_SHA512, {
				at: seconds * 1000,
				digits: RFC_DIGITS,
				algorithm: "SHA-512",
			});

			expect(unwrap(code)).toBe(expected);
		},
	);

	test("accepts a Date as the point in time", async () => {
		let code = await totp.code(SEED_SHA1, {
			at: new Date(59_000),
			digits: RFC_DIGITS,
		});

		expect(unwrap(code)).toBe("94287082");
	});

	test("defaults to six digits", async () => {
		expect(unwrap(await totp.code(SEED_SHA1, { at: 59_000 }))).toHaveLength(6);
	});

	test("keeps the code stable within one step and changes across steps", async () => {
		let early = unwrap(await totp.code(SEED_SHA1, { at: 60_000 }));
		let late = unwrap(await totp.code(SEED_SHA1, { at: 89_000 }));
		let next = unwrap(await totp.code(SEED_SHA1, { at: 90_000 }));

		expect(early).toBe(late);
		expect(next).not.toBe(early);
	});

	test("fails on a secret that is not base32", async () => {
		expect(isFailure(await totp.code("not base32!"))).toBe(true);
	});

	test("fails on parameters that cannot produce a code", async () => {
		expect(isFailure(await totp.code(SEED_SHA1, { digits: 0 }))).toBe(true);
		expect(isFailure(await totp.code(SEED_SHA1, { digits: 11 }))).toBe(true);
		expect(isFailure(await totp.code(SEED_SHA1, { step: 0 }))).toBe(true);
	});
});

describe("totp.verify", () => {
	test("accepts the code for the current step", async () => {
		let ok = await totp.verify(SEED_SHA1, "94287082", {
			at: 59_000,
			digits: RFC_DIGITS,
			window: 0,
		});

		expect(unwrap(ok)).toBe(true);
	});

	test("accepts the previous step's code within the drift window", async () => {
		let ok = await totp.verify(SEED_SHA1, "07081804", {
			at: 1111111111 * 1000,
			digits: RFC_DIGITS,
			window: 1,
		});

		expect(unwrap(ok)).toBe(true);
	});

	test("rejects the previous step's code with no drift window", async () => {
		let ok = await totp.verify(SEED_SHA1, "07081804", {
			at: 1111111111 * 1000,
			digits: RFC_DIGITS,
			window: 0,
		});

		expect(unwrap(ok)).toBe(false);
	});

	test("rejects a code from another secret", async () => {
		let ok = await totp.verify(SEED_SHA256, "94287082", { at: 59_000, digits: RFC_DIGITS });

		expect(unwrap(ok)).toBe(false);
	});

	test("rejects a code of the wrong shape without failing", async () => {
		expect(unwrap(await totp.verify(SEED_SHA1, "", { at: 59_000 }))).toBe(false);
		expect(unwrap(await totp.verify(SEED_SHA1, "94287082", { at: 59_000 }))).toBe(false);
		expect(unwrap(await totp.verify(SEED_SHA1, "9428708a", { at: 59_000, digits: 8 }))).toBe(false);
		expect(unwrap(await totp.verify(SEED_SHA1, " 94287082 ", { at: 59_000, digits: 8 }))).toBe(
			false,
		);
	});

	test("verifies a freshly generated secret against its own code", async () => {
		let secret = totp.generateSecret();
		let code = unwrap(await totp.code(secret));

		expect(unwrap(await totp.verify(secret, code))).toBe(true);
	});

	test("stays within the epoch when the window reaches below it", async () => {
		let ok = await totp.verify(SEED_SHA1, "94287082", { at: 0, window: 5, digits: RFC_DIGITS });

		expect(isFailure(ok)).toBe(false);
	});

	test("fails on a negative window", async () => {
		expect(isFailure(await totp.verify(SEED_SHA1, "94287082", { window: -1 }))).toBe(true);
	});
});

describe("totp.generateSecret", () => {
	test("returns unpadded uppercase base32", () => {
		expect(totp.generateSecret()).toMatch(/^[A-Z2-7]+$/);
	});

	test("encodes 20 bytes by default", () => {
		// 20 bytes is 32 unpadded base32 characters.
		expect(totp.generateSecret()).toHaveLength(32);
	});

	test("honors the requested size", () => {
		expect(totp.generateSecret({ bytes: 10 })).toHaveLength(16);
	});

	test("returns a different secret on each call", () => {
		expect(totp.generateSecret()).not.toBe(totp.generateSecret());
	});
});

describe("totp.uri", () => {
	test("builds an otpauth URI an authenticator app can enroll from", () => {
		let uri = totp.uri("JBSWY3DPEHPK3PXP", { issuer: "Acme", account: "ada@example.com" });

		expect(uri).toBe(
			"otpauth://totp/Acme:ada%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Acme&algorithm=SHA1&digits=6&period=30",
		);
	});

	test("percent-encodes spaces instead of using plus signs", () => {
		let uri = totp.uri("JBSWY3DPEHPK3PXP", { issuer: "Acme Inc", account: "ada@example.com" });

		expect(uri).toContain("Acme%20Inc:ada%40example.com");
		expect(uri).toContain("issuer=Acme%20Inc");
		expect(uri).not.toContain("+");
	});

	test("reflects non-default parameters so the app mirrors them", () => {
		let uri = totp.uri("JBSWY3DPEHPK3PXP", {
			issuer: "Acme",
			account: "ada",
			algorithm: "SHA-256",
			digits: 8,
			step: 60,
		});

		expect(uri).toContain("algorithm=SHA256");
		expect(uri).toContain("digits=8");
		expect(uri).toContain("period=60");
	});
});
