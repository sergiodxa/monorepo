/**
 * Tests for secret normalization and rotation resolution.
 *
 * The prefixed and unprefixed forms must produce identical key material, and an
 * absent, empty, or non-base64 secret must fail closed, keeping HMAC
 * verification keyed only on secret material the sender actually provided.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { InvalidSecretError } from "./errors";
import { decodeSecret, resolveSecrets } from "./secret";

/** Base64 secret body used across the cases, 24 bytes once decoded. */
const SECRET = "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

describe("decodeSecret", () => {
	test("decodes the base64 body into key bytes", () => {
		expect(unwrap(decodeSecret(SECRET)).length).toBe(24);
	});

	test("accepts the whsec_ prefixed form as the same key", () => {
		expect([...unwrap(decodeSecret(`whsec_${SECRET}`))]).toEqual([...unwrap(decodeSecret(SECRET))]);
	});

	test("fails on an empty secret", () => {
		let result = decodeSecret("");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidSecretError);
	});

	test("fails on a prefix with nothing after it", () => {
		expect(isFailure(decodeSecret("whsec_"))).toBe(true);
	});

	test("fails on a secret that is not base64", () => {
		let result = decodeSecret("whsec_not a secret!");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidSecretError);
	});

	test("keeps the secret out of the error message", () => {
		let result = decodeSecret("whsec_not a secret!");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).not.toContain("not a secret");
	});

	test("fails when the type is bypassed with a missing value", () => {
		// @ts-expect-error - environment bindings are routinely typed as always present
		let result = decodeSecret(undefined);

		expect(isFailure(result)).toBe(true);
	});
});

describe("resolveSecrets", () => {
	test("resolves a single secret", () => {
		expect(unwrap(resolveSecrets({ secret: SECRET })).length).toBe(1);
	});

	test("resolves a rotation list in order, primary first", () => {
		let previous = "cHJldmlvdXMtc2VjcmV0LXZhbHVl";
		let keys = unwrap(resolveSecrets({ secret: SECRET, secrets: [previous] }));

		expect(keys.length).toBe(2);
		expect([...keys[0]!]).toEqual([...unwrap(decodeSecret(SECRET))]);
		expect([...keys[1]!]).toEqual([...unwrap(decodeSecret(previous))]);
	});

	test("fails when nothing is configured", () => {
		let result = resolveSecrets({});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidSecretError);
	});

	test("fails when the rotation list is empty", () => {
		expect(isFailure(resolveSecrets({ secrets: [] }))).toBe(true);
	});

	test("fails when one secret of a rotation is unusable", () => {
		expect(isFailure(resolveSecrets({ secrets: [SECRET, "not base64!"] }))).toBe(true);
	});
});
