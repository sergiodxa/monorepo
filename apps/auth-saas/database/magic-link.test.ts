/**
 * Drives the tenant Durable Object's `beginMagicLinkSignIn`, `completeMagicLinkSignIn`
 * and `cancelMagicLinkAttempt` RPC methods the way `device-authorization.test.ts`
 * drives its own, through a real `Tenant` object rather than the module directly,
 * since all three are wired on as RPC methods.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure } from "@sdxc/result";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { magicLinkAttempts } from "./magic-link";
import Tenant from "./tenant-do";

const ISSUER = "https://tenant.example.com";

let state: DurableObjectStateMock;
let tenant: Tenant;
let db: Database;

beforeEach(async () => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
	await tenant.provision({ tenantId: "tenant_1", issuer: ISSUER });
	db = new Database(createSQLStorageDatabaseAdapter(state.storage.sql));
});

/** Hashes a nonce the same way `beginMagicLinkSignIn`'s caller and `completeMagicLinkSignIn` itself do. */
async function hashNonce(nonce: string): Promise<string> {
	let hashed = await sha256(nonce);
	if (isFailure(hashed)) throw new Error("unreachable: nonce hashing failed");
	return Hex.encode(hashed.data);
}

/** A fresh raw nonce and the hash `beginMagicLinkSignIn` is given in its place. */
async function freshNonce(): Promise<{ nonce: string; hash: string }> {
	let nonce = randomToken({ bytes: 32 });
	return { nonce, hash: await hashNonce(nonce) };
}

/** Creates a subject with a verified email, ready for a magic link to resolve. */
async function createVerifiedSubject(email: string): Promise<string> {
	let created = await tenant.createSubject({ identifiers: [{ kind: "email", value: email }] });
	if (!created.ok) throw new Error("unreachable: subject creation failed");

	let added = await tenant.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});
	if (!added.ok || added.kind !== "email") throw new Error("unreachable: identifier add failed");

	await tenant.verifyIdentifier({ ticket: added.ticket });

	return created.subjectId;
}

describe("beginMagicLinkSignIn / completeMagicLinkSignIn: link", () => {
	test("a full request-then-link-complete round trip for a known verified address opens a session", async () => {
		let subjectId = await createVerifiedSubject("ada@example.com");
		let { nonce, hash } = await freshNonce();
		let now = Date.now();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "ada@example.com",
			browserNonceHash: hash,
			at: now,
		});
		expect(begun.message).toBe("sign_in");
		if (begun.message !== "sign_in") throw new Error("unreachable");

		let completed = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begun.token },
			browserNonce: nonce,
			at: now + 1000,
		});

		expect(completed).toMatchObject({
			outcome: "signed_in",
			subjectId,
			secondFactorRequired: false,
		});
		if (completed.outcome !== "signed_in") throw new Error("unreachable");
		expect(typeof completed.token).toBe("string");
	});

	test("hands back the resume destination named on the request, not anything the completion call supplies", async () => {
		await createVerifiedSubject("katherine@example.com");
		let { nonce, hash } = await freshNonce();
		let now = Date.now();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "katherine@example.com",
			browserNonceHash: hash,
			interactionId: "int_stored_on_request",
			at: now,
		});
		if (begun.message !== "sign_in") throw new Error("unreachable");

		let completed = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begun.token },
			browserNonce: nonce,
			at: now + 1000,
		});
		if (completed.outcome !== "signed_in") throw new Error("unreachable");

		expect(completed.interactionId).toBe("int_stored_on_request");
		expect(completed.returnTo).toBeNull();
	});

	test("a link token presented with the wrong browser nonce answers wrong_browser and does not consume the row; a subsequent correct-nonce attempt still succeeds", async () => {
		await createVerifiedSubject("grace@example.com");
		let { nonce, hash } = await freshNonce();
		let now = Date.now();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "grace@example.com",
			browserNonceHash: hash,
			at: now,
		});
		if (begun.message !== "sign_in") throw new Error("unreachable");

		let wrongBrowser = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begun.token },
			browserNonce: "not-the-bound-nonce",
			at: now + 1000,
		});
		expect(wrongBrowser).toMatchObject({ outcome: "wrong_browser" });

		let completed = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begun.token },
			browserNonce: nonce,
			at: now + 2000,
		});
		expect(completed).toMatchObject({ outcome: "signed_in" });
	});

	test("a second completion of the same token answers invalid", async () => {
		await createVerifiedSubject("alan@example.com");
		let { nonce, hash } = await freshNonce();
		let now = Date.now();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "alan@example.com",
			browserNonceHash: hash,
			at: now,
		});
		if (begun.message !== "sign_in") throw new Error("unreachable");

		let first = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begun.token },
			browserNonce: nonce,
			at: now + 1000,
		});
		expect(first).toMatchObject({ outcome: "signed_in" });

		let second = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begun.token },
			browserNonce: nonce,
			at: now + 2000,
		});
		expect(second).toMatchObject({ outcome: "invalid" });
	});

	test("closes the consumption race: two simultaneous completions of the same token, exactly one succeeds", async () => {
		await createVerifiedSubject("hedy@example.com");
		let { nonce, hash } = await freshNonce();
		let now = Date.now();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "hedy@example.com",
			browserNonceHash: hash,
			at: now,
		});
		if (begun.message !== "sign_in") throw new Error("unreachable");

		let [first, second] = await Promise.all([
			tenant.completeMagicLinkSignIn({
				credential: { kind: "link", token: begun.token },
				browserNonce: nonce,
				at: now + 1000,
			}),
			tenant.completeMagicLinkSignIn({
				credential: { kind: "link", token: begun.token },
				browserNonce: nonce,
				at: now + 1000,
			}),
		]);

		let outcomes = [first.outcome, second.outcome].sort();
		expect(outcomes).toEqual(["invalid", "signed_in"]);
	});

	test("a new request supersedes an outstanding one for the same address: the old token and code stop working", async () => {
		await createVerifiedSubject("margaret@example.com");
		let first = await freshNonce();
		let now = Date.now();

		let begunFirst = await tenant.beginMagicLinkSignIn({
			address: "margaret@example.com",
			browserNonceHash: first.hash,
			at: now,
		});
		if (begunFirst.message !== "sign_in") throw new Error("unreachable");

		let second = await freshNonce();
		let begunSecond = await tenant.beginMagicLinkSignIn({
			address: "margaret@example.com",
			browserNonceHash: second.hash,
			at: now + 1000,
		});
		if (begunSecond.message !== "sign_in") throw new Error("unreachable");

		let staleToken = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begunFirst.token },
			browserNonce: first.nonce,
			at: now + 2000,
		});
		expect(staleToken).toMatchObject({ outcome: "invalid" });

		let staleCode = await tenant.completeMagicLinkSignIn({
			credential: { kind: "code", code: begunFirst.code },
			browserNonce: first.nonce,
			at: now + 2000,
		});
		expect(staleCode).toMatchObject({ outcome: "invalid" });

		let freshCompletion = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begunSecond.token },
			browserNonce: second.nonce,
			at: now + 3000,
		});
		expect(freshCompletion).toMatchObject({ outcome: "signed_in" });
	});
});

describe("beginMagicLinkSignIn / completeMagicLinkSignIn: code", () => {
	test("a full request-then-code-complete round trip for a known verified address opens a session", async () => {
		let subjectId = await createVerifiedSubject("katherine@example.com");
		let { nonce, hash } = await freshNonce();
		let now = Date.now();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "katherine@example.com",
			browserNonceHash: hash,
			at: now,
		});
		if (begun.message !== "sign_in") throw new Error("unreachable");

		let completed = await tenant.completeMagicLinkSignIn({
			credential: { kind: "code", code: begun.code },
			browserNonce: nonce,
			at: now + 1000,
		});

		expect(completed).toMatchObject({
			outcome: "signed_in",
			subjectId,
			secondFactorRequired: false,
		});
	});

	test("a wrong code decrements attemptsLeft, and the fifth wrong guess destroys the attempt", async () => {
		await createVerifiedSubject("dorothy@example.com");
		let { nonce, hash } = await freshNonce();
		let now = Date.now();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "dorothy@example.com",
			browserNonceHash: hash,
			at: now,
		});
		if (begun.message !== "sign_in") throw new Error("unreachable");

		let wrongCode = begun.code === "0000-0000" ? "1111-1111" : "0000-0000";

		for (let expected of [4, 3, 2, 1, 0]) {
			let attempt = await tenant.completeMagicLinkSignIn({
				credential: { kind: "code", code: wrongCode },
				browserNonce: nonce,
				at: now + 1000,
			});
			expect(attempt).toMatchObject({ outcome: "bad_code", attemptsLeft: expected });
		}

		let afterDestroyed = await tenant.completeMagicLinkSignIn({
			credential: { kind: "code", code: begun.code },
			browserNonce: nonce,
			at: now + 2000,
		});
		expect(afterDestroyed).toMatchObject({ outcome: "invalid" });
	});
});

describe("beginMagicLinkSignIn: unresolved addresses", () => {
	test("an unknown address with just-in-time creation off answers no_account, minting an uncompletable attempt so the write costs the same as a known address", async () => {
		let { hash } = await freshNonce();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "nobody@example.com",
			browserNonceHash: hash,
		});

		expect(begun).toMatchObject({ message: "no_account" });

		let rows = await db.findMany(magicLinkAttempts, { where: { address: "nobody@example.com" } });
		expect(rows).toHaveLength(1);
		expect(rows[0]?.subject_id).toBeNull();
		expect(rows[0]?.completable).toBe(false);
	});

	test("an attempt minted uncompletable can never complete, even against its own real credential", async () => {
		let { nonce, hash } = await freshNonce();
		let token = "not-a-real-secret-just-a-fixed-value";
		let tokenHashed = await sha256(token);
		if (isFailure(tokenHashed)) throw new Error("unreachable: token hashing failed");

		await db.create(magicLinkAttempts, {
			id: "mlnk_uncompletable_test",
			address: "nobody@example.com",
			subject_id: null,
			locale: null,
			token_hash: Hex.encode(tokenHashed.data),
			code_hash: "unused",
			browser_nonce_hash: hash,
			attempts_remaining: 5,
			expires_at: Date.now() + 10 * 60 * 1000,
			consumed_at: null,
			created_at: Date.now(),
			completable: false,
			interaction_id: null,
			return_to: null,
		});

		let completed = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token },
			browserNonce: nonce,
		});

		expect(completed).toMatchObject({ outcome: "invalid" });
	});

	test("an unknown address with just-in-time creation on mints an attempt and, on completion, creates a new verified subject and opens a session for it", async () => {
		await tenant.setMagicLinkJitSubjectCreation({ enabled: true });

		let { nonce, hash } = await freshNonce();
		let now = Date.now();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "hopper@example.com",
			browserNonceHash: hash,
			at: now,
		});
		expect(begun.message).toBe("sign_in");
		if (begun.message !== "sign_in") throw new Error("unreachable");

		let completed = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begun.token },
			browserNonce: nonce,
			at: now + 1000,
		});
		expect(completed).toMatchObject({ outcome: "signed_in" });
		if (completed.outcome !== "signed_in") throw new Error("unreachable");

		let described = await tenant.describeSubject({
			subjectId: completed.subjectId,
			audience: { kind: "subject" },
		});
		expect(described.ok).toBe(true);
		if (!described.ok) throw new Error("unreachable");

		let identifier = described.identifiers.find((entry) => entry.value === "hopper@example.com");
		expect(identifier?.verified).toBe(true);
	});
});

describe("beginMagicLinkSignIn: rate limiting", () => {
	// An address nothing else has ever touched, so neither budget carries a spend
	// from anywhere but this test's own calls — both budgets are checked and spent
	// before this module ever resolves whether the address matches a subject, so a
	// never-registered address demonstrates the refusal exactly as a known one would.
	let address = "shannon@example.com";

	test("the object-level burst budget and the mail envelope both refuse uniformly, with no distinguishing reason", async () => {
		let { hash } = await freshNonce();
		let now = Date.now();

		// Spends the burst budget (3 per 15 minutes) down to its ceiling.
		for (let i = 0; i < 3; i++) {
			let begun = await tenant.beginMagicLinkSignIn({ address, browserNonceHash: hash, at: now });
			expect(begun.message).toBe("no_account");
		}

		let burstRefused = await tenant.beginMagicLinkSignIn({
			address,
			browserNonceHash: hash,
			at: now,
		});
		expect(burstRefused.message).toBe("none");
		expect(Object.keys(burstRefused).sort()).toEqual(["cost", "message", "retryAfterSeconds"]);

		// The burst window resets after fifteen minutes; the mail envelope's hourly
		// window does not, so two more sends land on its own ceiling instead.
		let afterBurstReset = now + 15 * 60 * 1000;

		for (let i = 0; i < 2; i++) {
			let begun = await tenant.beginMagicLinkSignIn({
				address,
				browserNonceHash: hash,
				at: afterBurstReset,
			});
			expect(begun.message).toBe("no_account");
		}

		let envelopeRefused = await tenant.beginMagicLinkSignIn({
			address,
			browserNonceHash: hash,
			at: afterBurstReset,
		});
		expect(envelopeRefused.message).toBe("none");
		expect(Object.keys(envelopeRefused).sort()).toEqual(["cost", "message", "retryAfterSeconds"]);
	});
});

describe("cancelMagicLinkAttempt", () => {
	test("abandons the outstanding attempt the browser's own nonce names", async () => {
		await createVerifiedSubject("radia@example.com");
		let { nonce, hash } = await freshNonce();
		let now = Date.now();

		let begun = await tenant.beginMagicLinkSignIn({
			address: "radia@example.com",
			browserNonceHash: hash,
			at: now,
		});
		if (begun.message !== "sign_in") throw new Error("unreachable");

		await tenant.cancelMagicLinkAttempt({ browserNonce: nonce, at: now + 1000 });

		let completed = await tenant.completeMagicLinkSignIn({
			credential: { kind: "link", token: begun.token },
			browserNonce: nonce,
			at: now + 2000,
		});
		expect(completed).toMatchObject({ outcome: "invalid" });
	});
});
