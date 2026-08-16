/**
 * Covers key generation, the serialize/import round-trip that lets a key survive in
 * storage, the JWKS document the public half is published as, and resolving a key
 * set — local or fetched — back into something a token can be verified against.
 *
 * The signing-key rotation suite asserts that every stored key comes back, newest
 * first, across a page boundary — a set holding several is the normal state during a
 * rotation, and each of them is published and verified against by `kid`.
 *
 * Every supported algorithm runs the same generate/import/sign/verify suite, and a set
 * holding all of them at once is asserted separately: the published entries have to
 * carry each key type's own parameters and none of anybody's private ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";

import * as jose from "jose";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

import type { KeyStorage, KeyStorageListOptions, KeyStorageListResult } from "./key-storage";

import { JWK } from "./jwk";
import { JWT } from "./jwt";

/** Where the remote-JWKS tests pretend an authorization server publishes its keys. */
const JWKS_URL = "https://auth.test/.well-known/jwks.json";

/** Pinned the way a caller is meant to verify, rather than left to the key's own type. */
const VERIFY = { algorithms: [JWK.Algorithm.ES256] };

/** Every supported algorithm, with the key type and public parameters it produces. */
const ALGORITHMS = [
	{ alg: JWK.Algorithm.ES256, kty: "EC", parameters: ["crv", "x", "y"] },
	{ alg: JWK.Algorithm.RS256, kty: "RSA", parameters: ["e", "n"] },
	{ alg: JWK.Algorithm.EdDSA, kty: "OKP", parameters: ["crv", "x"] },
] as const;

/** Parameters that belong to a private key alone, across every key type here. */
const PRIVATE_PARAMETERS = ["d", "dp", "dq", "p", "q", "qi"] as const;

/** A day in milliseconds, the spacing between the key files a seeded store holds. */
const ONE_DAY = 86_400_000;

let server = setupServer();

/**
 * An in-memory {@link KeyStorage} that pages the way an object store does: keys come
 * back in lexicographic order, and a cursor is only returned while entries remain.
 */
class MemoryKeyStorage implements KeyStorage {
	/** Everything stored so far, keyed by storage key. */
	readonly files = new Map<string, File>();

	/** Keys the listing still reports but whose file has gone, as a bucket mid-write. */
	readonly missing = new Set<string>();

	/** Cap on a page, so a listing can be forced to span more pages than asked for. */
	maxPageSize = 1000;

	/**
	 * Reads a stored file.
	 *
	 * @param key - Storage key to read.
	 * @returns The file, or `null` when nothing is stored there.
	 */
	get(key: string): File | null {
		if (this.missing.has(key)) return null;
		return this.files.get(key) ?? null;
	}

	/**
	 * Stores a file.
	 *
	 * @param key - Storage key to write to.
	 * @param file - File to store.
	 */
	set(key: string, file: File): void {
		this.files.set(key, file);
	}

	/**
	 * Returns one page of keys.
	 *
	 * @param options - Prefix, page size, and continuation cursor.
	 * @returns The page, with a cursor only when more entries follow.
	 */
	list(options: KeyStorageListOptions = {}): KeyStorageListResult {
		let keys = [...this.files.keys()]
			.filter((key) => !options.prefix || key.startsWith(options.prefix))
			.sort();

		let start = 0;
		if (options.cursor) {
			let index = keys.indexOf(options.cursor);
			start = index === -1 ? keys.length : index + 1;
		}

		// An object store is free to answer with fewer entries than the requested limit,
		// so the walk has to follow the cursor rather than assume one page holds it all.
		let limit = Math.min(options.limit ?? keys.length, this.maxPageSize);
		let page = keys.slice(start, start + limit);
		let exhausted = start + page.length >= keys.length;

		return {
			files: page.map((key) => ({ key })),
			cursor: exhausted ? undefined : page.at(-1),
		};
	}
}

/**
 * Writes one key file into a store, backdated so the walk has something to sort.
 *
 * @param storage - Store to write into.
 * @param alg - Algorithm to generate the pair for.
 * @param age - How many days back to date the pair.
 */
async function write(storage: MemoryKeyStorage, alg: JWK.Algorithm, age: number): Promise<void> {
	let serialized = await JWK.generateKeyPair(alg);
	serialized.created = Date.now() - age * ONE_DAY;
	storage.set(
		`signing:key:${serialized.id}`,
		new File([JSON.stringify(serialized)], "jwks.json", { type: "application/json" }),
	);
}

/**
 * Fills a store with key files, each a day older than the last.
 *
 * @param count - How many key pairs to write.
 * @returns The populated store.
 */
async function seed(count: number): Promise<MemoryKeyStorage> {
	let storage = new MemoryKeyStorage();

	for (let index = 0; index < count; index += 1) {
		await write(storage, JWK.Algorithm.ES256, index);
	}

	return storage;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("generating and importing key pairs", () => {
	test("generates a serializable pair", async () => {
		let serialized = await JWK.generateKeyPair(JWK.Algorithm.ES256);

		expect(serialized.alg).toBe("ES256");
		expect(serialized.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(serialized.publicKey).toStartWith("-----BEGIN PUBLIC KEY-----");
		expect(serialized.privateKey).toStartWith("-----BEGIN PRIVATE KEY-----");
		expect(serialized.created).toBeCloseTo(Date.now(), -4);
	});

	test("generates a distinct pair every time", async () => {
		let first = await JWK.generateKeyPair(JWK.Algorithm.ES256);
		let second = await JWK.generateKeyPair(JWK.Algorithm.ES256);

		expect(first.id).not.toBe(second.id);
		expect(first.privateKey).not.toBe(second.privateKey);
	});

	test("imports a pair back into usable keys", async () => {
		let serialized = await JWK.generateKeyPair(JWK.Algorithm.ES256);
		let pair = await JWK.importKeyPair(serialized);

		expect(pair.id).toBe(serialized.id);
		expect(pair.alg).toBe("ES256");
		expect(pair.created).toEqual(new Date(serialized.created));
		expect(pair.expired).toBeUndefined();
		expect(pair.private.type).toBe("private");
		expect(pair.public.type).toBe("public");
	});

	test("stamps the public JWK with the identifier tokens will carry", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));

		expect(pair.jwk.kid).toBe(pair.id);
		expect(pair.jwk.use).toBe("sig");
		expect(pair.jwk.kty).toBe("EC");
		expect(pair.jwk.crv).toBe("P-256");
		// The private scalar must never reach the JWK the JWKS is built from.
		expect(pair.jwk.d).toBeUndefined();
	});

	test("survives a full round-trip through JSON, as storage requires", async () => {
		let serialized = await JWK.generateKeyPair(JWK.Algorithm.ES256);
		let restored = await JWK.importKeyPair(
			JSON.parse(JSON.stringify(serialized)) as JWK.SerializedKeyPair,
		);

		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [restored]);

		await expect(JWT.verify(signed, [restored])).resolves.toBeDefined();
	});
});

for (let { alg, kty, parameters } of ALGORITHMS) {
	describe(alg, () => {
		let verify = { algorithms: [alg] };

		test("generates a pair as PEM strings", async () => {
			let serialized = await JWK.generateKeyPair(alg);

			expect(serialized.alg).toBe(alg);
			expect(serialized.id).toMatch(/^[0-9a-f-]{36}$/);
			expect(serialized.publicKey).toStartWith("-----BEGIN PUBLIC KEY-----");
			expect(serialized.privateKey).toStartWith("-----BEGIN PRIVATE KEY-----");
			expect(serialized.created).toBeCloseTo(Date.now(), -4);
		});

		test("imports the pair back into usable keys", async () => {
			let pair = await JWK.importKeyPair(await JWK.generateKeyPair(alg));

			expect(pair.alg).toBe(alg);
			expect(pair.private.type).toBe("private");
			expect(pair.public.type).toBe("public");
			expect(pair.jwk.kty).toBe(kty);
			expect(pair.jwk.kid).toBe(pair.id);
			expect(pair.jwk.use).toBe("sig");
			// The private component must never reach the JWK a key set is built from.
			expect(pair.jwk.d).toBeUndefined();
		});

		test("signs and verifies after a round-trip through storage", async () => {
			let serialized = await JWK.generateKeyPair(alg);
			let pair = await JWK.importKeyPair(
				JSON.parse(JSON.stringify(serialized)) as JWK.SerializedKeyPair,
			);

			let signed = await new JWT({ sub: "user-123" }).sign(alg, [pair]);
			let published = await JWK.importLocal(JWK.toJSON([pair]));

			let verified = await JWT.verify(signed, published, verify);

			expect(verified.subject).toBe("user-123");
		});

		test("publishes its key type's parameters, its `kid`, and its own name", async () => {
			let pair = await JWK.importKeyPair(await JWK.generateKeyPair(alg));

			let [published] = JWK.toJSON([pair]).keys;
			if (!published) throw new Error("nothing published");

			expect(Object.keys(published).sort()).toEqual(["alg", "kid", "kty", ...parameters].sort());
			expect(published.kty).toBe(kty);
			expect(published.alg).toBe(alg);
			expect(published.kid).toBe(pair.id);
		});
	});
}

describe("toJSON", () => {
	test("publishes only the public EC parameters", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));

		let jwks = JWK.toJSON([pair]);

		expect(jwks.keys).toHaveLength(1);
		expect(jwks.keys[0]).toEqual({
			alg: "ES256",
			crv: "P-256",
			kty: "EC",
			x: pair.jwk.x,
			y: pair.jwk.y,
			kid: pair.id,
		});
	});

	test("produces an empty set for no keys", () => {
		expect(JWK.toJSON([])).toEqual({ keys: [] });
	});

	test("refuses a key type whose public parameters are not on record", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		// A symmetric key, where the one parameter it carries is the secret itself: an
		// entry built by copying whatever fields a JWK happened to have would publish it.
		let symmetric: JWK.KeyPair = { ...pair, jwk: { kty: "oct", k: "c2VjcmV0" } };

		expect(() => JWK.toJSON([symmetric])).toThrow("Cannot publish a key of type oct");
	});

	test("refuses an unrecognized key type instead of publishing an entry without material", () => {
		let unrecognized = { alg: "ES256", id: "key-1", jwk: { kty: "XYZ", pub: "..." } };

		// One key with no published shape on record stops the whole document, rather than
		// the rest of the set going out with an entry a relying party cannot use.
		expect(() => JWK.toJSON([unrecognized as unknown as JWK.KeyPair])).toThrow(
			"Cannot publish a key of type XYZ",
		);
	});

	test("refuses a key carrying no type at all", () => {
		let untyped = { alg: "ES256", id: "key-1", jwk: { x: "...", y: "..." } };

		expect(() => JWK.toJSON([untyped as unknown as JWK.KeyPair])).toThrow(
			"Cannot publish a key of type undefined",
		);
	});
});

describe("a key set holding every algorithm", () => {
	test("verifies a token signed with any one of them", async () => {
		let pairs = await Promise.all(
			ALGORITHMS.map(async ({ alg }) => JWK.importKeyPair(await JWK.generateKeyPair(alg))),
		);

		let published = await JWK.importLocal(JWK.toJSON(pairs));

		// Selection is by `kid` and by the algorithm the token names, so a set carrying
		// three key types answers each token with the one key that was asked for.
		for (let pair of pairs) {
			let signed = await new JWT({ sub: "user-123" }).sign(pair.alg, [pair]);
			let verified = await JWT.verify(signed, published, { algorithms: [pair.alg] });

			expect(verified.subject).toBe("user-123");
		}
	});

	test("carries no private parameter, whatever the key type", async () => {
		let pairs = await Promise.all(
			ALGORITHMS.map(async ({ alg }) => JWK.importKeyPair(await JWK.generateKeyPair(alg))),
		);

		let jwks = JWK.toJSON(pairs);

		for (let published of jwks.keys) {
			for (let parameter of PRIVATE_PARAMETERS) expect(published[parameter]).toBeUndefined();
		}

		// The serialized document is what actually leaves the process, so the parameters
		// are looked for there too, at any depth an entry might have nested them.
		expect(JSON.stringify(jwks)).not.toMatch(/"(?:d|dp|dq|p|q|qi)":/);
	});
});

describe("importLocal", () => {
	test("resolves a published key that verifies a token signed with its pair", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [pair]);

		let resolved = await JWK.importLocal(JWK.toJSON([pair]));

		await expect(JWT.verify(signed, resolved, VERIFY)).resolves.toBeDefined();
	});

	test("does not resolve a key from an unrelated issuer", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let other = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [pair]);

		let resolved = await JWK.importLocal(JWK.toJSON([other]));

		expect(JWT.verify(signed, resolved, VERIFY)).rejects.toThrow();
	});

	test("has no key to offer for an empty set", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [pair]);

		let resolved = await JWK.importLocal({ keys: [] });

		expect(JWT.verify(signed, resolved, VERIFY)).rejects.toBeInstanceOf(
			jose.errors.JWKSNoMatchingKey,
		);
	});

	test("picks the key a token names out of a set publishing several", async () => {
		// The set a rotation publishes: the key that signs now, alongside the one it
		// replaced. Both stay resolvable, and the token's `kid` is what tells them apart.
		let retired = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let current = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));

		let resolved = await JWK.importLocal(JWK.toJSON([current, retired]));

		for (let pair of [current, retired]) {
			let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [pair]);
			await expect(JWT.verify(signed, resolved, VERIFY)).resolves.toBeDefined();
		}
	});

	test("refuses a token naming a key the set does not publish", async () => {
		let published = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let unpublished = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [unpublished]);

		let resolved = await JWK.importLocal(JWK.toJSON([published]));

		// Rejected on the `kid` alone, before the signature is even checked — the set has
		// nothing to offer for that name.
		expect(JWT.verify(signed, resolved, VERIFY)).rejects.toBeInstanceOf(
			jose.errors.JWKSNoMatchingKey,
		);
	});

	test("will not verify a signature with a key published for encryption", async () => {
		// Choosing a key reads `use` and `alg`, not just `kid`, because a set is free to
		// publish keys meant for encryption or for another algorithm entirely.
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [pair]);
		let [published] = JWK.toJSON([pair]).keys;

		let encryption = await JWK.importLocal({ keys: [{ ...published, use: "enc" }] });
		let otherAlgorithm = await JWK.importLocal({ keys: [{ ...published, alg: "RS256" }] });

		expect(JWT.verify(signed, encryption, VERIFY)).rejects.toBeInstanceOf(
			jose.errors.JWKSNoMatchingKey,
		);
		expect(JWT.verify(signed, otherAlgorithm, VERIFY)).rejects.toBeInstanceOf(
			jose.errors.JWKSNoMatchingKey,
		);
	});

	test("fails when the document is not a key set at all", () => {
		expect(JWK.importLocal({} as jose.JSONWebKeySet)).rejects.toThrow(/malformed/i);
	});
});

describe("importRemote", () => {
	test("fetches the key set when a token first needs it, not at import", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let signed = await new JWT({ sub: "user-123", iss: "https://auth.test" }).sign(
			JWK.Algorithm.ES256,
			[pair],
		);
		let requests = 0;

		server.use(
			http.get(JWKS_URL, () => {
				requests += 1;
				return HttpResponse.json(JWK.toJSON([pair]));
			}),
		);

		let resolved = await JWK.importRemote(new URL(JWKS_URL));

		expect(requests).toBe(0);

		let verified = await JWT.verify(signed, resolved, { ...VERIFY, issuer: "https://auth.test" });

		expect(verified.subject).toBe("user-123");
		expect(requests).toBe(1);
	});

	test("reuses the fetched set, so it can be held for the isolate's life", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let requests = 0;

		server.use(
			http.get(JWKS_URL, () => {
				requests += 1;
				return HttpResponse.json(JWK.toJSON([pair]));
			}),
		);

		let resolved = await JWK.importRemote(new URL(JWKS_URL));

		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [pair]);
		await JWT.verify(signed, resolved, VERIFY);
		await JWT.verify(signed, resolved, VERIFY);

		expect(requests).toBe(1);
	});

	test("refetches when a token names a key the cached set does not hold", async () => {
		// How a verifier crosses a rotation without being redeployed: the first token
		// signed by a newly published key is what pulls that key in. The cooldown is set
		// to zero so the refetch is immediate here.
		let current = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let rotated = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let published = [current];

		server.use(http.get(JWKS_URL, () => HttpResponse.json(JWK.toJSON(published))));

		let resolved = await JWK.importRemote(new URL(JWKS_URL), { cooldownDuration: 0 });

		let before = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [current]);
		await JWT.verify(before, resolved, VERIFY);

		published = [rotated, current];
		let after = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [rotated]);

		await expect(JWT.verify(after, resolved, VERIFY)).resolves.toBeDefined();
	});

	test("fails when the endpoint does not serve a key set", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, [pair]);

		server.use(http.get(JWKS_URL, () => new HttpResponse(null, { status: 500 })));

		let resolved = await JWK.importRemote(new URL(JWKS_URL));

		expect(JWT.verify(signed, resolved, VERIFY)).rejects.toThrow(/200 OK/);
	});
});

describe("signingKeys", () => {
	test("generates and stores a key when the store is empty", async () => {
		let storage = new MemoryKeyStorage();

		let keys = await JWK.signingKeys(storage);

		expect(keys).not.toBeEmpty();
		expect([...storage.files.keys()].every((key) => key.startsWith("signing:key:"))).toBe(true);
	});

	test("returns keys that actually sign and verify", async () => {
		let storage = new MemoryKeyStorage();
		let keys = await JWK.signingKeys(storage);

		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys);

		await expect(JWT.verify(signed, keys)).resolves.toBeDefined();
	});

	test("returns the same key on a second call, rather than rotating", async () => {
		let storage = new MemoryKeyStorage();

		let first = await JWK.signingKeys(storage);
		let stored = storage.files.size;
		let second = await JWK.signingKeys(storage);

		expect(second.map((key) => key.id)).toEqual(first.map((key) => key.id));
		expect(storage.files.size).toBe(stored);
	});

	test("bootstraps exactly one key file and returns the key in it", async () => {
		// The store is written to once and read back, rather than the pair of files an
		// earlier walk produced by generating a key it then could not see.
		let storage = new MemoryKeyStorage();

		let keys = await JWK.signingKeys(storage);

		expect(keys).toHaveLength(1);
		expect(storage.files.size).toBe(1);
		expect(JWK.toJSON(keys).keys).toHaveLength(1);
	});

	test("returns every stored key, newest first", async () => {
		let storage = await seed(4);

		let keys = await JWK.signingKeys(storage);

		expect(keys).toHaveLength(4);
		let timestamps = keys.map((key) => key.created.getTime());
		expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
	});

	test("returns a set mixing algorithms as one sequence, newest first", async () => {
		let storage = new MemoryKeyStorage();
		for (let [age, { alg }] of ALGORITHMS.entries()) await write(storage, alg, age);

		let keys = await JWK.signingKeys(storage);

		expect(keys.map((key) => key.alg)).toEqual(ALGORITHMS.map(({ alg }) => alg));
		// A stored set counts as usable whatever it was generated for, so nothing is
		// minted on top of one that already holds keys for algorithms other than ES256.
		expect(storage.files.size).toBe(ALGORITHMS.length);

		let published = await JWK.importLocal(JWK.toJSON(keys));

		for (let { alg } of ALGORITHMS) {
			let signed = await new JWT({ sub: "user-123" }).sign(alg, keys);

			await expect(JWT.verify(signed, published, { algorithms: [alg] })).resolves.toBeDefined();
		}
	});

	test("mints an ES256 key when the store holds nothing usable", async () => {
		let storage = new MemoryKeyStorage();

		let keys = await JWK.signingKeys(storage);

		expect(keys.map((key) => key.alg)).toEqual(["ES256"]);
	});

	test("returns the lexicographically first key too, across a page boundary", async () => {
		// The first listed entry is the one the old walk dropped, and a store that pages
		// is where that showed: the entries before the first cursor were never yielded.
		let storage = await seed(5);
		storage.maxPageSize = 2;

		let keys = await JWK.signingKeys(storage);

		let stored = [...storage.files.keys()].sort();
		expect(keys.map((key) => `signing:key:${key.id}`).sort()).toEqual(stored);
	});

	test("publishes every key it returns, so a rotation keeps the old one verifiable", async () => {
		let storage = await seed(3);

		let keys = await JWK.signingKeys(storage);
		let published = await JWK.importLocal(JWK.toJSON(keys));

		expect(JWK.toJSON(keys).keys).toHaveLength(3);

		// Signed by the oldest key, verified against the published set: only possible
		// because every stored key is published and the token's `kid` finds it there.
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys.slice(-1));

		await expect(JWT.verify(signed, published, VERIFY)).resolves.toBeDefined();
	});

	test("skips a listed entry whose file has gone missing", async () => {
		// A listing that names a key the store cannot return must not throw: that is the
		// shape of an eventually-consistent bucket read mid-write.
		let storage = await seed(4);
		let listed = [...storage.files.keys()].sort();
		storage.missing.add(listed[1] ?? "");

		let keys = await JWK.signingKeys(storage);

		expect(keys).toHaveLength(3);
		expect(keys.map((key) => `signing:key:${key.id}`)).not.toContain(listed[1]);
	});
});
