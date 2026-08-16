/**
 * Key material for the JWTs this monorepo issues and verifies.
 *
 * Covers the whole life of a signing key: generating an ES256 pair, serializing it
 * so it survives in a bucket or a database row, importing it back into `CryptoKey`
 * objects, publishing the public half as a JWKS, and resolving someone else's JWKS
 * — local or remote — into a key a token can be verified against.
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
 * Page size used while walking the stored keys.
 *
 * One per page, which is how the original implementation paged and is load-bearing
 * for which keys `signingKeys` ends up returning — see the note on `scan`.
 */
const SCAN_PAGE_SIZE = 1;

/**
 * Everything about the keys a token is signed with or verified against.
 *
 * Modeled as a namespace rather than loose exports because the names only make
 * sense qualified: `JWK.KeyPair`, `JWK.generateKeyPair`, `JWK.toJSON`.
 */
export namespace JWK {
	/**
	 * Signature algorithms this package supports.
	 *
	 * ES256 only, which is what every issuer and relying party here is configured
	 * for. Adding another is not just a new entry: a JWKS publishing more than one
	 * key needs `kid`-aware resolution on the verifying side, or a relying party
	 * cannot tell which key to use.
	 */
	export const Algorithm = { ES256: "ES256" } as const;

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

	/** A resolved public key, in the shape `JWT.verify` accepts. */
	export interface VerificationKey {
		/** The public key to verify against. */
		public: jose.CryptoKey;
	}

	/**
	 * Generates a new key pair in serialized form.
	 *
	 * The keys are generated extractable on purpose: a pair that cannot be exported
	 * cannot be written to storage, and a signing key that only exists in one isolate
	 * signs tokens no other isolate can verify.
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
	 * The public half is re-exported as a JWK and stamped with `kid` and `use: "sig"`
	 * here rather than at publish time, so the identifier a token header carries and
	 * the identifier the JWKS advertises can never drift apart.
	 *
	 * @param value - A pair previously produced by `generateKeyPair`.
	 * @returns The pair with both halves imported and the public JWK attached.
	 * @example
	 * let keyPair = await JWK.importKeyPair({ id, alg, publicKey, privateKey, created });
	 */
	export async function importKeyPair(value: SerializedKeyPair): Promise<KeyPair> {
		// Extractable so the public half can be re-exported as a JWK below; the private
		// half never needs to leave the runtime again, so it is imported non-extractable.
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
	 * Newest key first, which is the order `JWT.sign` relies on to pick what to sign
	 * with. Never point this at an empty production bucket: it will happily generate a
	 * fresh key, and tokens signed with it verify against no relying party's cached
	 * JWKS.
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

		// Nothing usable came back, so mint one and re-read rather than returning the
		// new pair directly — the re-read is what makes the result identical to what
		// the next isolate will see, instead of racing it.
		await storeKeyPair(storage, SIGNING_KEY_PREFIX, await generateKeyPair(Algorithm.ES256));

		return await signingKeys(storage);
	}

	/**
	 * Resolves a JWK set that is already in hand into a verification key.
	 *
	 * Note that this resolves a *single* key, matched on algorithm alone, at import
	 * time — the token's `kid` is never consulted. A set that publishes two keys for
	 * the same algorithm therefore fails to resolve rather than picking one, which is
	 * the constraint that keeps the number of published signing keys at one.
	 *
	 * @param jwks - The key set, as fetched from a JWKS endpoint.
	 * @param options - Algorithm to match on.
	 * @returns A single-element array in the shape `JWT.verify` takes.
	 * @example
	 * let keys = await JWK.importLocal(jwks, { alg: JWK.Algorithm.ES256 });
	 * let token = await IdToken.verify(raw, keys, { issuer, audience });
	 */
	export async function importLocal(
		jwks: jose.JSONWebKeySet,
		options?: { alg: Algorithm },
	): Promise<VerificationKey[]> {
		let load = jose.createLocalJWKSet(jwks);
		return [{ public: await load({ alg: options?.alg }) }];
	}

	/**
	 * Fetches a JWKS endpoint and resolves it into a verification key.
	 *
	 * The fetch happens once, here, so callers are expected to hold the returned
	 * promise for the life of the isolate rather than calling this per request. Same
	 * single-key, algorithm-only resolution as `importLocal`.
	 *
	 * @param url - The JWKS endpoint.
	 * @param options - Algorithm to match on, plus any remote-set option jose accepts.
	 * @returns A single-element array in the shape `JWT.verify` takes.
	 * @example
	 * let keys = JWK.importRemote(new URL(jwksUrl), { alg: JWK.Algorithm.ES256 });
	 */
	export async function importRemote(
		url: URL,
		options: jose.RemoteJWKSetOptions & { alg: Algorithm },
	): Promise<VerificationKey[]> {
		let load = jose.createRemoteJWKSet(url, options);
		return [{ public: await load({ alg: options.alg }) }];
	}

	/**
	 * Renders key pairs as the JSON a `/.well-known/jwks.json` endpoint serves.
	 *
	 * Only the EC parameters are published, and only ever from the public half — the
	 * shape of the output is what guarantees a private key cannot reach this endpoint
	 * through a field nobody thought about.
	 *
	 * @param keys - The key pairs to publish.
	 * @returns The JWKS document.
	 * @example
	 * return Response.json(JWK.toJSON(await JWK.signingKeys(storage)));
	 */
	export function toJSON(keys: KeyPair[]) {
		return {
			keys: keys.map(({ jwk }) => {
				return { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y, kid: jwk.kid };
			}),
		};
	}

	/**
	 * Walks the stored keys under a prefix.
	 *
	 * This intentionally reproduces a quirk of the implementation it replaces: the
	 * first page is fetched to obtain a cursor and is then *not* yielded, so the
	 * entries this produces are the second onward. With a page size of one, that means
	 * the lexicographically first key file is invisible to `signingKeys`.
	 *
	 * It is preserved rather than corrected because the skip is what keeps the number
	 * of returned keys at one in a bucket holding two, and `importLocal` /
	 * `importRemote` resolve a JWKS by algorithm alone — publishing a second key would
	 * make every relying party in this monorepo fail to resolve a verification key.
	 * Fixing the paging therefore has to happen together with kid-aware resolution and
	 * a deliberate bucket migration, not on its own.
	 *
	 * @param storage - Where key files live.
	 * @param prefix - Key prefix to walk.
	 * @yields Each listed entry after the first page.
	 */
	async function* scan(storage: KeyStorage, prefix: string) {
		let { cursor } = await storage.list({ prefix, limit: SCAN_PAGE_SIZE });

		while (cursor) {
			let result = await storage.list({ prefix, cursor, limit: SCAN_PAGE_SIZE });
			yield* result.files;
			cursor = result.cursor;
		}
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
