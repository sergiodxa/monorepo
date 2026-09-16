/**
 * Drives the agent credential against the object that enforces it: a real SQLite behind a
 * real Durable Object state, so what is asserted is the row rather than a stub of it.
 *
 * What this file owns is the half of ADR-006 the object decides — that a token is checked
 * against its row on every call with nothing cached in between, that the tier is read live
 * rather than taken from the credential, and that the day's budget is stored rather than
 * held in an isolate that a deploy would reset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import {
	createD1Database,
	createDurableObjectNamespace,
	createDurableObjectState,
	createKVNamespace,
} from "@sdxc/cloudflare-mocks";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import catalogSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { AGENT_DAILY_CALLS, TOKEN_LIFETIME_MS, TOKEN_LIMIT } from "~/database/schema";
import { UserDO } from "~/database/user-do";

/**
 * The bindings the object reads off `cloudflare:workers`. Held behind a hoisted box so each
 * test gets its own namespaces while the `env` every module already captured stays the same
 * object.
 */
let bindings = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("cloudflare:workers", async (importOriginal) => {
	let original = await importOriginal<typeof import("cloudflare:workers")>();

	return {
		...original,
		env: new Proxy(
			{},
			{
				get(_target, property: string) {
					return bindings.current[property] ?? `test-${property}`;
				},
			},
		),
	};
});

const SUBJECT = "sub-agent";

/** A token row's id, spelled the way the minting path spells one. */
const TOKEN_ID = "tok_01j0000000000000000000000";

beforeEach(async () => {
	let catalog = createD1Database();
	await catalog.exec(catalogSql);

	bindings.current = {
		KV: createKVNamespace(),
		PLATFORM_DB: catalog,
		FEED: createDurableObjectNamespace(() => ({})),
	};
});

afterEach(() => vi.useRealTimers());

/** Builds a reader's object and waits out the boot, the way a first request would. */
async function createReader(
	state = createDurableObjectState({ name: SUBJECT }),
): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);

	return { state, user };
}

/** Puts a reader on a tier, which is the one column every entitlement check reads. */
function setTier(state: DurableObjectStateMock, tier: string): void {
	state.storage.sql.exec(
		`INSERT INTO settings (id, subject, tier, created_at, updated_at)
		 VALUES (1, ?, ?, 0, 0)
		 ON CONFLICT (id) DO UPDATE SET tier = excluded.tier`,
		SUBJECT,
		tier,
	);
}

/** Writes a token row directly, for the states the minting path cannot produce. */
function seedToken(
	state: DurableObjectStateMock,
	overrides: {
		id?: string;
		scope?: string;
		expiresAt?: number;
		revokedAt?: number | null;
		lastUsedAt?: number | null;
	} = {},
): string {
	let id = overrides.id ?? TOKEN_ID;

	state.storage.sql.exec(
		`INSERT INTO tokens (id, name, scope, hash, created_at, last_used_at, expires_at, revoked_at)
		 VALUES (?, 'Laptop', ?, 'digest', 0, ?, ?, ?)`,
		id,
		overrides.scope ?? "read",
		overrides.lastUsedAt ?? null,
		overrides.expiresAt ?? Date.now() + TOKEN_LIFETIME_MS,
		overrides.revokedAt ?? null,
	);

	return id;
}

describe("authorizeAgent", () => {
	test("answers a signed value naming a row this reader never had", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");

		expect(await user.authorizeAgent(TOKEN_ID)).toEqual({ ok: false, reason: "unknown-token" });
	});

	test("answers what a live token may do, and what the account is on", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");
		seedToken(state, { scope: "write" });

		expect(await user.authorizeAgent(TOKEN_ID)).toEqual({
			ok: true,
			scope: "write",
			tier: "paid",
		});
	});

	/** The row is the only place the answer is read from, so there is nothing to invalidate. */
	test("refuses a revoked token on the very next call", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");
		seedToken(state);

		expect((await user.authorizeAgent(TOKEN_ID)).ok).toBe(true);

		await user.revokeAgentToken(TOKEN_ID);

		expect(await user.authorizeAgent(TOKEN_ID)).toEqual({ ok: false, reason: "revoked" });
	});

	test("tells an expired token apart from a revoked one", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");
		seedToken(state, { expiresAt: Date.now() - 1 });

		expect(await user.authorizeAgent(TOKEN_ID)).toEqual({ ok: false, reason: "expired" });
	});

	/**
	 * Never from the token: one minted while paid would otherwise keep working for a year
	 * after a cancellation, which is a year of free service granted by a caching decision.
	 */
	test("refuses an account whose plan no longer answers an agent", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");
		seedToken(state);

		expect((await user.authorizeAgent(TOKEN_ID)).ok).toBe(true);

		setTier(state, "free");

		expect(await user.authorizeAgent(TOKEN_ID)).toEqual({ ok: false, reason: "tier" });
	});

	test("stamps a use at most hourly, so a call costs no write of its own", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");
		seedToken(state);

		await user.authorizeAgent(TOKEN_ID);
		let [first] = await user.listAgentTokens();
		expect(first?.lastUsedAt).not.toBeNull();

		await user.authorizeAgent(TOKEN_ID);
		let [second] = await user.listAgentTokens();
		expect(second?.lastUsedAt).toBe(first?.lastUsedAt);
	});
});

describe("the daily budget", () => {
	test("refuses the call after the last one the day allows", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");
		seedToken(state);

		for (let spent = 0; spent < AGENT_DAILY_CALLS; spent++) {
			expect((await user.authorizeAgent(TOKEN_ID)).ok, `call ${spent + 1}`).toBe(true);
		}

		expect(await user.authorizeAgent(TOKEN_ID)).toEqual({ ok: false, reason: "budget" });
	});

	/**
	 * The count is rows of the reader's own database rather than a counter in an isolate, so
	 * a deploy, an eviction or a second location does not hand the day's budget back.
	 */
	test("keeps the count when the object is built again", async () => {
		let state = createDurableObjectState({ name: SUBJECT });
		let first = await createReader(state);
		setTier(state, "paid");
		seedToken(state);

		for (let spent = 0; spent < AGENT_DAILY_CALLS; spent++) {
			await first.user.authorizeAgent(TOKEN_ID);
		}

		let again = await createReader(state);

		expect(await again.user.authorizeAgent(TOKEN_ID)).toEqual({ ok: false, reason: "budget" });
	});

	/**
	 * A counter that cannot answer should not sign every agent out, so an unreadable budget
	 * lets the call through and the burst limiter in front of it keeps the loop bounded.
	 */
	test("lets a call through when the counter cannot answer", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");
		seedToken(state);

		state.storage.sql.exec(`DROP TABLE rate_limit_hits`);

		expect((await user.authorizeAgent(TOKEN_ID)).ok).toBe(true);
	});

	/** Each token has a budget of its own, so one agent cannot spend another's. */
	test("counts each token apart", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");
		seedToken(state);
		let other = seedToken(state, { id: "tok_second" });

		for (let spent = 0; spent < AGENT_DAILY_CALLS; spent++) {
			await user.authorizeAgent(TOKEN_ID);
		}

		expect((await user.authorizeAgent(other)).ok).toBe(true);
	});
});

describe("minting", () => {
	/** The cap is enforced where every path reaches, rather than beside the form. */
	test("refuses an account whose plan does not answer an agent", async () => {
		let { state, user } = await createReader();
		setTier(state, "free");

		expect(await user.createAgentToken(draft())).toEqual({ ok: false, reason: "not-entitled" });
	});

	test("refuses a token with no name to recognize it by", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");

		expect(await user.createAgentToken(draft({ name: "   " }))).toEqual({
			ok: false,
			reason: "invalid-name",
		});
	});

	test("refuses a scope the column would refuse", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");

		expect(await user.createAgentToken(draft({ scope: "admin" }))).toEqual({
			ok: false,
			reason: "invalid-scope",
		});
	});

	test("refuses the one past the cap, naming how many that is", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");

		for (let held = 0; held < TOKEN_LIMIT; held++) {
			expect((await user.createAgentToken(draft({ id: `tok_${held}` }))).ok).toBe(true);
		}

		expect(await user.createAgentToken(draft({ id: "tok_over" }))).toEqual({
			ok: false,
			reason: "token-limit",
			allowed: TOKEN_LIMIT,
		});
	});

	/** A revoked row stays for the reader to see, and stops counting against the cap. */
	test("makes room again once one is revoked", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");

		for (let held = 0; held < TOKEN_LIMIT; held++) {
			await user.createAgentToken(draft({ id: `tok_${held}` }));
		}

		await user.revokeAgentToken("tok_0");

		expect((await user.createAgentToken(draft({ id: "tok_new" }))).ok).toBe(true);
		expect(await user.listAgentTokens()).toHaveLength(TOKEN_LIMIT + 1);
	});

	test("expires a token a year out", async () => {
		let { state, user } = await createReader();
		setTier(state, "paid");

		let written = await user.createAgentToken(draft());
		if (!written.ok) throw new Error("the token was refused");

		expect(written.token.expiresAt - written.token.createdAt).toBe(TOKEN_LIFETIME_MS);
	});

	test("refuses to revoke a token this reader does not hold", async () => {
		let { user } = await createReader();

		expect(await user.revokeAgentToken("tok_absent")).toEqual({ ok: false, reason: "not-found" });
	});
});

/** One submitted token, with whatever a case is about overridden. */
function draft(overrides: { id?: string; name?: string; scope?: string } = {}) {
	return {
		id: overrides.id ?? TOKEN_ID,
		name: overrides.name ?? "Laptop assistant",
		scope: overrides.scope ?? "read",
		hash: "digest",
	};
}
