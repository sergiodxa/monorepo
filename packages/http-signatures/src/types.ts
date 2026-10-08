/**
 * The value model of HTTP message signatures: the schemes and algorithms, the members of
 * `Signature-Input`, `Accept-Signature` and the cavage `Signature`, and the options and
 * outcome of `sign` and `verify`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike } from "@sdxc/crypto";
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

/**
 * `rfc9421` writes `Signature-Input` and `Signature` with `Content-Digest`; `draft-cavage`
 * writes the single `Signature` header with `Digest`, which Mastodon before 4.5 requires.
 */
export type Scheme = "rfc9421" | "draft-cavage";

/** The RFC 9421 algorithms this package signs and verifies with Web Crypto. */
export type Algorithm = "rsa-v1_5-sha256" | "rsa-pss-sha512" | "ecdsa-p256-sha256" | "ed25519";

/**
 * Component parameters (RFC 9421 §6.5), kept in the order they were written because the
 * signature base serializes them in that order.
 */
export interface ComponentParameters {
	/** Re-serialize the field as a Structured Field. */
	sf?: boolean;
	/** Cover one member of a Dictionary field. */
	key?: string;
	/** Cover each field line as a Byte Sequence. */
	bs?: boolean;
	/** Cover a component of the request a response answers. */
	req?: boolean;
	/** Cover a trailer field. */
	tr?: boolean;
	/** The query parameter `@query-param` covers. */
	name?: string;
}

/**
 * One covered component: a lowercase field name such as `content-type`, or a derived
 * component such as `@method`.
 */
export interface Component {
	name: string;
	params?: ComponentParameters;
}

/** RFC 9421 signature parameters, kept in the order they were written. */
export interface SignatureParameters {
	/** Written as an Integer of whole seconds. */
	created?: Date;
	/** Written as an Integer of whole seconds. */
	expires?: Date;
	nonce?: string;
	alg?: string;
	keyid?: string;
	tag?: string;
}

/** One `Signature-Input` member: what a signature covers and its parameters. */
export interface SignatureInput {
	components: Component[];
	params: SignatureParameters;
}

/**
 * Parameters of an `Accept-Signature` member. `created` and `expires` carry no value there:
 * `true` asks the signer to include one.
 */
export interface AcceptSignatureParameters {
	created?: boolean;
	expires?: boolean;
	nonce?: string;
	alg?: string;
	keyid?: string;
	tag?: string;
}

/** One `Accept-Signature` member: the signature a server asks a client to send. */
export interface AcceptSignature {
	components: Component[];
	params: AcceptSignatureParameters;
}

/** A draft-cavage `Signature` header (or `Authorization: Signature …`) read into fields. */
export interface CavageSignature {
	keyId: string;
	/** `hs2019`, `rsa-sha256`, or `null` when the header names none. */
	algorithm: string | null;
	created: Date | null;
	expires: Date | null;
	/**
	 * Lowercase covered headers and pseudo-headers in order, or `null` when the header
	 * leaves `headers` out and the default applies.
	 */
	headers: string[] | null;
	signature: Uint8Array;
}

/** The key `sign` signs with. */
export interface SigningKey {
	/** Written as `keyid` (RFC 9421) or `keyId` (cavage); for ActivityPub, the actor's `#main-key`. */
	id: string;
	privateKey: CryptoKey;
	/** Read from `privateKey` when left out, which works for every key Web Crypto imports for these algorithms. */
	algorithm?: Algorithm;
}

/** What `sign` covers and how. */
export interface SignOptions {
	scheme: Scheme;
	key: SigningKey;
	/** The exact body bytes; adds `Content-Digest` (rfc9421) or `Digest` (cavage) and covers it. */
	body?: BinaryLike;
	/**
	 * What to cover, in order. Defaults to `@method @target-uri content-digest content-type
	 * date` (rfc9421) or `(request-target) host date digest content-type` (cavage), leaving
	 * out the digest without a body and `content-type` when the request has none.
	 */
	components?: Array<string | Component>;
	/** Signing time, also written as `Date` when the request has none. @default new Date() */
	created?: Date;
	/** RFC 9421 `expires`, or cavage `expires` when `(expires)` is covered. */
	expires?: Date;
	/** RFC 9421 `nonce`. */
	nonce?: string;
	/** RFC 9421 `tag`. */
	tag?: string;
	/** The RFC 9421 signature label. @default "sig1" */
	label?: string;
}

/**
 * Resolves the public key named by a signature. `algorithm` is the `alg` (RFC 9421) or
 * `algorithm` (cavage) the sender declared, or `null`; the key decides the algorithm.
 */
export type KeyLookup = (
	keyId: string,
	algorithm: string | null,
) => Promise<Result<CryptoKey | null, Error>>;

/** What `verify` checks a request against. */
export interface VerifyOptions {
	/** The exact body bytes received; read from a clone of the request when left out. */
	body?: BinaryLike;
	key: KeyLookup;
	/** How old `created` (or `Date`) may be. */
	maxAge: DurationInput;
	/** Allowed difference between the sender's clock and `now`. @default "5 minutes" */
	clockSkew?: DurationInput;
	/** @default new Date() */
	now?: Date;
	/** The RFC 9421 label to verify; the first signed label when left out. */
	label?: string;
}

/** What a verified signature establishes. */
export interface Verified {
	scheme: Scheme;
	keyId: string;
	/** The RFC 9421 label, `null` for cavage. */
	label: string | null;
	/** The `created` parameter, else the covered `Date`. */
	created: Date;
	/**
	 * Covered components in order: names such as `@method` or `content-type`, with any
	 * parameters appended (`@query-param;name="Pet"`), or cavage header names.
	 */
	components: string[];
}
