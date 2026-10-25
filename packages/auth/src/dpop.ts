/**
 * RFC 9449 DPoP, both ends of it: the client's key, which signs one proof per request and
 * remembers the nonces servers hand out, and the check a token endpoint or an API runs on
 * a presented proof, so a stolen access or refresh token is useless without the key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64Url, sha256 } from "@sdxc/crypto";
import { JWK, JWT } from "@sdxc/jwt";
import { failure, isFailure, success, unwrap, wrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";

import { AuthError, AuthErrorCode } from "./auth-error.js";
import { parseDPoP } from "./bearer-challenge.js";

/** The JWS algorithms a proof is accepted under, all asymmetric as RFC 9449 §4.2 requires. */
export const DPOP_ALGORITHMS: readonly string[] = [
	JWK.Algorithm.ES256,
	JWK.Algorithm.Ed25519,
	JWK.Algorithm.RS256,
];

/** The header a proof travels in, and the one a server's nonce comes back in. */
const PROOF_HEADER = "dpop";

/** The response header a server hands its next nonce out in (RFC 9449 §8). */
const NONCE_HEADER = "dpop-nonce";

/** How old a proof's `iat` may be when no window is configured, in seconds. */
const DEFAULT_MAX_AGE_SECONDS = 300;

/** How far a proof's `iat` may sit in the future, or past its window, for clock skew. */
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 60;

/** Milliseconds in a second, the factor between `iat` and a `Date`. */
const MS_PER_SECOND = 1000;

/** The status a token endpoint refuses with, carrying `use_dpop_nonce` in its JSON body. */
const BAD_REQUEST = 400;

/** The status a protected resource refuses with, carrying `use_dpop_nonce` in its challenge. */
const UNAUTHORIZED = 401;

/** The error code both refusals name when the proof must carry the server's nonce. */
const USE_DPOP_NONCE = "use_dpop_nonce";

/**
 * A DPoP proof's claims (RFC 9449 §4.2), typed `dpop+jwt` so a token of another kind never
 * verifies as a proof.
 */
export class DPoPProof extends JWT {
	static override type = "dpop+jwt";

	/** The HTTP method the proof was made for, from `htm`. */
	get method(): string | null {
		return this.parser.has("htm") ? this.parser.string("htm") : null;
	}

	/** The request URI the proof was made for, without query or fragment, from `htu`. */
	get uri(): string | null {
		return this.parser.has("htu") ? this.parser.string("htu") : null;
	}

	/** The hash of the access token the proof was made beside, from `ath`. */
	get accessTokenHash(): string | null {
		return this.parser.has("ath") ? this.parser.string("ath") : null;
	}

	/** The server-provided nonce the proof carries. */
	get nonce(): string | null {
		return this.parser.has("nonce") ? this.parser.string("nonce") : null;
	}
}

/**
 * The `ath` a proof sent beside an access token carries: the base64url SHA-256 of the
 * token's ASCII text (RFC 9449 §4.2).
 *
 * @param accessToken - The access token as presented.
 * @example
 * let ath = await accessTokenHash(token);
 */
export async function accessTokenHash(accessToken: string): Promise<string> {
	return Base64Url.encode(unwrap(await sha256(accessToken)));
}

/**
 * The `htu` a request is held to: its URI with the query and fragment removed, normalized
 * the way `URL` serializes it so equivalent spellings compare equal.
 *
 * @param url - The request URI.
 */
function targetUri(url: URL | string): string {
	let target = new URL(url);
	target.search = "";
	target.hash = "";
	return target.href;
}

/**
 * An `invalid_dpop_proof` failure.
 *
 * @param message - Why the proof was refused, for an operator reading a log.
 * @param cause - The underlying error.
 */
function invalidProof(message: string, cause?: unknown): AuthError {
	return new AuthError(message, { code: AuthErrorCode.InvalidDPoPProof, cause });
}

/**
 * Whether a refusal asks the client to retry its proof with the nonce the server just
 * handed out, answering the response itself too: a token endpoint's body has to be read
 * to tell, so the caller gets an unread copy back.
 *
 * @param response - The refusal.
 */
async function asksForNonce(response: Response): Promise<[boolean, Response]> {
	if (response.status === UNAUTHORIZED) {
		let challenges = parseDPoP(response.headers.get("www-authenticate") ?? "");
		if (isFailure(challenges)) return [false, response];
		return [challenges.data.some((challenge) => challenge.error === USE_DPOP_NONCE), response];
	}

	if (response.status !== BAD_REQUEST) return [false, response];

	let text = await response.text();
	let copy = new Response(text, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});

	let document = wrap(() => JSON.parse(text) as unknown);
	if (isFailure(document)) return [false, copy];

	let body = document.data;
	let error = typeof body === "object" && body !== null && "error" in body ? body.error : null;
	return [error === USE_DPOP_NONCE, copy];
}

/**
 * The key a client proves possession of. It signs one proof per request, remembers the
 * nonce each server last handed out, and retries a request once when a server refuses it
 * with `use_dpop_nonce`. Store `serialized` to keep using the key a token is bound to.
 *
 * @example
 * let dpop = await DPoP.generate();
 * let response = await dpop.fetch("https://api.example.com/reports", { accessToken });
 * @example
 * let dpop = await DPoP.import(JSON.parse(env.DPOP_KEY));
 */
export class DPoP {
	/**
	 * Generates a fresh key.
	 *
	 * @param algorithm - The algorithm proofs are signed with.
	 * @returns The key, ready to sign; `serialized` is what to store.
	 */
	static async generate(algorithm: JWK.Algorithm = JWK.Algorithm.ES256): Promise<DPoP> {
		return await DPoP.import(await JWK.generateKeyPair(algorithm));
	}

	/**
	 * Imports a key stored from `serialized`, so the key a token is bound to keeps signing.
	 *
	 * @param serialized - The stored key pair.
	 */
	static async import(serialized: JWK.SerializedKeyPair): Promise<DPoP> {
		return new DPoP(serialized, await JWK.importKeyPair(serialized));
	}

	#serialized: JWK.SerializedKeyPair;
	#keyPair: JWK.KeyPair;
	#nonces = new Map<string, string>();

	/**
	 * Wraps an imported key; `generate` and `import` are the way in.
	 *
	 * @param serialized - The key pair as stored.
	 * @param keyPair - The same pair, imported.
	 */
	private constructor(serialized: JWK.SerializedKeyPair, keyPair: JWK.KeyPair) {
		this.#serialized = serialized;
		this.#keyPair = keyPair;
	}

	/** The key pair in the form it is stored in, private half included. */
	get serialized(): JWK.SerializedKeyPair {
		return this.#serialized;
	}

	/** The algorithm proofs are signed with. */
	get algorithm(): string {
		return this.#keyPair.alg;
	}

	/**
	 * The RFC 7638 thumbprint a bound token names as `cnf.jkt`, and an authorization
	 * request as `dpop_jkt`.
	 */
	async thumbprint(): Promise<string> {
		return unwrap(await JWK.thumbprint(this.#keyPair.jwk));
	}

	/**
	 * The nonce a server last handed this key, keyed by the server's origin.
	 *
	 * @param url - Any URL on the server.
	 */
	nonce(url: URL | string): string | null {
		return this.#nonces.get(new URL(url).origin) ?? null;
	}

	/**
	 * Records the nonce a response hands out, so the next proof for that server carries it.
	 *
	 * @param url - The URL the response came from.
	 * @param response - The response, read for `DPoP-Nonce`.
	 */
	remember(url: URL | string, response: Response): void {
		let nonce = response.headers.get(NONCE_HEADER);
		if (nonce) this.#nonces.set(new URL(url).origin, nonce);
	}

	/**
	 * Signs a proof for one request.
	 *
	 * @param method - The request's HTTP method.
	 * @param url - The request's URI; its query and fragment are left out of `htu`.
	 * @param options - The access token the proof travels beside, and a nonce to carry in
	 *   place of the one remembered for the server.
	 * @returns The compact proof for the `DPoP` header.
	 * @example
	 * let proof = await dpop.proof("POST", tokenEndpoint);
	 */
	async proof(method: string, url: URL | string, options: DPoP.ProofOptions = {}): Promise<string> {
		let claims: JWT.Payload = {
			jti: generateUUID(),
			htm: method.toUpperCase(),
			htu: targetUri(url),
			iat: Math.floor(Date.now() / MS_PER_SECOND),
		};

		let nonce = options.nonce ?? this.nonce(url);
		if (nonce !== null) claims.nonce = nonce;
		if (options.accessToken !== undefined) {
			claims.ath = await accessTokenHash(options.accessToken);
		}

		return await new DPoPProof(claims).signEmbedded(this.#keyPair);
	}

	/**
	 * Sends a request with a fresh proof, and an `Authorization: DPoP` header when an
	 * access token is given. A refusal naming `use_dpop_nonce` alongside a new nonce is
	 * retried once with a proof carrying it; the body must be one `fetch` can send twice.
	 *
	 * @param input - The request URL.
	 * @param init - What `fetch` takes, plus the access token to present.
	 * @returns The response to the last attempt.
	 * @example
	 * let response = await dpop.fetch(tokenEndpoint, { method: "POST", body });
	 * @example
	 * let response = await dpop.fetch("https://api.example.com/reports", { accessToken });
	 */
	async fetch(input: URL | string, init: DPoP.RequestInit = {}): Promise<Response> {
		let { accessToken, ...rest } = init;
		let url = new URL(input);
		let method = (rest.method ?? "GET").toUpperCase();

		let send = async () => {
			let headers = new Headers(rest.headers);
			headers.set(PROOF_HEADER, await this.proof(method, url, { accessToken }));
			if (accessToken !== undefined) headers.set("authorization", `DPoP ${accessToken}`);

			let response = await fetch(url, { ...rest, method, headers });
			this.remember(url, response);
			return response;
		};

		let before = this.nonce(url);
		let first = await send();

		let after = this.nonce(url);
		if (after === null || after === before) return first;

		let [retry, response] = await asksForNonce(first);
		if (!retry) return response;

		return await send();
	}
}

/**
 * Checks the proof a request carries (RFC 9449 §4.3): a single `DPoP` header holding a
 * `dpop+jwt` signed under the public key it embeds, made for this method and URI, recent,
 * carrying the server's nonce when one is required, bound to the access token when one is
 * presented, and never seen before.
 *
 * @param request - The request, read for its method, URL and `DPoP` header.
 * @param options - The replay store, the access token presented beside the proof, and
 *   the server's nonce and freshness rules.
 * @returns The proof and the thumbprint of its key; `invalid_dpop_proof` for a proof
 *   failing a check, `use_dpop_nonce` for one missing the nonce the server requires.
 * @example
 * let verified = await verifyProof(request, { replay, accessToken });
 * if (isFailure(verified)) return refuse(verified.error);
 * if (verified.data.jkt !== token.jkt) return refuse();
 */
export async function verifyProof(
	request: Request,
	options: DPoP.VerifyOptions,
): Promise<Result<DPoP.VerifiedProof, AuthError>> {
	let header = request.headers.get(PROOF_HEADER);
	if (header === null) return failure(invalidProof("The request carries no DPoP proof."));
	if (header.includes(","))
		return failure(invalidProof("The request carries several DPoP proofs."));

	let maxAge = options.maxAge ?? DEFAULT_MAX_AGE_SECONDS;
	let tolerance = options.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE_SECONDS;

	let verified = await wrap(() =>
		DPoPProof.verifyEmbedded(header, { algorithms: [...(options.algorithms ?? DPOP_ALGORITHMS)] }),
	);
	if (isFailure(verified))
		return failure(invalidProof("The DPoP proof did not verify.", verified.error));

	let { token: proof, jwk } = verified.data;
	let id = proof.id;
	let issuedAt = proof.issuedAt;

	if (id === null || issuedAt === null || proof.method === null || proof.uri === null) {
		return failure(invalidProof("The DPoP proof is missing jti, htm, htu or iat."));
	}

	if (proof.method !== request.method.toUpperCase()) {
		return failure(invalidProof("The DPoP proof was made for another HTTP method."));
	}

	if (!URL.canParse(proof.uri) || targetUri(proof.uri) !== targetUri(options.url ?? request.url)) {
		return failure(invalidProof("The DPoP proof was made for another URI."));
	}

	let now = (options.now ?? new Date()).getTime();
	let age = (now - issuedAt.getTime()) / MS_PER_SECOND;
	if (age > maxAge + tolerance || age < -tolerance) {
		return failure(invalidProof("The DPoP proof is too old or issued in the future."));
	}

	if (options.nonce !== undefined && !(await options.nonce(proof.nonce))) {
		return failure(
			new AuthError("The DPoP proof must carry the server's current nonce.", {
				code: AuthErrorCode.UseDPoPNonce,
			}),
		);
	}

	if (options.accessToken !== undefined) {
		let expected = await accessTokenHash(options.accessToken);
		if (proof.accessTokenHash !== expected) {
			return failure(invalidProof("The DPoP proof is bound to another access token."));
		}
	}

	let jkt = await JWK.thumbprint(jwk);
	if (isFailure(jkt))
		return failure(invalidProof("The DPoP proof's key has no thumbprint.", jkt.error));

	let expiresAt = new Date(issuedAt.getTime() + (maxAge + tolerance) * MS_PER_SECOND);
	let fresh = await options.replay.claim(`${jkt.data}:${id}`, expiresAt);
	if (!fresh) return failure(invalidProof("The DPoP proof was already used."));

	return success({ proof, jkt: jkt.data });
}

export namespace DPoP {
	/** What one proof is made beside. */
	export interface ProofOptions {
		/** The access token the request presents, hashed into `ath`. */
		accessToken?: string;
		/** A nonce to carry in place of the one remembered for the server. */
		nonce?: string;
	}

	/** What `fetch` takes, plus the access token to present as `Authorization: DPoP`. */
	export interface RequestInit extends globalThis.RequestInit {
		accessToken?: string;
	}

	/**
	 * Where a server records the proofs it accepted, so each is accepted once (RFC 9449
	 * §11.1). It is shared by every instance verifying for the same server.
	 */
	export interface ReplayStore {
		/**
		 * Records a proof, answering whether it was new.
		 *
		 * @param key - The proof's key thumbprint and `jti`, together.
		 * @param expiresAt - When the proof stops being acceptable, and the record with it.
		 * @returns `true` the first time a key is claimed before it expires, `false` after.
		 */
		claim(key: string, expiresAt: Date): Promise<boolean>;
	}

	/** How {@link verifyProof} checks a proof. */
	export interface VerifyOptions {
		/** Where accepted proofs are recorded. */
		replay: ReplayStore;
		/** The access token the request presents, which the proof's `ath` must hash. */
		accessToken?: string;
		/**
		 * The URI the proof must name, for a server reached behind a proxy that rewrites it.
		 *
		 * @default the request's URL
		 */
		url?: URL | string;
		/**
		 * The algorithms a proof may be signed with.
		 *
		 * @default DPOP_ALGORITHMS
		 */
		algorithms?: readonly string[];
		/**
		 * How old a proof may be, in seconds.
		 *
		 * @default 300
		 */
		maxAge?: number;
		/**
		 * The clock skew allowed on either side of the window, in seconds.
		 *
		 * @default 60
		 */
		clockTolerance?: number;
		/**
		 * Whether a proof's `nonce` is one the server handed out and still accepts; a
		 * server requiring none leaves it unset.
		 */
		nonce?: (nonce: string | null) => boolean | Promise<boolean>;
		/** The instant freshness is measured against. */
		now?: Date;
	}

	/** A proof that passed every check, and the thumbprint a bound token must name. */
	export interface VerifiedProof {
		proof: DPoPProof;
		/** The RFC 7638 thumbprint of the proof's key, compared with `cnf.jkt`. */
		jkt: string;
	}
}
