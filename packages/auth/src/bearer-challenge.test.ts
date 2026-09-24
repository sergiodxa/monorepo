/**
 * Specs for the bearer challenge writer and reader, run against the RFC 6750 §3 and
 * RFC 9728 §5.1 examples, a header listing several schemes, and the quoting rules of
 * RFC 9110 §5.6.4.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { ChallengeParseError, parse, stringify } from "./bearer-challenge.js";

/** A parsed challenge with every member at its empty value, for `toEqual` comparisons. */
const EMPTY = {
	realm: null,
	scope: [],
	error: null,
	errorDescription: null,
	errorUri: null,
	resourceMetadata: null,
	extensions: {},
};

/** The metadata URL RFC 9728 §5.1's example points at. */
const METADATA = "https://resource.example.com/.well-known/oauth-protected-resource";

describe("stringify", () => {
	test("writes the bare scheme for a challenge with no parameters", () => {
		expect(stringify({})).toBe("Bearer");
	});

	test("writes RFC 6750 §3's rejected-token example", () => {
		expect(
			stringify({
				realm: "example",
				error: "invalid_token",
				errorDescription: "The access token expired",
			}),
		).toBe(
			`Bearer realm="example", error="invalid_token", error_description="The access token expired"`,
		);
	});

	test("writes RFC 9728 §5.1's metadata pointer", () => {
		expect(stringify({ resourceMetadata: new URL(METADATA) })).toBe(
			`Bearer resource_metadata="${METADATA}"`,
		);
	});

	test("orders parameters as the RFCs list them, extensions last", () => {
		expect(
			stringify({
				extensions: { max_age: "300" },
				resourceMetadata: new URL(METADATA),
				errorUri: new URL("https://docs.example.com/errors"),
				scope: ["read", "write"],
				error: "insufficient_scope",
				realm: "api",
			}),
		).toBe(
			`Bearer realm="api", scope="read write", error="insufficient_scope", error_uri="https://docs.example.com/errors", resource_metadata="${METADATA}", max_age="300"`,
		);
	});

	test("leaves out null members and an empty scope", () => {
		expect(stringify({ realm: null, scope: [], error: "invalid_request" })).toBe(
			`Bearer error="invalid_request"`,
		);
	});

	test("escapes quotes and backslashes", () => {
		expect(stringify({ errorDescription: `say "hi" \\o/` })).toBe(
			`Bearer error_description="say \\"hi\\" \\\\o/"`,
		);
	});

	test("replaces control characters so a value cannot end the header line", () => {
		expect(stringify({ realm: "a\r\nSet-Cookie: x" })).toBe(`Bearer realm="a  Set-Cookie: x"`);
	});
});

describe("parse", () => {
	test("reads RFC 6750 §3's realm-only example", () => {
		expect(unwrap(parse(`Bearer realm="example"`))).toEqual([{ ...EMPTY, realm: "example" }]);
	});

	test("reads RFC 6750 §3's rejected-token example", () => {
		expect(
			unwrap(
				parse(
					`Bearer realm="example", error="invalid_token", error_description="The access token expired"`,
				),
			),
		).toEqual([
			{
				...EMPTY,
				realm: "example",
				error: "invalid_token",
				errorDescription: "The access token expired",
			},
		]);
	});

	test("reads RFC 9728 §5.1's metadata pointer", () => {
		expect(unwrap(parse(`Bearer resource_metadata="${METADATA}"`))).toEqual([
			{ ...EMPTY, resourceMetadata: new URL(METADATA) },
		]);
	});

	test("reads RFC 9728 §5.2's insufficient-scope example", () => {
		let [challenge] = unwrap(
			parse(
				`Bearer error="insufficient_scope", scope="files:read files:write user:email", resource_metadata="${METADATA}"`,
			),
		);

		expect(challenge?.error).toBe("insufficient_scope");
		expect(challenge?.scope).toEqual(["files:read", "files:write", "user:email"]);
		expect(challenge?.resourceMetadata?.href).toBe(METADATA);
	});

	test("reads the bare scheme", () => {
		expect(unwrap(parse("Bearer"))).toEqual([EMPTY]);
	});

	test("finds the Bearer challenge in a header listing Basic before it", () => {
		expect(
			unwrap(parse(`Basic realm="simple", Bearer realm="api", error="invalid_token"`)),
		).toEqual([{ ...EMPTY, realm: "api", error: "invalid_token" }]);
	});

	test("finds the Bearer challenge after a scheme that carries a token68", () => {
		expect(unwrap(parse(`Negotiate YIIB9w==, Bearer realm="api"`))).toEqual([
			{ ...EMPTY, realm: "api" },
		]);
	});

	test("answers an empty list for RFC 9110 §11.6.1's example, which names no Bearer", () => {
		expect(
			unwrap(
				parse(`Newauth realm="apps", type=1, title="Login to \\"apps\\"", Basic realm="simple"`),
			),
		).toEqual([]);
	});

	test("answers an empty list for an empty header", () => {
		expect(unwrap(parse(""))).toEqual([]);
	});

	test("reads every Bearer challenge, in order", () => {
		let challenges = unwrap(parse(`Bearer realm="one", Bearer realm="two"`));
		expect(challenges.map((challenge) => challenge.realm)).toEqual(["one", "two"]);
	});

	test("unescapes quoted-pairs", () => {
		let [challenge] = unwrap(parse(`Bearer error_description="say \\"hi\\" \\\\o/"`));
		expect(challenge?.errorDescription).toBe(`say "hi" \\o/`);
	});

	test("reads names case-insensitively, token values, and loose whitespace", () => {
		let [challenge] = unwrap(parse(`bearer  REALM = api ,, Error=invalid_token`));
		expect(challenge).toEqual({ ...EMPTY, realm: "api", error: "invalid_token" });
	});

	test("keeps unknown parameters and unregistered values under their own names", () => {
		let [challenge] = unwrap(
			parse(`Bearer error="use_dpop_nonce", error_uri="/errors", max_age="300"`),
		);

		expect(challenge?.error).toBeNull();
		expect(challenge?.errorUri).toBeNull();
		expect(challenge?.extensions).toEqual({
			error: "use_dpop_nonce",
			error_uri: "/errors",
			max_age: "300",
		});
	});

	test("round-trips what stringify writes", () => {
		let written = {
			...EMPTY,
			realm: `a "quoted" realm`,
			scope: ["read", "write"],
			error: "insufficient_scope" as const,
			errorDescription: "needs write",
			errorUri: new URL("https://docs.example.com/errors"),
			resourceMetadata: new URL(METADATA),
			extensions: { max_age: "300" },
		};

		expect(unwrap(parse(stringify(written)))).toEqual([written]);
	});

	test.each([
		["an unterminated quoted-string", `Bearer realm="api`],
		["a parameter with no value", `Bearer realm=`],
		["a parameter with no equals sign", `Bearer realm "api"`],
		["a missing separator", `Bearer realm="a" error="invalid_token"`],
		["a scheme glued to its parameters", `Bearer"x"`],
		["a leading equals sign", `=Bearer`],
		["a token68 on a Bearer challenge", `Bearer abc==`],
		["a repeated parameter", `Bearer realm="a", realm="b"`],
	])("fails on %s", (_, header) => {
		let result = parse(header);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(ChallengeParseError);
	});
});
