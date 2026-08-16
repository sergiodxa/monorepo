/**
 * Key material for the JWTs this monorepo issues and verifies.
 *
 * Covers the whole life of a signing key: generating an ES256 pair, serializing it
 * so it survives in a bucket or a database row, importing it back into `CryptoKey`
 * objects, publishing the public half as a JWKS, and turning someone else's JWKS —
 * local or remote — into the resolver a token is verified through.
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
 * A bucket accumulates one key file per rotation, so a set of this size is the whole
 * listing in practice and paging never runs a second time. It is kept well under the
 * 1000 an object store typically caps a listing at, so a store is free to return a
 * shorter page than asked for — `scan` follows the cursor either way.
 */
const SCAN_PAGE_SIZE = 100;

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
	 * ES256 only, which is what every issuer and relying party here is configured for.
	 * Adding a second one is a matter of generating and importing it: verification
	 * already picks a key by the `kid` and algorithm a token names, so a set publishing
	 * keys for several algorithms resolves the same way a set of one does.
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

	/**
	 * The half of a key pair `JWT.verify` needs when the keys are already in hand.
	 *
	 * One field rather than two, because the published JWK carries both the material
	 * and the `kid` a token's header is matched against, which is everything selecting
	 * a key out of a set takes.
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
	 * Every stored key comes back, newest first — which is the order `JWT.sign` relies
	 * on to pick what to sign with, and the order `toJSON` publishes them in. A set
	 * holding several is the normal state during a rotation: the newest signs, and the
	 * older ones stay published so tokens they signed keep verifying. A new key is
	 * minted when nothing usable is stored at all.
	 *
	 * Point this at the bucket the issuer already keeps its keys in. Against an empty
	 * one it bootstraps a key, and only tokens signed after every relying party has
	 * refreshed its copy of the published set will verify.
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
	 * Turns a key set that is already in hand into a resolver `JWT.verify` can use.
	 *
	 * The set is consulted per token, with that token's header in hand: the entry whose
	 * `kid` the header names is the one used, narrowed further by the key type, curve,
	 * algorithm and intended use each entry declares. Deciding per token is what lets a
	 * set publish several keys at once, since the token itself says which is meant.
	 *
	 * A set that offers exactly one key for what a token asks for verifies it. A set
	 * that offers none, or several a token gives no way to choose between, is an error.
	 *
	 * @param jwks - The key set, as served by a JWKS endpoint.
	 * @returns A resolver that answers with the key a given token names.
	 * @example
	 * let keys = await JWK.importLocal(jwks);
	 * let token = await IdToken.verify(raw, keys, { issuer, audience, algorithms });
	 */
	// Async despite reading nothing, so that a caller holding the result for the life of
	// an isolate — the way `importRemote` is meant to be held — awaits the same way for
	// both, and so either can start doing I/O without a breaking change.
	// biome-ignore lint/suspicious/useAwait: symmetry with `importRemote`, see above.
	export async function importLocal(jwks: jose.JSONWebKeySet): Promise<KeyResolver> {
		return jose.createLocalJWKSet(jwks);
	}

	/**
	 * Points a resolver at a JWKS endpoint, fetched when a token first needs it.
	 *
	 * The document is fetched on first use and then held, and fetched again — at most
	 * once per cooldown window — when a token names a `kid` the held copy does not
	 * carry. That is what carries a relying party across a rotation between deploys:
	 * the first token signed by a newly published key is what pulls that key in.
	 *
	 * Hold the result for the life of the isolate, so that every verification shares
	 * one fetched key set.
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
	 * Walks every stored key under a prefix, page by page.
	 *
	 * The first request is made with no cursor and its entries are yielded like every
	 * other page's, which is what puts the lexicographically first key file in the set
	 * `signingKeys` returns. An earlier version took that page's cursor and dropped its
	 * entries, and the resulting blind spot is what held the published JWKS at one key.
	 *
	 * A page is followed by another whenever the store hands back a cursor, so a store
	 * that answers with fewer entries than the requested limit is walked correctly.
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
