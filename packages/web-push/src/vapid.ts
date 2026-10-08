/**
 * The RFC 8292 sender identity: a P-256 pair and a contact URI, checked once, and the
 * `vapid t=…, k=…` credential signed per push service origin. A token is reused until an
 * hour before its 12-hour expiry, so delivering to many devices on one service signs once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64Url } from "@sdxc/crypto";
import { JWK, JWT } from "@sdxc/jwt";
import { failure, isFailure, success } from "@sdxc/result";

import { WebPushError } from "./error.js";
import { decodeBase64Url, decodePoint, P256_COORDINATE_LENGTH } from "./keys.js";

/** How long a token stays valid, inside the 24 hours RFC 8292 allows. */
const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;

/** How long before its expiry a cached token is replaced, so none arrives nearly expired. */
const TOKEN_REFRESH_MARGIN_MS = 60 * 60 * 1000;

/** Milliseconds in a second, for the epoch seconds `exp` is written in. */
const SECOND_MS = 1000;

/** Identifier written as the token's `kid`. */
const KEY_ID = "vapid";

/** A P-256 pair in the base64url form an environment stores it in. */
export interface VapidKeyPair {
	/** The uncompressed 65-byte point, base64url: the browser's `applicationServerKey`. */
	publicKey: string;
	/** The 32-byte private scalar, base64url. */
	privateKey: string;
}

/** The identity a push service authenticates a sender by. */
export interface VapidKeys extends VapidKeyPair {
	/**
	 * A `mailto:` or `https:` URI a push service contacts about a misbehaving sender.
	 * Apple's service refuses one it cannot use, so name a real address.
	 */
	subject: string;
}

/** A signed credential and the instant it stops being reused. */
interface CachedToken {
	authorization: string;
	refreshAt: number;
}

/**
 * Imports and checks a pair: the public key must be a point on the curve, the private
 * key a 32-byte scalar, the subject a `mailto:` or `https:` URI, and a signature by the
 * private half must verify under the public half.
 *
 * @param keys - The identity as configured.
 * @returns The signing key, or `invalid-vapid` naming the first rule that failed.
 */
async function importSigningKey(keys: VapidKeys): Promise<Result<CryptoKey, WebPushError>> {
	let refuse = (why: string, cause?: unknown) =>
		failure(
			new WebPushError(`Refused the VAPID identity: ${why}`, { code: "invalid-vapid", cause }),
		);

	if (!/^(?:mailto:.+|https:\/\/.+)/u.test(keys.subject)) {
		return refuse("subject is not a mailto: or https: URI");
	}

	let point = decodePoint(keys.publicKey);
	if (point === null) return refuse("publicKey is not an uncompressed P-256 point");

	let scalar = decodeBase64Url(keys.privateKey);
	if (scalar === null || scalar.length !== P256_COORDINATE_LENGTH) {
		return refuse("privateKey is not a 32-byte P-256 scalar");
	}

	try {
		let x = Base64Url.encode(point.subarray(1, 1 + P256_COORDINATE_LENGTH));
		let y = Base64Url.encode(point.subarray(1 + P256_COORDINATE_LENGTH));
		let algorithm = { name: "ECDSA", namedCurve: "P-256" };

		let signing = await crypto.subtle.importKey(
			"jwk",
			{ kty: "EC", crv: "P-256", d: Base64Url.encode(scalar), x, y },
			algorithm,
			false,
			["sign"],
		);
		let verifying = await crypto.subtle.importKey("raw", point, algorithm, false, ["verify"]);

		let probe = new TextEncoder().encode("vapid pair check");
		let hash = { name: "ECDSA", hash: "SHA-256" };
		let signature = await crypto.subtle.sign(hash, signing, probe);
		if (!(await crypto.subtle.verify(hash, verifying, signature, probe))) {
			return refuse("privateKey and publicKey are not one pair");
		}

		return success(signing);
	} catch (error) {
		return refuse("the keys do not import", error);
	}
}

/**
 * One configured identity: its key imported on first use and checked once, and one
 * cached credential per push service origin.
 */
export class Vapid {
	readonly keys: VapidKeys;

	#signingKey: Promise<Result<CryptoKey, WebPushError>> | null = null;
	#tokens = new Map<string, CachedToken>();

	/** @param keys - The identity as configured. */
	constructor(keys: VapidKeys) {
		this.keys = keys;
	}

	/**
	 * The `Authorization` value for one push service origin, signed now or reused while
	 * more than an hour of its lifetime is left.
	 *
	 * @param origin - The endpoint's origin, which is the token's audience.
	 * @returns The credential, or `invalid-vapid` when the identity is unusable.
	 */
	async authorization(origin: string): Promise<Result<string, WebPushError>> {
		let now = Date.now();
		let cached = this.#tokens.get(origin);
		if (cached && cached.refreshAt > now) return success(cached.authorization);

		this.#signingKey ??= importSigningKey(this.keys);
		let key = await this.#signingKey;
		if (isFailure(key)) return key;

		let token = new JWT({
			aud: origin,
			exp: Math.floor((now + TOKEN_LIFETIME_MS) / SECOND_MS),
			sub: this.keys.subject,
		});

		let signed = await token.sign(JWK.Algorithm.ES256, [
			{ id: KEY_ID, alg: JWK.Algorithm.ES256, private: key.data },
		]);

		let authorization = `vapid t=${signed}, k=${this.keys.publicKey.replace(/=+$/u, "")}`;
		this.#tokens.set(origin, {
			authorization,
			refreshAt: now + TOKEN_LIFETIME_MS - TOKEN_REFRESH_MARGIN_MS,
		});

		return success(authorization);
	}
}

/**
 * Generates a fresh identity's pair: the public point a page hands the browser, and the
 * private scalar the sender keeps secret.
 *
 * @returns The pair, base64url.
 */
export async function generateKeyPair(): Promise<VapidKeyPair> {
	let pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
		"sign",
		"verify",
	]);

	let publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
	let jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

	return { publicKey: Base64Url.encode(publicKey), privateKey: jwk.d ?? "" };
}
