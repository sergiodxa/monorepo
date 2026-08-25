/**
 * Covers signing, verification, and decoding of tokens, plus the two ways a
 * verified token is read in this monorepo: through `payload` and through a
 * subclass's claim accessors. Both have to keep working on the same object, so
 * they are asserted side by side rather than in separate suites.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as jose from "jose";
import { beforeAll, describe, expect, test } from "vitest";

import { JWK } from "./jwk";
import { JWT } from "./jwt";

/** Seconds of clock drift the tolerance tests allow. */
const CLOCK_TOLERANCE = 60;

/** Verification options requiring the ES256 algorithm, reused across the key-selection tests. */
const VERIFY = { algorithms: [JWK.Algorithm.ES256] };

/** A token class shaped like the real ones: required claims, narrowed return types. */
class TestToken extends JWT {
	override get subject() {
		return this.parser.string("sub");
	}

	override get audience() {
		return this.parser.string("aud");
	}

	get email() {
		return this.parser.string("email");
	}

	get emailVerified() {
		return this.parser.boolean("email_verified");
	}
}

let keys: JWK.KeyPair[];
let otherKeys: JWK.KeyPair[];

/** Epoch seconds, the unit every registered time claim is written in. */
function now(): number {
	return Math.floor(Date.now() / 1000);
}

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	otherKeys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
});

describe("signing and verifying", () => {
	test("round-trips a token through ES256", async () => {
		let token = new JWT({ sub: "user-123", iss: "https://auth.test", aud: "client-1" });

		let signed = await JWT.sign(token, JWK.Algorithm.ES256, keys);
		let verified = await JWT.verify(signed, keys, {
			issuer: "https://auth.test",
			audience: "client-1",
		});

		expect(verified.subject).toBe("user-123");
		expect(verified.issuer).toBe("https://auth.test");
		expect(verified.audience).toBe("client-1");
	});

	test("signs from the instance as well as the static", async () => {
		let token = new JWT({ sub: "user-123" });

		let fromInstance = await token.sign(JWK.Algorithm.ES256, keys);
		let fromStatic = await JWT.sign(token, JWK.Algorithm.ES256, keys);

		expect(fromInstance.split(".").slice(0, 2)).toEqual(fromStatic.split(".").slice(0, 2));
		await expect(JWT.verify(fromInstance, keys)).resolves.toBeDefined();
	});

	test("names the signing key in the header so a relying party can find it", async () => {
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys);

		let header = JSON.parse(atob(signed.split(".")[0] ?? "")) as Record<string, unknown>;

		expect(header.kid).toBe(keys[0]?.id);
		expect(header.alg).toBe("ES256");
		expect(header.typ).toBe("JWT");
	});

	test("refuses to sign when no key matches the algorithm", () => {
		let token = new JWT({ sub: "user-123" });

		expect(() => JWT.sign(token, JWK.Algorithm.ES256, [])).toThrow(
			"No key available to sign JWT with algorithm ES256",
		);
	});

	test("refuses to verify when no key is available", async () => {
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys);

		await expect(JWT.verify(signed, [])).rejects.toThrow("No key available to verify JWT");
	});
});

describe("choosing a key out of a set", () => {
	test("verifies with the key the token names, out of several held", async () => {
		let [signer] = keys;
		let [other] = otherKeys;
		if (!signer || !other) throw new Error("no keys");

		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys);

		let verified = await JWT.verify(signed, [other, signer], VERIFY);

		expect(verified.subject).toBe("user-123");
	});

	test("refuses a token naming a key the set does not hold", async () => {
		let [signer] = keys;
		let [other] = otherKeys;
		if (!signer || !other) throw new Error("no keys");

		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys);

		await expect(JWT.verify(signed, [other], VERIFY)).rejects.toBeInstanceOf(
			jose.errors.JWKSNoMatchingKey,
		);
	});

	test("refuses a token whose algorithm is not the pinned one", async () => {
		let [signer] = keys;
		if (!signer) throw new Error("no signing key");

		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys);

		await expect(JWT.verify(signed, keys, { algorithms: [JWK.Algorithm.RS256] })).rejects.toThrow();
	});

	test("signs with the first key in the set generated for the algorithm asked for", async () => {
		let current = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.RS256));
		let retired = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.RS256));
		let edwards = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.EdDSA));
		let mixed = [edwards, current, ...keys, retired];

		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.RS256, mixed);
		let header = JSON.parse(atob(signed.split(".")[0] ?? "")) as Record<string, unknown>;

		expect(header.alg).toBe("RS256");
		expect(header.kid).toBe(current.id);

		await expect(
			JWT.verify(signed, mixed, { algorithms: [JWK.Algorithm.RS256] }),
		).resolves.toBeDefined();
	});

	test("accepts a resolver as readily as the keys themselves", async () => {
		let [signer] = keys;
		if (!signer) throw new Error("no signing key");

		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys);
		let resolver = jose.createLocalJWKSet({ keys: keys.map((key) => key.jwk) });

		await expect(JWT.verify(signed, resolver, VERIFY)).resolves.toBeDefined();
	});
});

describe("verification failures", () => {
	test("rejects a token signed by another key", async () => {
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys);

		await expect(JWT.verify(signed, otherKeys)).rejects.toThrow();
	});

	test("rejects a token whose payload was edited after signing", async () => {
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.ES256, keys);

		let [header, , signature] = signed.split(".");
		let forged = btoa(JSON.stringify({ sub: "admin" })).replaceAll("=", "");

		await expect(JWT.verify(`${header}.${forged}.${signature}`, keys)).rejects.toThrow();
	});

	test("rejects a mismatched issuer", async () => {
		let signed = await new JWT({ sub: "user-123", iss: "https://auth.test" }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		await expect(JWT.verify(signed, keys, { issuer: "https://elsewhere.test" })).rejects.toThrow();
		await expect(JWT.verify(signed, keys, { issuer: "https://auth.test" })).resolves.toBeDefined();
	});

	test("rejects a mismatched audience", async () => {
		let signed = await new JWT({ sub: "user-123", aud: "client-1" }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		await expect(JWT.verify(signed, keys, { audience: "client-2" })).rejects.toThrow();
		await expect(JWT.verify(signed, keys, { audience: "client-1" })).resolves.toBeDefined();
	});
});

describe("time claims", () => {
	test("rejects an expired token", async () => {
		let signed = await new JWT({ sub: "user-123", exp: now() - 10 }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		await expect(JWT.verify(signed, keys)).rejects.toThrow();
	});

	test("accepts a just-expired token within the clock tolerance", async () => {
		let signed = await new JWT({ sub: "user-123", exp: now() - 10 }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		let verified = await JWT.verify(signed, keys, { clockTolerance: CLOCK_TOLERANCE });

		expect(verified.subject).toBe("user-123");
	});

	test("still rejects a token expired beyond the clock tolerance", async () => {
		let signed = await new JWT({ sub: "user-123", exp: now() - CLOCK_TOLERANCE * 10 }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		await expect(JWT.verify(signed, keys, { clockTolerance: CLOCK_TOLERANCE })).rejects.toThrow();
	});

	test("rejects a token that is not valid yet", async () => {
		let signed = await new JWT({ sub: "user-123", nbf: now() + 600 }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		await expect(JWT.verify(signed, keys)).rejects.toThrow();
		await expect(JWT.verify(signed, keys, { clockTolerance: 1200 })).resolves.toBeDefined();
	});
});

describe("decoding", () => {
	test("reads the claims of a token it cannot verify", async () => {
		let signed = await new JWT({ sub: "user-123", iss: "https://auth.test" }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		await expect(JWT.verify(signed, otherKeys)).rejects.toThrow();

		let decoded = JWT.decode(signed);

		expect(decoded.subject).toBe("user-123");
		expect(decoded.issuer).toBe("https://auth.test");
	});

	test("decodes into the subclass it is called on", async () => {
		let signed = await new JWT({ sub: "user-123", aud: "client-1", email: "ada@test.dev" }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		let decoded = TestToken.decode(signed);

		expect(decoded).toBeInstanceOf(TestToken);
		expect(decoded.email).toBe("ada@test.dev");
	});
});

describe("the verified token, read both ways", () => {
	test("exposes the raw claim set through payload", async () => {
		let signed = await new JWT({ sub: "user-123", nonce: "n-1" }).sign(JWK.Algorithm.ES256, keys);

		let verified = await JWT.verify(signed, keys);

		expect(verified.payload.sub).toBe("user-123");
		expect(verified.payload.nonce).toBe("n-1");
	});

	test("exposes typed accessors when verified through a subclass", async () => {
		let signed = await new JWT({
			sub: "user-123",
			aud: "client-1",
			email: "ada@test.dev",
			email_verified: true,
		}).sign(JWK.Algorithm.ES256, keys);

		let verified = await TestToken.verify(signed, keys);

		expect(verified).toBeInstanceOf(TestToken);
		expect(verified.subject).toBe("user-123");
		expect(verified.email).toBe("ada@test.dev");
		expect(verified.emailVerified).toBe(true);
		expect(verified.payload.sub).toBe("user-123");
	});

	test("throws out of an accessor whose claim is missing", async () => {
		let signed = await new JWT({ sub: "user-123", aud: "client-1" }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		let verified = await TestToken.verify(signed, keys);

		expect(() => verified.email).toThrow('Key "email" does not exist');
	});
});

describe("claims without an accessor", () => {
	test("reads through to the payload by name", () => {
		let token = new JWT({ sub: "user-123", scope: "read write" });

		expect(token.scope).toBe("read write");
	});

	test("answers null instead of undefined for a claim that is absent", () => {
		expect(new JWT({ sub: "user-123" }).scope).toBeNull();
	});

	test("writes an unknown property into the payload so it gets signed", async () => {
		let token = new JWT({ sub: "user-123" });
		token.scope = "read";

		expect(token.payload.scope).toBe("read");

		let signed = await token.sign(JWK.Algorithm.ES256, keys);
		let verified = await JWT.verify(signed, keys);

		expect(verified.payload.scope).toBe("read");
	});
});

describe("registered claim accessors", () => {
	test("read and write the audience in either form", () => {
		let token = new JWT();

		expect(token.audience).toBeNull();

		token.audience = "client-1";
		expect(token.audience).toBe("client-1");
		expect(token.payload.aud).toBe("client-1");

		token.audience = ["client-1", "client-2"];
		expect(token.audience).toEqual(["client-1", "client-2"]);

		token.audience = null;
		expect(token.audience).toBeNull();
	});

	test("convert date-shaped claims to and from epoch seconds", () => {
		let token = new JWT();
		let issued = new Date("2026-01-01T00:00:00.000Z");

		token.issuedAt = issued;
		token.notBefore = issued;

		expect(token.payload.iat).toBe(issued.getTime() / 1000);
		expect(token.payload.nbf).toBe(issued.getTime() / 1000);
	});

	test("read the identifier, issuer, and subject, and answer null when absent", () => {
		let empty = new JWT();

		expect(empty.id).toBeNull();
		expect(empty.issuer).toBeNull();
		expect(empty.subject).toBeNull();
		expect(empty.expirationTime).toBeNull();
		expect(empty.expiresAt).toBeNull();
		expect(empty.issuedAt).toBeNull();
		expect(empty.notBefore).toBeNull();

		let token = new JWT({ jti: "id-1", iss: "https://auth.test", sub: "user-123" });

		expect(token.id).toBe("id-1");
		expect(token.issuer).toBe("https://auth.test");
		expect(token.subject).toBe("user-123");
	});

	test("treat a token with no expiry as not expired", () => {
		expect(new JWT({ sub: "user-123" }).expired).toBe(false);
	});

	test("read `exp` in the seconds the RFC defines, as verification does", () => {
		let token = new JWT({ exp: now() + 3600 });

		expect(token.expiresIn).toBeGreaterThan(3590);
		expect(token.expiresIn).toBeLessThanOrEqual(3600);
		expect(token.expired).toBe(false);
	});

	test("count a past expiry as expired, with the seconds left going negative", () => {
		let token = new JWT({ exp: now() - 10 });

		expect(token.expired).toBe(true);
		expect(token.expiresIn).toBeLessThanOrEqual(-10);
	});

	test("read the expiry as the instant it names", () => {
		let expiry = now() + 3600;

		expect(new JWT({ exp: expiry }).expiresAt?.getTime()).toBe(expiry * 1000);
	});
});

describe("claims written as a length of time", () => {
	test("resolve to that long from now", () => {
		let token = new JWT({ exp: "1h", iat: "1 minute", nbf: "30s" });

		expect(token.payload.exp).toBeCloseTo(now() + 3600, -1);
		expect(token.payload.iat).toBeCloseTo(now() + 60, -1);
		expect(token.payload.nbf).toBeCloseTo(now() + 30, -1);
	});

	test("leave a claim already given as seconds alone", () => {
		let expiry = now() + 3600;

		expect(new JWT({ exp: expiry }).payload.exp).toBe(expiry);
	});

	test("resolve before the claim is read back, so both forms read the same", () => {
		let written = new JWT({ exp: "1h" });
		let computed = new JWT({ exp: now() + 3600 });

		expect(written.expiresIn).toBeCloseTo(computed.expiresIn ?? 0, -1);
		expect(written.expiresAt).toBeInstanceOf(Date);
		expect(written.expired).toBe(false);
	});

	test("keep the claim set the caller passed in when there is nothing to resolve", () => {
		let claims = { sub: "user-123", exp: now() + 60 };

		expect(new JWT(claims).payload).toBe(claims);
	});

	test("copy the claim set when a duration is resolved, leaving the caller's untouched", () => {
		let claims = { sub: "user-123", exp: "1h" } as const;
		let token = new JWT(claims);

		expect(token.payload).not.toBe(claims);
		expect(claims.exp).toBe("1h");
		expect(typeof token.payload.exp).toBe("number");
	});

	test("survive signing and verification as an ordinary expiry", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let signed = await new JWT({ sub: "user-123", exp: "1h" }).sign(JWK.Algorithm.ES256, [pair]);

		let verified = await JWT.verify(signed, [pair], { algorithms: [JWK.Algorithm.ES256] });

		expect(verified.subject).toBe("user-123");
		expect(verified.expiresIn).toBeGreaterThan(3590);
	});

	test("reject a token whose expiry has already passed", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let signed = await new JWT({ sub: "user-123", exp: now() - 60 }).sign(JWK.Algorithm.ES256, [
			pair,
		]);

		await expect(
			JWT.verify(signed, [pair], { algorithms: [JWK.Algorithm.ES256] }),
		).rejects.toThrow();
	});
});

describe("toJSON", () => {
	test("collects the getters the subclass itself declares", async () => {
		let signed = await new JWT({
			sub: "user-123",
			aud: "client-1",
			email: "ada@test.dev",
			email_verified: false,
		}).sign(JWK.Algorithm.ES256, keys);

		let verified = await TestToken.verify(signed, keys);

		expect(verified.toJSON()).toEqual({
			subject: "user-123",
			audience: "client-1",
			email: "ada@test.dev",
			emailVerified: false,
		});
	});
});
