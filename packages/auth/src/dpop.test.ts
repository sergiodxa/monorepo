/**
 * Covers both ends of DPoP: the proofs a client key signs and the nonce retries its
 * `fetch` performs against servers mocked with MSW, and every check `verifyProof` runs on
 * a presented proof, each against a proof signed for real.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@sdxc/crypto";
import { JWK, JWT } from "@sdxc/jwt";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { AuthErrorCode } from "./auth-error.js";
import { accessTokenHash, DPoP, DPoPProof, verifyProof } from "./dpop.js";

/** The resource every request in this file is sent to. */
const RESOURCE = "https://api.test/reports";

/** The token endpoint every grant in this file is sent to. */
const TOKEN_ENDPOINT = "https://auth.test/oauth/token";

let server = setupServer();

let dpop: DPoP;

/** A replay store kept in memory, standing in for the one a server shares. */
class MemoryReplayStore implements DPoP.ReplayStore {
	#seen = new Map<string, number>();

	/**
	 * Records a key until it expires.
	 *
	 * @param key - The proof's key.
	 * @param expiresAt - When the record lapses.
	 */
	async claim(key: string, expiresAt: Date): Promise<boolean> {
		let seen = this.#seen.get(key);
		if (seen !== undefined && seen > Date.now()) return false;
		this.#seen.set(key, expiresAt.getTime());
		return true;
	}
}

let replay: MemoryReplayStore;

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	dpop = await DPoP.generate();
});

beforeEach(() => {
	replay = new MemoryReplayStore();
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

/** The protected header members these tests read. */
interface ProtectedHeader {
	typ?: string;
	alg?: string;
	jwk?: Record<string, unknown>;
}

/**
 * Reads a compact JWS's protected header, unverified.
 *
 * @param token - The compact token.
 */
function headerOf(token: string): ProtectedHeader {
	let [segment = ""] = token.split(".");
	return JSON.parse(new TextDecoder().decode(unwrap(Base64Url.decode(segment)))) as ProtectedHeader;
}

/**
 * Reads a compact JWT's claims, unverified.
 *
 * @param token - The compact token.
 */
function claimsOf(token: string): JWT.Payload {
	return JWT.decode(token).payload;
}

/**
 * A request carrying a proof in its `DPoP` header.
 *
 * @param proof - The header value.
 * @param method - The request method.
 * @param url - The request URL.
 */
function withProof(proof: string, method = "GET", url = RESOURCE): Request {
	return new Request(url, { method, headers: { dpop: proof } });
}

describe("proof", () => {
	test("signs a dpop+jwt carrying the public key and the request it was made for", async () => {
		let proof = await dpop.proof("post", `${TOKEN_ENDPOINT}?x=1#frag`);
		let header = headerOf(proof);
		let claims = claimsOf(proof);

		expect(header.typ).toBe("dpop+jwt");
		expect(header.alg).toBe("ES256");
		expect(header.jwk?.d).toBeUndefined();
		expect(claims.htm).toBe("POST");
		expect(claims.htu).toBe(TOKEN_ENDPOINT);
		expect(claims.jti).toEqual(expect.any(String));
		expect(claims.iat).toEqual(expect.any(Number));
		expect(claims.ath).toBeUndefined();
	});

	test("hashes the access token it travels beside into ath", async () => {
		let claims = claimsOf(await dpop.proof("GET", RESOURCE, { accessToken: "token-1" }));

		expect(claims.ath).toBe(await accessTokenHash("token-1"));
	});

	test("gives every proof its own jti", async () => {
		let first = claimsOf(await dpop.proof("GET", RESOURCE));
		let second = claimsOf(await dpop.proof("GET", RESOURCE));

		expect(first.jti).not.toBe(second.jti);
	});

	test("keeps its thumbprint across a stored round trip", async () => {
		let restored = await DPoP.import(dpop.serialized);

		expect(await restored.thumbprint()).toBe(await dpop.thumbprint());
	});
});

describe("fetch", () => {
	test("presents the access token under the DPoP scheme beside a bound proof", async () => {
		let seen: Request[] = [];
		server.use(
			http.get(RESOURCE, ({ request }) => {
				seen.push(request);
				return HttpResponse.json({ ok: true });
			}),
		);

		let response = await dpop.fetch(RESOURCE, { accessToken: "token-1" });

		expect(response.status).toBe(200);
		expect(seen[0]?.headers.get("authorization")).toBe("DPoP token-1");
		let claims = claimsOf(seen[0]?.headers.get("dpop") ?? "");
		expect(claims.ath).toBe(await accessTokenHash("token-1"));
	});

	test("retries a resource refusal naming use_dpop_nonce with the nonce it handed out", async () => {
		let key = await DPoP.generate();
		let proofs: string[] = [];
		server.use(
			http.get(RESOURCE, ({ request }) => {
				proofs.push(request.headers.get("dpop") ?? "");
				if (proofs.length === 1) {
					return new HttpResponse(null, {
						status: 401,
						headers: {
							"www-authenticate": `DPoP error="use_dpop_nonce", algs="ES256"`,
							"dpop-nonce": "nonce-1",
						},
					});
				}
				return HttpResponse.json({ ok: true });
			}),
		);

		let response = await key.fetch(RESOURCE, { accessToken: "token-1" });

		expect(response.status).toBe(200);
		expect(proofs).toHaveLength(2);
		expect(claimsOf(proofs[1] ?? "").nonce).toBe("nonce-1");
		expect(key.nonce(RESOURCE)).toBe("nonce-1");
	});

	test("retries a token endpoint refusal naming use_dpop_nonce in its body", async () => {
		let key = await DPoP.generate();
		let proofs: string[] = [];
		server.use(
			http.post(TOKEN_ENDPOINT, async ({ request }) => {
				proofs.push(request.headers.get("dpop") ?? "");
				expect(await request.text()).toBe("grant_type=client_credentials");
				if (proofs.length === 1) {
					return HttpResponse.json(
						{ error: "use_dpop_nonce" },
						{ status: 400, headers: { "dpop-nonce": "nonce-2" } },
					);
				}
				return HttpResponse.json({ access_token: "a", token_type: "DPoP" });
			}),
		);

		let response = await key.fetch(TOKEN_ENDPOINT, {
			method: "POST",
			body: new URLSearchParams({ grant_type: "client_credentials" }),
		});

		expect(response.status).toBe(200);
		expect(claimsOf(proofs[1] ?? "").nonce).toBe("nonce-2");
	});

	test("answers another refusal readable and unretried", async () => {
		let key = await DPoP.generate();
		let calls = 0;
		server.use(
			http.post(TOKEN_ENDPOINT, () => {
				calls += 1;
				return HttpResponse.json(
					{ error: "invalid_grant" },
					{ status: 400, headers: { "dpop-nonce": "nonce-3" } },
				);
			}),
		);

		let response = await key.fetch(TOKEN_ENDPOINT, { method: "POST", body: "" });

		expect(calls).toBe(1);
		expect(await response.json()).toEqual({ error: "invalid_grant" });
	});

	test("carries a remembered nonce on the next proof to the same server", async () => {
		let key = await DPoP.generate();
		let proofs: string[] = [];
		server.use(
			http.get(RESOURCE, ({ request }) => {
				proofs.push(request.headers.get("dpop") ?? "");
				return HttpResponse.json({}, { headers: { "dpop-nonce": `nonce-${proofs.length}` } });
			}),
		);

		await key.fetch(RESOURCE);
		await key.fetch(RESOURCE);

		expect(claimsOf(proofs[0] ?? "").nonce).toBeUndefined();
		expect(claimsOf(proofs[1] ?? "").nonce).toBe("nonce-1");
	});
});

describe("verifyProof", () => {
	test("accepts a fresh proof and answers its key's thumbprint", async () => {
		let result = await verifyProof(withProof(await dpop.proof("GET", RESOURCE)), { replay });

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.jkt).toBe(await dpop.thumbprint());
			expect(result.data.proof).toBeInstanceOf(DPoPProof);
		}
	});

	test("ignores the request's query when comparing htu", async () => {
		let proof = await dpop.proof("GET", RESOURCE);
		let result = await verifyProof(withProof(proof, "GET", `${RESOURCE}?page=2`), { replay });

		expect(isSuccess(result)).toBe(true);
	});

	/**
	 * The code a failed verification carries.
	 *
	 * @param request - The request to verify.
	 * @param options - Everything beside the replay store.
	 */
	async function codeOf(
		request: Request,
		options: Omit<DPoP.VerifyOptions, "replay"> = {},
	): Promise<string | null> {
		let result = await verifyProof(request, { replay, ...options });
		return isFailure(result) ? result.error.code : null;
	}

	test("refuses a request with no proof", async () => {
		expect(await codeOf(new Request(RESOURCE))).toBe(AuthErrorCode.InvalidDPoPProof);
	});

	test("refuses a request carrying two proofs", async () => {
		let proof = await dpop.proof("GET", RESOURCE);
		let request = new Request(RESOURCE, {
			headers: [
				["dpop", proof],
				["dpop", proof],
			],
		});

		expect(await codeOf(request)).toBe(AuthErrorCode.InvalidDPoPProof);
	});

	test("refuses a proof made for another method", async () => {
		let proof = await dpop.proof("POST", RESOURCE);

		expect(await codeOf(withProof(proof, "GET"))).toBe(AuthErrorCode.InvalidDPoPProof);
	});

	test("refuses a proof made for another URI", async () => {
		let proof = await dpop.proof("GET", "https://api.test/other");

		expect(await codeOf(withProof(proof))).toBe(AuthErrorCode.InvalidDPoPProof);
	});

	test("refuses a proof issued longer ago than the window", async () => {
		let proof = await dpop.proof("GET", RESOURCE);
		let later = new Date(Date.now() + 400_000);

		expect(await codeOf(withProof(proof), { now: later })).toBe(AuthErrorCode.InvalidDPoPProof);
	});

	test("refuses a proof issued in the future", async () => {
		let proof = await dpop.proof("GET", RESOURCE);
		let earlier = new Date(Date.now() - 120_000);

		expect(await codeOf(withProof(proof), { now: earlier })).toBe(AuthErrorCode.InvalidDPoPProof);
	});

	test("refuses a proof presented a second time", async () => {
		let proof = await dpop.proof("GET", RESOURCE);

		expect(await codeOf(withProof(proof))).toBeNull();
		expect(await codeOf(withProof(proof))).toBe(AuthErrorCode.InvalidDPoPProof);
	});

	test("refuses a proof bound to another access token", async () => {
		let proof = await dpop.proof("GET", RESOURCE, { accessToken: "token-1" });

		expect(await codeOf(withProof(proof), { accessToken: "token-2" })).toBe(
			AuthErrorCode.InvalidDPoPProof,
		);
		expect(
			await codeOf(withProof(await dpop.proof("GET", RESOURCE)), { accessToken: "token-2" }),
		).toBe(AuthErrorCode.InvalidDPoPProof);
	});

	test("accepts a proof bound to the access token presented", async () => {
		let proof = await dpop.proof("GET", RESOURCE, { accessToken: "token-1" });

		expect(await codeOf(withProof(proof), { accessToken: "token-1" })).toBeNull();
	});

	test("asks for the server's nonce when the proof lacks it", async () => {
		let required = { nonce: (nonce: string | null) => nonce === "nonce-1" };

		expect(await codeOf(withProof(await dpop.proof("GET", RESOURCE)), required)).toBe(
			AuthErrorCode.UseDPoPNonce,
		);
		expect(
			await codeOf(withProof(await dpop.proof("GET", RESOURCE, { nonce: "nonce-1" })), required),
		).toBeNull();
	});

	test("refuses a token of another type signed with an embedded key", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let token = await new JWT({
			jti: "1",
			htm: "GET",
			htu: RESOURCE,
			iat: Math.floor(Date.now() / 1000),
		}).signEmbedded(pair);

		expect(await codeOf(withProof(token))).toBe(AuthErrorCode.InvalidDPoPProof);
	});

	test("refuses a proof missing a required claim", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let proof = await new DPoPProof({ htm: "GET", htu: RESOURCE, iat: "0s" }).signEmbedded(pair);

		expect(await codeOf(withProof(proof))).toBe(AuthErrorCode.InvalidDPoPProof);
	});
});
