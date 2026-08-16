/**
 * Covers key generation, the serialize/import round-trip that lets a key survive in
 * storage, the JWKS document the public half is published as, and resolving a key
 * set — local or fetched — back into something a token can be verified against.
 *
 * The signing-key rotation suite asserts that every stored key comes back, newest
 * first, across a page boundary — a set holding several is the normal state during a
 * rotation, and each of them is published and verified against by `kid`.
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
 * Fills a store with key files, each a day older than the last.
 *
 * @param count - How many key pairs to write.
 * @returns The populated store.
 */
async function seed(count: number): Promise<MemoryKeyStorage> {
	let storage = new MemoryKeyStorage();

	for (let index = 0; index < count; index += 1) {
		let serialized = await JWK.generateKeyPair(JWK.Algorithm.ES256);
		serialized.created = Date.now() - index * 86_400_000;
		storage.set(
			`signing:key:${serialized.id}`,
			new File([JSON.stringify(serialized)], "jwks.json", { type: "application/json" }),
		);
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

describe("toJSON", () => {
	test("publishes only the public EC parameters", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));

		let jwks = JWK.toJSON([pair]);

		expect(jwks.keys).toHaveLength(1);
		expect(jwks.keys[0]).toEqual({
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
