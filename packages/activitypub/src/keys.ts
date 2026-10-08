/**
 * The signing keys of a local actor: generating the RSA pair once, importing the stored
 * private key with its public half derived from it, and the `publicKey` member an actor
 * document publishes, plus importing a remote actor's published key for verification.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { CryptoError, InvalidKeyError, Pem } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { ActivityPub } from "./lib/types.js";

/** RSASSA-PKCS1-v1_5 over SHA-256, the only algorithm every Mastodon version verifies. */
const RSA_ALGORITHM = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

/** Ed25519, which some servers publish under `publicKeyPem` instead of an RSA key. */
const ED25519_ALGORITHM = { name: "Ed25519" } as const;

/** The modulus length Mastodon generates, so a key this package makes looks like theirs. */
const RSA_MODULUS_LENGTH = 2048;

/** The PEM label of a PKCS#8 private key. */
const PRIVATE_KEY_LABEL = "PRIVATE KEY";

/** The PEM label of an SPKI public key, which is what `publicKeyPem` carries. */
const PUBLIC_KEY_LABEL = "PUBLIC KEY";

/** The fragment Mastodon puts its key under, and where it looks for one on an actor. */
const MAIN_KEY_FRAGMENT = "#main-key";

/**
 * The keys a local actor signs with: the RSA pair every HTTP signature from the actor uses,
 * and the `publicKey` member its actor document publishes so remote servers can verify them.
 */
export class ActorKeys {
	/** The actor's id. */
	readonly actor: string;
	/** `id` is `<actor>#main-key`, the `keyId` every HTTP signature from the actor names. */
	readonly rsa: ActorKeys.Rsa;
	/** Present once FEP-8b32 proofs are enabled. */
	readonly ed25519: ActorKeys.Ed25519 | null;

	/**
	 * @param init - The actor and keys already imported; `ActorKeys.import` builds them from
	 *   a stored PEM.
	 */
	constructor(init: ActorKeys.Init) {
		this.actor = init.actor;
		this.rsa = init.rsa;
		this.ed25519 = init.ed25519 ?? null;
	}

	/**
	 * Generates an RSA 2048 key pair for an actor. Run it once and store `privateKeyPem` as
	 * a secret: every follower verifies against the published half, so a new pair means an
	 * actor `Update` delivered to all of them.
	 *
	 * @returns Both halves as PEM, or a `CryptoError` when Web Crypto refuses.
	 * @example let generated = await ActorKeys.generate();
	 */
	static async generate(): Promise<Result<ActorKeys.Generated, CryptoError>> {
		let pair: CryptoKeyPair;
		let pkcs8: ArrayBuffer;
		let spki: ArrayBuffer;
		try {
			pair = await crypto.subtle.generateKey(
				{
					...RSA_ALGORITHM,
					modulusLength: RSA_MODULUS_LENGTH,
					publicExponent: new Uint8Array([1, 0, 1]),
				},
				true,
				["sign", "verify"],
			);
			pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
			spki = await crypto.subtle.exportKey("spki", pair.publicKey);
		} catch (cause) {
			return failure(new CryptoError(`Could not generate an RSA key pair: ${reasonOf(cause)}`));
		}

		let privateKeyPem = Pem.encode(pkcs8, PRIVATE_KEY_LABEL);
		if (isFailure(privateKeyPem)) return privateKeyPem;
		let publicKeyPem = Pem.encode(spki, PUBLIC_KEY_LABEL);
		if (isFailure(publicKeyPem)) return publicKeyPem;

		return success({ privateKeyPem: privateKeyPem.data, publicKeyPem: publicKeyPem.data });
	}

	/**
	 * Imports an actor's stored private key. The public half is derived from the private
	 * key's JWK, so only one secret is stored and the published key always matches the
	 * signing one. The imported private key stays inside Web Crypto, unextractable.
	 *
	 * @param options - The actor's id and its PKCS#8 PEM.
	 * @returns The keys, or an `InvalidKeyError` for a PEM that is not a PKCS#8 RSA key.
	 * @example let keys = await ActorKeys.import({ actor: ACTOR_ID, privateKeyPem: env.ACTIVITYPUB_PRIVATE_KEY });
	 */
	static async import(options: ActorKeys.ImportOptions): Promise<Result<ActorKeys, CryptoError>> {
		let der = Pem.decode(options.privateKeyPem, PRIVATE_KEY_LABEL);
		if (isFailure(der)) {
			return failure(new InvalidKeyError("the private key must be PKCS#8 PEM (BEGIN PRIVATE KEY)"));
		}

		let privateKey: CryptoKey;
		let spki: ArrayBuffer;
		try {
			let extractable = await crypto.subtle.importKey("pkcs8", der.data, RSA_ALGORITHM, true, [
				"sign",
			]);
			let jwk = await crypto.subtle.exportKey("jwk", extractable);
			let publicKey = await crypto.subtle.importKey(
				"jwk",
				{ kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
				RSA_ALGORITHM,
				true,
				["verify"],
			);
			spki = await crypto.subtle.exportKey("spki", publicKey);
			privateKey = await crypto.subtle.importKey("pkcs8", der.data, RSA_ALGORITHM, false, ["sign"]);
		} catch (cause) {
			return failure(new InvalidKeyError(`not an RSA private key: ${reasonOf(cause)}`));
		}

		let publicKeyPem = Pem.encode(spki, PUBLIC_KEY_LABEL);
		if (isFailure(publicKeyPem)) return publicKeyPem;

		return success(
			new ActorKeys({
				actor: options.actor,
				rsa: {
					id: `${options.actor}${MAIN_KEY_FRAGMENT}`,
					privateKey,
					publicKeyPem: publicKeyPem.data,
				},
			}),
		);
	}

	/** The `keyId` signatures name, `<actor>#main-key`, which is where Mastodon looks. */
	get id(): string {
		return this.rsa.id;
	}

	/**
	 * The `publicKey` member of the actor document, under `<actor>#main-key` with `owner`
	 * naming the actor, which is where Mastodon looks for the key a signature names.
	 *
	 * @example let actor = { ...ACTOR, publicKey: keys.publicKey };
	 */
	get publicKey(): ActivityPub.PublicKey {
		return { id: this.rsa.id, owner: this.actor, publicKeyPem: this.rsa.publicKeyPem };
	}
}

export namespace ActorKeys {
	/** A freshly generated pair, armored for storage as secrets. */
	export interface Generated {
		/** PKCS#8; the only value that must stay secret, and what `ActorKeys.import` reads. */
		privateKeyPem: string;
		/** SPKI, as an actor's `publicKey.publicKeyPem` publishes it. */
		publicKeyPem: string;
	}

	/** What `ActorKeys.import` reads. */
	export interface ImportOptions {
		/** The actor's id, which names the key `<actor>#main-key`. */
		actor: string;
		/** PKCS#8 PEM, as `ActorKeys.generate` produced it. */
		privateKeyPem: string;
	}

	/** The RSA half every HTTP signature uses. */
	export interface Rsa {
		id: string;
		privateKey: CryptoKey;
		publicKeyPem: string;
	}

	/** The Ed25519 key FEP-8b32 proofs are signed with. */
	export interface Ed25519 {
		id: string;
		privateKey: CryptoKey;
		publicKeyMultibase: string;
	}

	/** Keys already imported into Web Crypto. */
	export interface Init {
		actor: string;
		rsa: Rsa;
		/** @default null */
		ed25519?: Ed25519 | null;
	}
}

/**
 * Imports a remote actor's `publicKeyPem` for verifying its signatures. SPKI RSA keys
 * import as RSASSA-PKCS1-v1_5 SHA-256 and SPKI Ed25519 keys as Ed25519, the two kinds
 * servers publish there.
 *
 * @param pem - The SPKI PEM a remote actor published.
 * @returns A verify-only key, or an `InvalidKeyError` for anything else.
 */
export async function importPublicKey(pem: string): Promise<Result<CryptoKey, CryptoError>> {
	let der = Pem.decode(pem, PUBLIC_KEY_LABEL);
	if (isFailure(der)) {
		return failure(new InvalidKeyError("the public key must be SPKI PEM (BEGIN PUBLIC KEY)"));
	}

	for (let algorithm of [RSA_ALGORITHM, ED25519_ALGORITHM]) {
		try {
			return success(await crypto.subtle.importKey("spki", der.data, algorithm, false, ["verify"]));
		} catch {
			continue;
		}
	}
	return failure(new InvalidKeyError("the public key is neither RSA nor Ed25519"));
}

/** The message of a thrown value, for an error that wraps it. */
function reasonOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}
