/**
 * Exercises the Web Bot Auth key directory with the draft's own example keys: reading
 * drops what a verifier cannot use, building labels each key with its thumbprint, and
 * serving answers the registered media type and lets a signer cover the body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { DirectoryKey } from "./http-message-signatures-directory.js";

import {
	build,
	httpMessageSignaturesDirectory,
	MEDIA_TYPE,
	parse,
} from "./http-message-signatures-directory.js";
import { respond } from "./response.js";

/** The RFC 9421 B.1.4 Ed25519 key the draft's Appendix E.2.3 directory publishes. */
const PUBLIC_KEY: DirectoryKey = {
	kty: "OKP",
	crv: "Ed25519",
	kid: "poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U",
	x: "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs",
	use: "sig",
};

/** The response body of the draft's Appendix E.2.3, byte for byte. */
const E_2_3_BODY =
	'{"keys":[{"kty":"OKP","crv":"Ed25519","kid":"poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U","x":"JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs","use":"sig"}]}';

describe(parse, () => {
	test("reads the draft's §5.5.1 directory, nbf and exp included", () => {
		let key = { ...PUBLIC_KEY, nbf: 1712793600, exp: 1715385600 };
		let directory = unwrap(parse(JSON.stringify({ keys: [key] })));

		expect(directory).toEqual({ keys: [key], skipped: 0 });
	});

	test("drops symmetric, private, unregistered-alg and badly bounded keys", () => {
		let directory = unwrap(
			parse(
				JSON.stringify({
					keys: [
						PUBLIC_KEY,
						{ kty: "oct", k: "c2VjcmV0" },
						{ ...PUBLIC_KEY, d: "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU" },
						{ ...PUBLIC_KEY, alg: "hmac-sha256" },
						{ ...PUBLIC_KEY, exp: "tomorrow" },
						{ kty: "OKP" },
					],
				}),
			),
		);

		expect(directory).toEqual({ keys: [PUBLIC_KEY], skipped: 5 });
	});

	test("fails when keys is not an array, naming the format", () => {
		let directory = parse('{"keys":{}}');

		expect(isFailure(directory) && directory.error.format).toBe(
			"http-message-signatures-directory",
		);
	});
});

describe(build, () => {
	test("publishes a private key's public half, kid kept and use set", () => {
		let directory = build([
			{
				kty: "OKP",
				crv: "Ed25519",
				kid: PUBLIC_KEY.kid,
				x: PUBLIC_KEY.x,
				d: "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU",
				key_ops: ["sign"],
			},
		]);

		expect(unwrap(directory)).toEqual({ keys: [PUBLIC_KEY] });
	});

	test("refuses a symmetric key and a key without kid, each at its index", () => {
		let { kid: _, ...unlabelled } = PUBLIC_KEY;
		let directory = build([PUBLIC_KEY, { kty: "oct", k: "c2VjcmV0" }, unlabelled]);

		expect(isFailure(directory) && directory.error.issues).toEqual([
			{ at: "/keys/1", message: "Key 1 is symmetric." },
			{ at: "/keys/2/kid", message: "Key 2 has no kid." },
		]);
	});
});

describe("httpMessageSignaturesDirectory", () => {
	test("serves the draft's E.2.3 body with the registered media type and open CORS", async () => {
		let response = await respond(httpMessageSignaturesDirectory, { keys: [PUBLIC_KEY] });

		expect(response.headers.get("content-type")).toBe(MEDIA_TYPE);
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
		expect(await response.text()).toBe(E_2_3_BODY);
	});

	test("hands sign the full body even for HEAD, then drops it", async () => {
		let signedBody: string | null = null;
		let request = new Request(
			"https://signature-agent.test/.well-known/http-message-signatures-directory",
			{
				method: "HEAD",
			},
		);

		let response = await respond(
			httpMessageSignaturesDirectory,
			{ keys: [PUBLIC_KEY] },
			{
				request,
				async sign(full) {
					signedBody = await full.clone().text();
					let headers = new Headers(full.headers);
					headers.set("signature", "binding=:AA==:");
					return new Response(full.body, { status: full.status, headers });
				},
			},
		);

		expect(signedBody).toBe(E_2_3_BODY);
		expect(response.headers.get("signature")).toBe("binding=:AA==:");
		expect(response.body).toBeNull();
	});
});
