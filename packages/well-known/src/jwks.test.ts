/**
 * Exercises the JWK Set document with RFC 7517 Appendix A.1's public keys: unusable
 * entries dropped and counted per §5, private members refused by `stringify`, and
 * the servable descriptor publishing only public halves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Jwk } from "./jwks.js";

import { jwks, parse, stringify } from "./jwks.js";

/** The EC key of RFC 7517 Appendix A.1. */
const EC_KEY: Jwk = {
	kty: "EC",
	crv: "P-256",
	x: "MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4",
	y: "4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM",
	use: "enc",
	kid: "1",
};

/** The RSA key of RFC 7517 Appendix A.1, its modulus shortened. */
const RSA_KEY: Jwk = {
	kty: "RSA",
	n: "0vx7agoebGcQSuu",
	e: "AQAB",
	alg: "RS256",
	kid: "2011-04-29",
};

describe(parse, () => {
	test("reads the RFC 7517 Appendix A.1 set", () => {
		let set = unwrap(parse(JSON.stringify({ keys: [EC_KEY, RSA_KEY] })));
		expect(set.keys).toEqual([EC_KEY, RSA_KEY]);
		expect(set.skipped).toBe(0);
	});

	test("drops entries without kty, without their key type's members, or that are not objects (§5)", () => {
		let set = unwrap(
			parse(
				JSON.stringify({
					keys: [EC_KEY, { kid: "x" }, { kty: "RSA", n: "abc" }, "key", { kty: "future" }],
				}),
			),
		);
		expect(set.keys).toEqual([EC_KEY, { kty: "future" }]);
		expect(set.skipped).toBe(3);
	});

	test("fails when keys is missing", () => {
		let result = parse("{}");
		expect(isFailure(result) && result.error.issues).toEqual([
			{ at: "/keys", message: expect.any(String) },
		]);
	});
});

describe(stringify, () => {
	test("writes a public set", () => {
		expect(JSON.parse(unwrap(stringify({ keys: [EC_KEY] })))).toEqual({ keys: [EC_KEY] });
	});

	test("refuses a private member, naming where it is", () => {
		let result = stringify({
			keys: [EC_KEY, { ...EC_KEY, d: "secret" }, { kty: "oct", k: "secret" }],
		});
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/keys/1/d",
			"/keys/2/k",
		]);
	});
});

describe("jwks", () => {
	test("serves the public half of every key and leaves symmetric keys out", () => {
		let text = jwks.stringify({
			keys: [
				{ ...EC_KEY, d: "secret" },
				{ kty: "oct", k: "secret" },
			],
		});
		expect(JSON.parse(text)).toEqual({ keys: [EC_KEY] });
		expect(jwks.name).toBe("jwks.json");
	});
});
