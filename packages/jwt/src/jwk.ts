/**
 * Key material for the JWTs this monorepo issues and verifies.
 *
 * Covers the whole life of a signing key: generating a pair, serializing it so it
 * survives in a bucket or a database row, importing it back into `CryptoKey` objects,
 * publishing the public half as a JWKS, and turning someone else's JWKS — local or
 * remote — into the resolver a token is verified through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as jose from "jose";

import type { KeyStorage } from "./key-storage";

/**
 * Prefix every stored signing key is written under.
 *
 * Listing by prefix is the only index this package has over the bucket, so the
 * prefix is what separates key files from anything else sharing the bucket.
 */
const SIGNING_KEY_PREFIX = "signing:key";

/**
 * Page size used while walking the stored keys, well under the 1000-item cap
 * an object store typically enforces, so a page is rarely followed by a second.
 */
const SCAN_PAGE_SIZE = 100;

/**
 * The public parameters a JWKS entry carries, one key type at a time.
 *
 * Each entry is rebuilt only from the fields listed here, which keeps private
 * components — `d`, and an RSA key's `p`, `q`, `dp`, `dq`, `qi` — out of a
 * published key set; `toJSON` throws for any key type missing from this map.
 */
const PUBLISHED_JWK_FIELDS: Record<string, ((jwk: jose.JWK) => jose.JWK) | undefined> = {
	EC: ({ crv, x, y }) => ({ crv, x, y }),
	OKP: ({ crv, x }) => ({ crv, x }),
	RSA: ({ e, n }) => ({ e, n }),
};

/**
 * Everything about the keys a token is signed with or verified against.
 *
 * Modeled as a namespace rather than loose exports because the names only make
 * sense qualified: `JWK.KeyPair`, `JWK.generateKeyPair`, `JWK.toJSON`.
 */
export namespace JWK {
	/**
	 * ES256 is issued here; RS256 verifies tokens from upstream identity
	 * providers; EdDSA derives its nonce from the key and message, keeping the
	 * ECDSA nonce-reuse leak that exposes a private key out of reach.
	 */
	export const Algorithm = { ES256: "ES256", RS256: "RS256", EdDSA: "EdDSA" } as const;

	/** One of the supported signature algorithms. */
	export type Algorithm = (typeof Algorithm)[keyof typeof Algorithm];

	/** A key pair imported into a usable form, with the public half in JWK format. */
	export interface KeyPair {
		/** Identifier published as the `kid`, and written into every token header. */
		id: string;
		/** Algorithm the pair was generated for. */
		alg: Algorithm;
		/** Public half, used to verify. */
		public: jose.CryptoKey;
		/** Private half, used to sign. */
		private: jose.CryptoKey;
		/** When the pair was generated, used to prefer the newest key. */
		created: Date;
		/** When the pair stopped being usable for signing, if it has. */
		expired?: Date;
		/** Public half in JWK form, carrying `kid` and `use`, ready to publish. */
		jwk: jose.JWK;
	}

	/**
	 * A key pair in the form it is stored and transported in.
	 *
	 * PEM strings and a millisecond timestamp, so the whole pair survives
	 * `JSON.stringify` into a bucket or a text column with nothing lost.
	 */
	export interface SerializedKeyPair {
		/** Identifier that becomes the `kid`. */
		id: `${string}-${string}-${string}-${string}-${string}`;
		/** Algorithm the pair was generated for. */
		alg: Algorithm;
		/** Public key in SPKI PEM form. */
		publicKey: string;
		/** Private key in PKCS#8 PEM form. */
		privateKey: string;
		/** Generation time in milliseconds since the epoch. */
		created: number;
		/** Expiry, when the pair has been retired from signing. */
		expired?: Date;
	}

	/**
	 * The half of a key pair `JWT.sign` needs.
	 *
	 * A structural subset of `KeyPair`, so a full pair is accepted wherever this is,
	 * and a caller holding only a private key does not have to fabricate the rest.
	 */
	export interface SigningKey {
		/** Identifier written into the token header as `kid`. */
		id: string;
		/** Algorithm the key was generated for, matched against the requested one. */
		alg: string;
		/** The private half. */
		private: jose.CryptoKey;
	}

	/**
	 * The half of a key pair `JWT.verify` needs when the keys are already in hand.
	 *
	 * A single `jwk` field carries both the key material and the `kid` a token's
	 * header is matched against — everything selecting a key from a set takes.
	 */
	export interface VerificationKey {
		jwk: jose.JWK;
	}

	/**
	 * Answers with the key a given token's header calls for.
	 *
	 * What `importLocal` and `importRemote` hand back: the key set is only consulted
	 * once there is a token to consult it about.
	 */
	export type KeyResolver = jose.JWTVerifyGetKey;

	/** Where `JWT.verify` can find a token's key: the keys themselves, or a resolver. */
	export type VerificationKeys = KeyResolver | VerificationKey[];

	/** Request headers, timeouts, and cache windows a remote key set can be given. */
	export type RemoteOptions = jose.RemoteJWKSetOptions;

	/**
	 * Generates a new key pair in serialized form.
	 *
	 * Generated extractable so the pair can be written to storage; a key held
	 * only within one isolate would sign tokens no other isolate could verify.
	 *
	 * @param alg - Algorithm to generate for.
	 * @returns The pair as PEM strings, ready to store.
	 * @example
	 * let serialized = await JWK.generateKeyPair(JWK.Algorithm.ES256);
	 * await db.create(table, { id: serialized.id, private_key: serialized.privateKey });
	 */
	export async function generateKeyPair(alg: Algorithm): Promise<SerializedKeyPair> {
		let key = await jose.generateKeyPair(alg, { extractable: true });

		return {
			id: crypto.randomUUID(),
			publicKey: await jose.exportSPKI(key.publicKey),
			privateKey: await jose.exportPKCS8(key.privateKey),
			created: Date.now(),
			alg,
		};
	}

	/**
	 * Imports a stored key pair back into usable `CryptoKey` objects.
	 *
	 * The public half is imported extractable, ready to be re-exported as a JWK,
	 * while the private half imports non-extractable since it never needs to
	 * leave the runtime again.
	 *
	 * @param value - A pair previously produced by `generateKeyPair`.
	 * @returns The pair with both halves imported and the public JWK attached.
	 * @example
	 * let keyPair = await JWK.importKeyPair({ id, alg, publicKey, privateKey, created });
	 */
	export async function importKeyPair(value: SerializedKeyPair): Promise<KeyPair> {
		let publicKey = await jose.importSPKI(value.publicKey, value.alg, { extractable: true });
		let privateKey = await jose.importPKCS8(value.privateKey, value.alg);

		let jwk = await jose.exportJWK(publicKey);
		jwk.kid = value.id;
		jwk.use = "sig";

		return {
			id: value.id,
			alg: value.alg,
			created: new Date(value.created),
			expired: value.expired,
			public: publicKey,
			private: privateKey,
			jwk,
		};
	}

	/**
	 * Loads the signing keys out of storage, generating one on first use.
	 *
	 * Every stored key comes back newest first, the order `JWT.sign` picks by and
	 * `toJSON` publishes in; finding none usable mints an ES256 key and re-reads
	 * storage, so every isolate ends up with the identical result.
	 *
	 * @param storage - Where key files live.
	 * @returns The usable key pairs, newest first.
	 * @example
	 * let keys = await JWK.signingKeys(storage);
	 * let jwks = JWK.toJSON(keys);
	 */
	export async function signingKeys(storage: KeyStorage): Promise<KeyPair[]> {
		let results: KeyPair[] = [];

		for await (let entry of scan(storage, SIGNING_KEY_PREFIX)) {
			let file = await storage.get(entry.key);
			if (!file) continue;
			results.push(await importKeyPair(JSON.parse(await file.text()) as SerializedKeyPair));
		}

		results.sort((a, b) => b.created.getTime() - a.created.getTime());

		if (results.some((item) => !item.expired)) return results;

		await storeKeyPair(storage, SIGNING_KEY_PREFIX, await generateKeyPair(Algorithm.ES256));

		return await signingKeys(storage);
	}

	/**
	 * Resolves a token's key by matching its header's `kid`, key type, curve,
	 * algorithm, and use against the set; anything but exactly one match is an
	 * error. Kept async so callers await it the same way as `importRemote`.
	 *
	 * @param jwks - The key set, as served by a JWKS endpoint.
	 * @returns A resolver that answers with the key a given token names.
	 * @example
	 * let keys = await JWK.importLocal(jwks);
	 * let token = await IdToken.verify(raw, keys, { issuer, audience, algorithms });
	 */
	// biome-ignore lint/suspicious/useAwait: symmetry with `importRemote`, see above.
	export async function importLocal(jwks: jose.JSONWebKeySet): Promise<KeyResolver> {
		return jose.createLocalJWKSet(jwks);
	}

	/**
	 * Points a resolver at a JWKS endpoint, fetched on first use and re-fetched
	 * at most once per cooldown window when a token names an unseen `kid` —
	 * carrying a relying party across a key rotation between deploys.
	 *
	 * @param url - The JWKS endpoint.
	 * @param options - Request headers, timeouts, and cache windows.
	 * @returns A resolver that answers with the key a given token names.
	 * @example
	 * let keys = JWK.importRemote(new URL(jwksUrl));
	 */
	// biome-ignore lint/suspicious/useAwait: async for the reason given on `importLocal`.
	export async function importRemote(url: URL, options?: RemoteOptions): Promise<KeyResolver> {
		return jose.createRemoteJWKSet(url, options);
	}

	/**
	 * Renders key pairs as the JSON a `/.well-known/jwks.json` endpoint serves.
	 *
	 * Each entry keeps only the public parameters its key type publishes here,
	 * plus `kid` and `alg`; an unrecognized key type raises an error, keeping
	 * unvetted private material out of the published set.
	 *
	 * @param keys - The key pairs to publish.
	 * @returns The JWKS document.
	 * @throws When a pair's key type has no published shape on record.
	 * @example
	 * return Response.json(JWK.toJSON(await JWK.signingKeys(storage)));
	 */
	export function toJSON(keys: KeyPair[]): jose.JSONWebKeySet {
		return {
			keys: keys.map(({ alg, id, jwk }) => {
				let publish = jwk.kty ? PUBLISHED_JWK_FIELDS[jwk.kty] : undefined;

				if (!publish) throw new Error(`Cannot publish a key of type ${String(jwk.kty)}`);

				return { ...publish(jwk), kty: jwk.kty, kid: id, alg };
			}),
		};
	}

	/**
	 * Walks every stored key under a prefix, page by page.
	 *
	 * Every page's entries are yielded, including the first, so the earliest key
	 * file is never dropped, and any returned cursor is followed to the next page.
	 *
	 * @param storage - Where key files live.
	 * @param prefix - Key prefix to walk.
	 * @yields Every listed entry, in the order the store returns them.
	 */
	async function* scan(storage: KeyStorage, prefix: string) {
		let cursor: string | undefined;

		do {
			let result = await storage.list({ prefix, cursor, limit: SCAN_PAGE_SIZE });
			yield* result.files;
			cursor = result.cursor;
		} while (cursor);
	}

	/**
	 * Writes a serialized key pair into storage as a JSON file.
	 *
	 * @param storage - Where key files live.
	 * @param prefix - Key prefix to write under.
	 * @param serialized - The pair to store.
	 */
	async function storeKeyPair(
		storage: KeyStorage,
		prefix: string,
		serialized: SerializedKeyPair,
	): Promise<void> {
		let file = new File([JSON.stringify(serialized)], "jwks.json", { type: "application/json" });
		await storage.set(`${prefix}:${serialized.id}`, file);
	}
}
