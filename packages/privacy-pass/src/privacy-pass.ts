/**
 * The origin side of Privacy Pass in one configured object: it writes the
 * `WWW-Authenticate: PrivateToken` challenge a client answers, and redeems the token the
 * client sends back by checking the issuer's signature, the challenge and double spending.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { Hex, randomBytes, sha256 } from "@sdxc/crypto";
import { toSeconds } from "@sdxc/duration";
import { failure, isFailure, success } from "@sdxc/result";

import type { IssuerKey } from "./blind-rsa.js";
import type { TokenChallenge } from "./challenge.js";
import type { IssuerKeySource } from "./directory.js";
import type { RedemptionStore } from "./store.js";

import { verifyToken } from "./blind-rsa.js";
import { encodeTokenChallenge, formatChallenge } from "./challenge.js";
import { IssuerDirectory } from "./directory.js";
import { PrivacyPassError } from "./errors.js";
import { BLIND_RSA_TOKEN_TYPE, parseAuthorization } from "./token.js";

/** The bytes of a fresh redemption context, the only non-empty length RFC 9577 allows. */
const CONTEXT_BYTES = 32;

/**
 * Challenges clients for Blind RSA tokens from one issuer and redeems them.
 *
 * With `redemptionContext: "fresh"` (the default) every challenge carries 32 random bytes
 * and is remembered until `maxAge`, so a token answers one challenge once. With `"empty"`
 * the challenge never changes, a client may spend a cached token, and each nonce is kept.
 *
 * @example
 * let privacyPass = new PrivacyPass({ issuer: "demo-pat.issuer.cloudflare.com", store });
 * let redeemed = await privacyPass.redeem(request.headers.get("Authorization"));
 */
export class PrivacyPass {
	/** The issuer's server name, the challenge's `issuer_name`. */
	readonly issuer: string;

	#keys: IssuerKeySource;
	#store: RedemptionStore;
	#originInfo: readonly string[];
	#fresh: boolean;
	#maxAge: number;
	#nonceTtl: number;

	/** @param options - The issuer, the double-spend store and the challenge's shape */
	constructor(options: PrivacyPass.Options) {
		this.issuer = options.issuer;
		this.#keys = options.keys ?? new IssuerDirectory({ issuer: options.issuer });
		this.#store = options.store;
		this.#originInfo = options.originInfo ?? [];
		this.#fresh = (options.redemptionContext ?? "fresh") === "fresh";
		this.#maxAge = toSeconds(options.maxAge ?? "5 minutes");
		this.#nonceTtl = toSeconds(options.nonceTtl ?? "30 days");
	}

	/**
	 * Writes a challenge for a `WWW-Authenticate` header, offering the issuer's preferred key
	 * already in use. A fresh challenge is saved to the store before it is answered.
	 *
	 * @returns The header value, or `issuer-unavailable` when the issuer's keys cannot be read
	 * @example new Response("Token required", { status: 401, headers: { "WWW-Authenticate": header.data } })
	 */
	async challenge(): Promise<Result<string, PrivacyPassError>> {
		let keys = await this.#keys.keys();
		if (isFailure(keys)) return keys;
		let key = preferredKey(keys.data);
		if (key === undefined) {
			return failure(new PrivacyPassError("issuer-unavailable", "The issuer lists no key"));
		}

		let encoded = this.#encode(this.#fresh ? randomBytes(CONTEXT_BYTES) : new Uint8Array());
		if (isFailure(encoded)) return encoded;
		if (!this.#fresh)
			return success(formatChallenge({ challenge: encoded.data, tokenKey: key.tokenKey }));

		let digest = await digestHex(encoded.data);
		if (isFailure(digest)) return digest;
		await this.#store.saveChallenge(digest.data, this.#maxAge);
		return success(
			formatChallenge({ challenge: encoded.data, tokenKey: key.tokenKey, maxAge: this.#maxAge }),
		);
	}

	/**
	 * Redeems the token in `PrivateToken` credentials. The signature is checked before the
	 * store is touched, so a forged token can neither consume a challenge nor burn a nonce.
	 *
	 * @param authorization - The request's `Authorization` header value
	 * @returns The spent token's identifiers, or why it was refused: `missing-token`,
	 * `malformed-token`, `unsupported-token-type`, `unknown-key`, `invalid-signature`,
	 * `unknown-challenge` (not issued here, expired or already answered), `double-spend`, or
	 * `issuer-unavailable`
	 */
	async redeem(
		authorization: string | null,
	): Promise<Result<PrivacyPass.Redemption, PrivacyPassError>> {
		let token = parseAuthorization(authorization);
		if (isFailure(token)) return token;
		if (token.data.tokenType !== BLIND_RSA_TOKEN_TYPE) {
			return failure(
				new PrivacyPassError(
					"unsupported-token-type",
					`Token type ${token.data.tokenType} is not accepted here`,
				),
			);
		}

		let keys = await this.#keys.keys();
		if (isFailure(keys)) return keys;
		let keyId = Hex.encode(token.data.tokenKeyId);
		let key = keys.data.find((candidate) => Hex.encode(candidate.tokenKeyId) === keyId);
		if (key === undefined) {
			return failure(new PrivacyPassError("unknown-key", "The token names no key of this issuer"));
		}

		let verified = await verifyToken(token.data, key);
		if (isFailure(verified)) return verified;

		let digest = Hex.encode(token.data.challengeDigest);
		let nonce = Hex.encode(token.data.nonce);
		let known = this.#fresh
			? await this.#store.takeChallenge(digest)
			: digest === (await this.#sharedDigest());
		if (!known) {
			return failure(
				new PrivacyPassError("unknown-challenge", "The token answers no challenge of this origin"),
			);
		}
		if (!this.#fresh && !(await this.#store.spendNonce(nonce, this.#nonceTtl))) {
			return failure(new PrivacyPassError("double-spend", "The token was already spent"));
		}

		return success({ tokenType: BLIND_RSA_TOKEN_TYPE, nonce, tokenKeyId: keyId });
	}

	/**
	 * The digest every token answers when the redemption context is empty.
	 *
	 * @returns The hex digest, or an empty string when the challenge cannot be encoded
	 */
	async #sharedDigest(): Promise<string> {
		let encoded = this.#encode(new Uint8Array());
		if (isFailure(encoded)) return "";
		let digest = await digestHex(encoded.data);
		return isFailure(digest) ? "" : digest.data;
	}

	/**
	 * Encodes this origin's challenge with a redemption context.
	 *
	 * @param redemptionContext - Empty, or 32 fresh bytes
	 * @returns The encoded TokenChallenge, or `invalid-challenge` for a misconfigured name
	 */
	#encode(redemptionContext: Uint8Array) {
		let challenge: TokenChallenge = {
			tokenType: BLIND_RSA_TOKEN_TYPE,
			issuerName: this.issuer,
			redemptionContext,
			originInfo: this.#originInfo,
		};
		return encodeTokenChallenge(challenge);
	}
}

/** The options a {@link PrivacyPass} is built with, and what a redemption answers. */
export namespace PrivacyPass {
	/** Configuration for one issuer's challenges. */
	export interface Options {
		/** The issuer's server name, such as `demo-pat.issuer.cloudflare.com`. */
		issuer: string;
		/** Remembers fresh challenges and spent nonces. */
		store: RedemptionStore;
		/**
		 * Where the issuer's keys come from.
		 *
		 * @default an `IssuerDirectory` for `issuer`
		 */
		keys?: IssuerKeySource;
		/**
		 * The origins a token may be spent at, this one included; empty accepts cross-origin
		 * tokens a client may already hold.
		 *
		 * @default []
		 */
		originInfo?: readonly string[];
		/**
		 * `"fresh"` binds every token to one challenge; `"empty"` lets a client spend cached
		 * tokens and keeps every nonce for `nonceTtl` instead.
		 *
		 * @default "fresh"
		 */
		redemptionContext?: "fresh" | "empty";
		/**
		 * How long a fresh challenge is accepted, sent as `max-age`.
		 *
		 * @default "5 minutes"
		 */
		maxAge?: DurationInput;
		/**
		 * How long a spent nonce is kept under `"empty"`; keep it at least as long as the
		 * issuer keeps a key, since a token stays valid until its key is retired.
		 *
		 * @default "30 days"
		 */
		nonceTtl?: DurationInput;
	}

	/** A redeemed token. */
	export interface Redemption {
		tokenType: typeof BLIND_RSA_TOKEN_TYPE;
		/** The token's nonce in hex, unique to this token. */
		nonce: string;
		/** The hex id of the issuer key that signed it. */
		tokenKeyId: string;
	}
}

/**
 * The key a client should request its token under: the first one already in use, as
 * RFC 9578 §4 orders them, or the first listed when every key is scheduled.
 *
 * @param keys - The issuer's keys, most preferred first
 * @returns The key, or `undefined` for an empty list
 */
function preferredKey(keys: readonly IssuerKey[]): IssuerKey | undefined {
	let now = Date.now();
	return keys.find((key) => key.notBefore === null || key.notBefore.getTime() <= now) ?? keys[0];
}

/**
 * The hex `SHA-256` of an encoded challenge, the form the store keys on.
 *
 * @param challenge - The encoded TokenChallenge
 * @returns The digest
 */
async function digestHex(challenge: Uint8Array): Promise<Result<string, PrivacyPassError>> {
	let digest = await sha256(challenge);
	if (isFailure(digest)) {
		return failure(
			new PrivacyPassError("invalid-challenge", "The challenge could not be hashed", {
				cause: digest.error,
			}),
		);
	}
	return success(Hex.encode(digest.data));
}
