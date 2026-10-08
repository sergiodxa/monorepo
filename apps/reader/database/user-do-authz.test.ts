/**
 * Drives the reader's object through the policy it binds: the tier its row leases as the
 * role, the switches as guards evaluated for this reader, and an agent token's scope as
 * the ceiling. Every refusal is asserted as the plain code the RPC boundary carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import {
	createDurableObjectNamespace,
	createDurableObjectState,
	createKVNamespace,
} from "@sdxc/cloudflare-mocks";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Tier } from "~/app/lib/entitlement";
import type { FeedDO } from "~/database/feed-do";

import { restoreFlags, serveFlags } from "~/app/lib/test/flags";
import { UserDO } from "~/database/user-do";

/**
 * The bindings the modules under test read off `cloudflare:workers`. Nothing here follows a
 * feed, so the only ones that answer are the KV heads are read from and a feed object that
 * accepts every unsubscribe.
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

const FEED_ID = "feed-1";
const ITEM_ID = "post-1";
const DAY_MS = 24 * 60 * 60 * 1000;

/** A rule every plan that writes rules accepts, so a refusal is about the plan or the switch. */
const RULE = { field: "title", value: "sponsored", action: "drop" };

beforeEach(async () => {
	bindings.current = {
		KV: createKVNamespace(),
		FEED: createDurableObjectNamespace<FeedDO>(() => ({
			async unsubscribe(): Promise<{ remaining: boolean }> {
				return { remaining: false };
			},
		})),
	};
	await restoreFlags();
});

afterEach(async () => {
	await restoreFlags();
});

/**
 * Builds a reader's object on a tier, holding one subscription with one post with an
 * address, which is what keeping, labelling and opening a post need.
 */
async function createReader(tier: Tier): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let state = createDurableObjectState({ name: `sub-${crypto.randomUUID()}` });
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);

	if (tier !== "free") {
		await user.setTier({ entitled: tier, cancelled: false, readAt: Date.now(), source: "billing" });
	}

	state.storage.sql.exec(
		`INSERT INTO feeds
			(id, feed_id, feed_url, site_url, title, description, language, image_url,
			 cursor, velocity, unfollowed_at, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, 0, 'evergreen', NULL, 0, 0)`,
		FEED_ID,
		`canonical-${FEED_ID}`,
		`https://${FEED_ID}.example.com/feed.xml`,
		FEED_ID,
	);
	state.storage.sql.exec(
		`INSERT INTO feed_items
			(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
			 created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, 0, 0)`,
		ITEM_ID,
		FEED_ID,
		ITEM_ID,
		ITEM_ID,
		"https://example.com/post",
		DAY_MS,
	);

	return { state, user };
}

/** Writes a token row the way minting does, answering its id. */
async function mint(user: UserDO, scope: "read" | "write"): Promise<string> {
	let id = `tok_${crypto.randomUUID()}`;
	let minted = await user.createAgentToken({ id, name: "agent", scope, hash: "digest" });
	if (!minted.ok) throw new Error(`minting failed: ${minted.reason}`);

	return id;
}

describe("the plan a reader's tier carries", () => {
	test("refuses labels and rules on the free tier as not entitled", async () => {
		let { user } = await createReader("free");

		expect(await user.createTag("Rust")).toEqual({ ok: false, reason: "not-entitled" });
		expect(await user.createRule(RULE)).toEqual({ ok: false, reason: "not-entitled" });
		expect(await user.createAgentToken({ id: "t", name: "a", scope: "read", hash: "h" })).toEqual({
			ok: false,
			reason: "not-entitled",
		});
	});

	test("hands a page every claim as plain booleans", async () => {
		let { user } = await createReader("paid");

		expect((await user.entitlement()).can).toEqual({
			posts: { keep: true },
			tags: { label: true },
			rules: { write: true, apply: true },
			articles: { extract: true },
			digests: { email: false },
			agent: { connect: true, write: true },
		});
	});

	test("refuses email outside the Premium plan and accepts it on it", async () => {
		let paid = await createReader("paid");
		let premium = await createReader("premium");

		expect(await paid.user.setChannels({ push: false, email: true })).toEqual({
			ok: false,
			reason: "not-entitled",
		});
		expect((await paid.user.notifications()).emailAllowed).toBe(false);
		expect(await premium.user.setChannels({ push: false, email: true })).toMatchObject({
			ok: true,
		});
	});

	/**
	 * The role is the tier the row leases, so a lapse whose window ran out stops what the
	 * plan sold before any snapshot arrives to lower the stored tier.
	 */
	test("decides from the leased tier once a lapse's window has run out", async () => {
		let { state, user } = await createReader("paid");
		state.storage.sql.exec("UPDATE settings SET grace_until = ?", Date.now() - DAY_MS);

		expect(await user.createTag("Rust")).toEqual({ ok: false, reason: "not-entitled" });
		expect((await user.entitlement()).can.tags.label).toBe(false);
	});

	test("keeps everything the plan sold through an open lapse window", async () => {
		let { state, user } = await createReader("paid");
		state.storage.sql.exec("UPDATE settings SET grace_until = ?", Date.now() + DAY_MS);

		expect(await user.createTag("Rust")).toMatchObject({ ok: true });
	});
});

describe("a switch turned off", () => {
	test("refuses labels on a paid plan as switched off", async () => {
		let { user } = await createReader("paid");
		await serveFlags({ tags: false });

		expect(await user.createTag("Rust")).toEqual({ ok: false, reason: "switched-off" });
		expect(await user.tagItem(ITEM_ID, { name: "Rust" })).toEqual({
			ok: false,
			reason: "switched-off",
		});
		expect((await user.entitlement()).can.tags.label).toBe(false);
	});

	test("refuses writing and applying rules as switched off", async () => {
		let { user } = await createReader("paid");
		await serveFlags({ "filter-rules": false });

		expect(await user.createRule(RULE)).toEqual({ ok: false, reason: "switched-off" });
		expect(await user.applyPreviewedRule(RULE)).toEqual({ ok: false, reason: "switched-off" });
	});

	test("refuses keeping a post, and lets a kept one go", async () => {
		let { user } = await createReader("free");
		expect(await user.saveItem(ITEM_ID, true)).toEqual({ ok: true, saved: true });

		await serveFlags({ "saved-posts": false });

		expect(await user.saveItem(ITEM_ID, false)).toEqual({ ok: true, saved: false });
		expect(await user.saveItem(ITEM_ID, true)).toEqual({ ok: false, reason: "switched-off" });
	});

	/** Labelling keeps the post, so a shelf switched off refuses the label for that reason. */
	test("refuses a label that would keep a post while keeping is off", async () => {
		let { user } = await createReader("paid");
		await serveFlags({ "saved-posts": false });

		expect(await user.tagItem(ITEM_ID, { name: "Rust" })).toEqual({
			ok: false,
			reason: "switched-off",
		});
	});

	test("tells extraction the plan carries apart from extraction switched off", async () => {
		let paid = await createReader("paid");
		let free = await createReader("free");

		expect(await paid.user.openPost(ITEM_ID)).toMatchObject({ fullText: true, extract: true });
		expect(await free.user.openPost(ITEM_ID)).toMatchObject({ fullText: false, extract: false });

		await serveFlags({ "article-extraction": false });

		expect(await paid.user.openPost(ITEM_ID)).toMatchObject({ fullText: true, extract: false });
	});
});

describe("an agent token", () => {
	test("never writes past a read scope, nor past its holder's plan", async () => {
		let { user } = await createReader("paid");
		let reading = await mint(user, "read");
		let writing = await mint(user, "write");

		expect(await user.authorizeAgent(reading)).toMatchObject({
			ok: true,
			scope: "read",
			may: { connect: true, write: false },
		});
		expect(await user.authorizeAgent(writing)).toMatchObject({
			ok: true,
			scope: "write",
			may: { connect: true, write: true },
		});
	});

	test("stops answering once the holder's lease runs out", async () => {
		let { state, user } = await createReader("paid");
		let writing = await mint(user, "write");
		state.storage.sql.exec("UPDATE settings SET grace_until = ?", Date.now() - DAY_MS);

		expect(await user.authorizeAgent(writing)).toEqual({ ok: false, reason: "tier" });
	});
});
