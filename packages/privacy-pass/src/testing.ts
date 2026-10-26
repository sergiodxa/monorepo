/**
 * A test issuer: a fresh RSA-PSS key published in the `id-RSASSA-PSS` encoding an issuer
 * directory serves, its directory document, an origin trusting it, and a client that answers
 * a challenge with a token signed by it, so an origin's tests redeem tokens it challenged for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";

import { Base64Url, Hex, concatBytes, randomBytes, sha256 } from "@sdxc/crypto";
import { success, unwrap } from "@sdxc/result";

import type { Token } from "./token.js";

import { importTokenKey } from "./blind-rsa.js";
import { toPaddedBase64Url } from "./lib/wire.js";
import { PrivacyPass } from "./privacy-pass.js";
import { MemoryRedemptionStore } from "./store.js";
import { BLIND_RSA_TOKEN_TYPE, encodeToken, tokenAuthenticatorInput } from "./token.js";

/** The `id-RSASSA-PSS` AlgorithmIdentifier RFC 9578 issuers publish, as in its test vectors. */
const PSS_ALGORITHM =
	"303d06092a864886f70d01010a3030a00d300b0609608648016503040202a11a301806092a864886f70d010108300b0609608648016503040202a203020130";

/** The header and `rsaEncryption` AlgorithmIdentifier Web Crypto writes before the key bits. */
const RSA_ENCRYPTION_PREFIX_BYTES = 4 + 15;

/** An issuer key pair and its published encoding; `tokenKeyId` is the key's SHA-256. */
export interface TestIssuer {
	tokenKey: Bytes;
	tokenKeyId: Bytes;
	privateKey: CryptoKey;
}

/**
 * Generates a 2048-bit issuer whose `tokenKey` imports like a real directory entry.
 *
 * @returns The issuer
 */
export async function createTestIssuer(): Promise<TestIssuer> {
	let pair = await crypto.subtle.generateKey(
		{
			name: "RSA-PSS",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-384",
		},
		true,
		["sign", "verify"],
	);
	let spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
	let tokenKey = concatBytes(
		new Uint8Array([0x30, 0x82, 0x01, 0x52]),
		unwrap(Hex.decode(PSS_ALGORITHM)),
		spki.subarray(RSA_ENCRYPTION_PREFIX_BYTES),
	);
	return { tokenKey, tokenKeyId: unwrap(await sha256(tokenKey)), privateKey: pair.privateKey };
}

/**
 * Answers a `WWW-Authenticate` challenge the way a client would after issuance: a random
 * nonce, the challenge's digest, and the issuer's signature over both.
 *
 * @param issuer - The issuer that signs
 * @param header - The `WWW-Authenticate` value
 * @returns The `Authorization` header value
 */
export async function answerChallenge(issuer: TestIssuer, header: string): Promise<string> {
	let encoded = /challenge="([^"]+)"/.exec(header)?.[1] ?? "";
	let challenge = unwrap(Base64Url.decode(encoded));
	let token = await signToken(issuer, {
		tokenType: BLIND_RSA_TOKEN_TYPE,
		nonce: randomBytes(32),
		challengeDigest: unwrap(await sha256(challenge)),
		tokenKeyId: issuer.tokenKeyId,
	});
	return `PrivateToken token="${toPaddedBase64Url(encodeToken(token))}"`;
}

/**
 * Signs a token's authenticator input as the issuer's finalized blind signature would.
 *
 * @param issuer - The issuer that signs
 * @param input - The token without its authenticator
 * @returns The complete token
 */
export async function signToken(
	issuer: TestIssuer,
	input: Omit<Token, "authenticator">,
): Promise<Token> {
	let signature = await crypto.subtle.sign(
		{ name: "RSA-PSS", saltLength: 48 },
		issuer.privateKey,
		tokenAuthenticatorInput(input),
	);
	return { ...input, authenticator: new Uint8Array(signature) };
}

/**
 * The token directory the issuer serves at `/.well-known/private-token-issuer-directory`, so
 * an MSW handler stands in for the issuer behind `IssuerDirectory`.
 *
 * @param issuer - The issuer whose key the directory lists
 * @returns The directory response, with the media type an issuer sends
 */
export function issuerDirectoryResponse(issuer: TestIssuer): Response {
	return Response.json(
		{
			"issuer-request-uri": "/token-request",
			"token-keys": [
				{ "token-type": BLIND_RSA_TOKEN_TYPE, "token-key": toPaddedBase64Url(issuer.tokenKey) },
			],
		},
		{ headers: { "content-type": "application/private-token-issuer-directory" } },
	);
}

/** An origin and the issuer whose tokens it accepts. */
export interface TestPrivacyPass {
	issuer: TestIssuer;
	privacyPass: PrivacyPass;
}

/**
 * Creates an origin that accepts tokens from a freshly generated issuer. Its keys are served
 * from memory and its redemptions kept in a `MemoryRedemptionStore`, so a test never reaches
 * an issuer's directory.
 *
 * @returns The origin, and the issuer a test signs tokens with
 */
export async function createTestPrivacyPass(): Promise<TestPrivacyPass> {
	let issuer = await createTestIssuer();
	let key = unwrap(await importTokenKey(issuer.tokenKey));
	let privacyPass = new PrivacyPass({
		issuer: "issuer.test",
		keys: { keys: async () => success([key]) },
		store: new MemoryRedemptionStore(),
	});
	return { issuer, privacyPass };
}

/**
 * Requests `url` the way a client holding tokens does: reads the challenge from the first
 * answer, signs a token for it, and repeats the request with the token.
 *
 * @param fetch - Sends a request to the app under test
 * @param issuer - The issuer that signs the token
 * @param url - The URL that challenges, such as a `redeemOrChallenge()` route
 * @returns The response to the request carrying the token
 */
export async function redeemThrough(
	fetch: (request: Request) => Promise<Response>,
	issuer: TestIssuer,
	url: string,
): Promise<Response> {
	let challenged = await fetch(new Request(url));
	let header = challenged.headers.get("WWW-Authenticate") ?? "";
	let authorization = await answerChallenge(issuer, header);
	return fetch(new Request(url, { headers: { Authorization: authorization } }));
}
