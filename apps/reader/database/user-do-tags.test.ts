/**
 * Drives labels and pins against the object that owns them: a real SQLite, the reader's
 * own rows, and every refusal answered as the discriminated union the RPC boundary speaks.
 *
 * What is asserted here is this ADR's side of the object — that a label's list pages by the
 * same keyset the reading queue does and reads no row belonging to another label, that
 * labelling keeps the post and is refused for the same reason keeping it is, that the four
 * caps refuse rather than evict, that renaming writes one row and leaves every join row
 * alone, that no path that deletes a post leaves a label behind, and that a pin changes
 * nothing about the queue beneath it.
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
import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { FeedDO } from "~/database/feed-do";
import type { UserStore } from "~/database/user-do";

import { limitsOf } from "~/app/lib/entitlement";
import { FLAG_SET, flags } from "~/app/lib/flags";
import { PIN_LIMIT, TAG_LIMIT, TAGS_PER_ITEM } from "~/database/schema";
import { UserDO } from "~/database/user-do";

/**
 * The bindings the modules under test read off `cloudflare:workers`. Nothing here follows a
 * feed, so the only one that answers is the KV the freshness check reads heads out of; the
 * rest keep the placeholder the test project installs.
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

/** The tier labels are sold under, which every test here takes a snapshot to reach. */
const PAID = "paid";

/** How many posts the paid shelf holds, which is the cap labelling is held to. */
const SAVED_LIMIT = limitsOf(PAID).saved;

const FEED_ID = "feed-1";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Narrows the reader's budget, through the flag that scales it.
 *
 * The shipped figure is over a million posts, and materializing a million rows would test
 * the number rather than the rule. The rule under test — that a reclamation leaves no label
 * behind — is the same rule at either figure.
 *
 * @param posts - Roughly what the object may hold before it reclaims.
 */
async function setBudget(posts: number): Promise<void> {
	let scale = posts / limitsOf(PAID).posts;

	await flags.setProvider(
		new EngineProvider(
			createEngine({
				store: new InMemoryFlagStore({
					flags: {
						...FLAG_SET.flags,
						"reader-budget-scale": {
							variants: { standard: scale },
							defaultVariant: "standard",
						},
					},
				}),
			}),
		),
	);
}

/**
 * The feed object as this file needs it, which is only what unfollowing tells it. Nothing
 * here follows a feed, so nothing here has a document to fetch or a page to synchronize.
 */
function feedStub() {
	return {
		async unsubscribe(): Promise<{ remaining: boolean }> {
			return { remaining: false };
		},
	};
}

beforeEach(async () => {
	bindings.current = {
		KV: createKVNamespace(),
		FEED: createDurableObjectNamespace<FeedDO>(() => feedStub()),
	};
	await flags.setProvider(
		new EngineProvider(createEngine({ store: new InMemoryFlagStore(FLAG_SET) })),
	);
});

/**
 * Builds a reader's object, waits out the boot the way a first request would, and puts them
 * on the tier labels are sold under.
 */
async function createReader(
	subject = `sub-${crypto.randomUUID()}`,
): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let state = createDurableObjectState({ name: subject });
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);

	await user.setTier({ entitled: PAID, cancelled: false, readAt: Date.now(), source: "billing" });

	return { state, user };
}

/** One subscription row, written straight into storage for a test that follows nothing. */
function seedFeed(state: DurableObjectStateMock, id: string, title = id): void {
	state.storage.sql.exec(
		`INSERT INTO feeds
			(id, feed_id, feed_url, site_url, title, description, language, image_url,
			 cursor, velocity, unfollowed_at, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, 0, 'evergreen', NULL, 0, 0)`,
		id,
		`canonical-${id}`,
		`https://${id}.example.com/feed.xml`,
		title,
	);
}

/** Posts of one subscription, written straight into storage. */
function seedItems(
	state: DurableObjectStateMock,
	subscriptionId: string,
	posts: readonly { id: string; publishedAt: number; readAt?: number; savedAt?: number }[],
): void {
	for (let post of posts) {
		state.storage.sql.exec(
			`INSERT INTO feed_items
				(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
				 created_at, updated_at)
			 VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, 0, 0)`,
			post.id,
			subscriptionId,
			post.id,
			post.id,
			post.publishedAt,
			post.readAt ?? null,
			post.savedAt ?? null,
		);
	}
}

/**
 * A run of posts a day apart, newest last, written into one subscription.
 *
 * @param count - How many to write.
 */
function seedRun(
	state: DurableObjectStateMock,
	subscriptionId: string,
	count: number,
	prefix = "post",
): string[] {
	let ids = Array.from({ length: count }, (_value, order) => `${prefix}-${order}`);

	seedItems(
		state,
		subscriptionId,
		ids.map((id, order) => ({ id, publishedAt: (order + 1) * DAY_MS })),
	);

	return ids;
}

/** The ids of one page, which is what ordering and stability assertions compare. */
function ids(result: UserStore.TimelineResult): string[] {
	if (!result.ok) throw new Error(`expected a page, got ${result.reason}`);
	return result.items.map((item) => item.id);
}

/** Every join row the object holds, as `tag_id:item_id`. */
function joinRows(state: DurableObjectStateMock): string[] {
	return state.storage.sql
		.exec<{ tag_id: string; item_id: string }>(
			"SELECT tag_id, item_id FROM item_tags ORDER BY tag_id, item_id",
		)
		.toArray()
		.map((row) => `${row.tag_id}:${row.item_id}`);
}

/** Join rows naming a post the object no longer holds, which must always be none. */
function orphanedRows(state: DurableObjectStateMock): string[] {
	return state.storage.sql
		.exec<{ item_id: string }>(
			`SELECT item_id FROM item_tags
			 WHERE item_id NOT IN (SELECT id FROM feed_items)`,
		)
		.toArray()
		.map((row) => row.item_id);
}

/** The label a name resolves to, for a test that is about something else. */
async function makeTag(user: UserDO, name: string): Promise<UserStore.Tag> {
	let created = await user.createTag(name);
	if (!created.ok) throw new Error(`creating ${name} failed: ${created.reason}`);

	return created.tag;
}

describe("a label's own list", () => {
	test("pages by keyset and mints the cursor shape every other list mints", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);

		let posts = seedRun(state, FEED_ID, 5);
		let tag = await makeTag(user, "Rust");
		for (let id of posts) await user.tagItem(id, { tagId: tag.id });

		let first = await user.taggedQueue(tag.id, { limit: 2 });
		if (!first.ok) throw new Error("expected a page");

		expect(ids(first)).toEqual(["post-4", "post-3"]);
		expect(first.cursors.next).not.toBeNull();

		let second = await user.taggedQueue(tag.id, { cursor: first.cursors.next, limit: 2 });
		expect(ids(second)).toEqual(["post-2", "post-1"]);

		// The cursor a label's page mints is the one the reading queue follows, which is the
		// whole reason the page seeks the join table's copies and projects the post's own
		// columns under their own names.
		let queue = await user.readingQueue({ cursor: first.cursors.next, readState: "all", limit: 2 });
		expect(ids(queue)).toEqual(["post-2", "post-1"]);
	});

	test("reads no post belonging to another label", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 4);

		let rust = await makeTag(user, "Rust");
		let cooking = await makeTag(user, "Cooking");

		await user.tagItem("post-0", { tagId: rust.id });
		await user.tagItem("post-2", { tagId: rust.id });
		await user.tagItem("post-1", { tagId: cooking.id });
		await user.tagItem("post-3", { tagId: cooking.id });

		expect(ids(await user.taggedQueue(rust.id))).toEqual(["post-2", "post-0"]);
		expect(ids(await user.taggedQueue(cooking.id))).toEqual(["post-3", "post-1"]);
	});

	/**
	 * The predicate a page was minted under is the predicate the next page runs, so what
	 * happens to other posts between two pages cannot move this label's own.
	 */
	test("stays stable across pages while other posts are saved, labelled and unsaved", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);

		let posts = seedRun(state, FEED_ID, 6);
		let rust = await makeTag(user, "Rust");
		for (let id of posts) await user.tagItem(id, { tagId: rust.id });

		seedRun(state, FEED_ID, 3, "other");

		let first = await user.taggedQueue(rust.id, { limit: 3 });

		let cooking = await makeTag(user, "Cooking");
		await user.tagItem("other-0", { tagId: cooking.id });
		await user.saveItem("other-1", true);
		await user.saveItem("other-1", false);

		let second = await user.taggedQueue(rust.id, { cursor: first.ok ? first.cursors.next : null });

		expect(ids(first)).toEqual(["post-5", "post-4", "post-3"]);
		expect(ids(second)).toEqual(["post-2", "post-1", "post-0"]);
	});

	test("carries the labels on the posts it answers with", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 1);

		let rust = await makeTag(user, "Rust");
		await user.tagItem("post-0", { tagId: rust.id });

		let page = await user.taggedQueue(rust.id);
		if (!page.ok) throw new Error("expected a page");

		expect(page.items[0]?.tags.map((tag) => tag.name)).toEqual(["Rust"]);

		// And no page of the river pays for a read it would print nothing from.
		let queue = await user.readingQueue({ readState: "all" });
		if (!queue.ok) throw new Error("expected a page");
		expect(queue.items.every((item) => item.tags.length === 0)).toBe(true);
	});
});

describe("labelling a post", () => {
	test("keeps the post, and reports that it kept it", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 1);

		let applied = await user.tagItem("post-0", { name: "Rust" });

		expect(applied).toMatchObject({ ok: true, saved: true });
		expect(ids(await user.savedQueue())).toEqual(["post-0"]);

		// A post already kept is not kept twice, and says so.
		let again = await user.tagItem("post-0", { name: "Cooking" });
		expect(again).toMatchObject({ ok: true, saved: false });
	});

	test("is refused for the same reason keeping is when the shelf is full, and labels nothing", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 1);

		// The shelf filled in one statement, since what is under test is the refusal rather
		// than how the rows got there.
		state.storage.sql.exec(
			`INSERT INTO feed_items
				(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
				 created_at, updated_at)
			 WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ?)
			 SELECT 'kept-' || n, ?, 'kept-' || n, 'kept', NULL, NULL, NULL, n, NULL, 1, 0, 0 FROM seq`,
			SAVED_LIMIT,
			FEED_ID,
		);

		let refused = await user.tagItem("post-0", { name: "Rust" });

		expect(refused).toMatchObject({ ok: false, reason: "saved-full" });
		expect(joinRows(state)).toEqual([]);

		// And the post is still under whatever rule would have taken it.
		expect(ids(await user.taggedQueue("whatever"))).toEqual([]);
	});

	test("writes one row however many times the same label is applied", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 1);

		let rust = await makeTag(user, "Rust");

		await user.tagItem("post-0", { tagId: rust.id });
		await user.tagItem("post-0", { tagId: rust.id });

		expect(joinRows(state)).toEqual([`${rust.id}:post-0`]);
	});

	test("refuses the eleventh label on one post, and the ten remain", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 1);

		for (let order = 0; order < TAGS_PER_ITEM; order += 1) {
			let applied = await user.tagItem("post-0", { name: `label ${order}` });
			expect(applied.ok).toBe(true);
		}

		let refused = await user.tagItem("post-0", { name: "one too many" });

		expect(refused).toMatchObject({ ok: false, reason: "post-tag-limit" });
		expect(joinRows(state)).toHaveLength(TAGS_PER_ITEM);
	});

	test("resolves two names differing only in case to one label", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 2);

		let first = await user.tagItem("post-0", { name: "Rust" });
		let second = await user.tagItem("post-1", { name: "  rust " });

		expect(first.ok && second.ok && first.tag.id).toBe(second.ok ? second.tag.id : null);
		expect((await user.listTags()).map((tag) => tag.name)).toEqual(["Rust"]);
	});
});

describe("the labels a reader may have", () => {
	test("refuses the hundred-and-first, and the hundred remain", async () => {
		let { user } = await createReader();

		for (let order = 0; order < TAG_LIMIT; order += 1) {
			let created = await user.createTag(`label ${order}`);
			expect(created.ok).toBe(true);
		}

		let refused = await user.createTag("one too many");

		expect(refused).toMatchObject({ ok: false, reason: "tag-limit" });
		expect(await user.listTags()).toHaveLength(TAG_LIMIT);
	});

	test("refuses a name a chip could not draw", async () => {
		let { user } = await createReader();

		expect(await user.createTag("   ")).toMatchObject({ ok: false, reason: "tag-name-invalid" });
		expect(await user.createTag("a".repeat(33))).toMatchObject({
			ok: false,
			reason: "tag-name-invalid",
		});
	});

	test("makes no label while the reader's plan sells none, and deletes nothing they have", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 1);

		let rust = await makeTag(user, "Rust");
		await user.tagItem("post-0", { tagId: rust.id });

		await user.setTier({
			entitled: "free",
			cancelled: true,
			readAt: Date.now() + 1,
			source: "billing",
		});

		expect(await user.createTag("Cooking")).toMatchObject({ ok: false, reason: "not-entitled" });

		// Everything they have is still theirs, and still readable by label.
		expect(await user.listTags()).toHaveLength(1);
		expect(ids(await user.taggedQueue(rust.id))).toEqual(["post-0"]);
	});
});

describe("renaming and deleting a label", () => {
	test("renaming writes one row and leaves every join row untouched", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 3);

		let rust = await makeTag(user, "Rust");
		for (let id of ["post-0", "post-1", "post-2"]) await user.tagItem(id, { tagId: rust.id });

		let before = joinRows(state);
		let renamed = await user.renameTag(rust.id, "Systems");

		expect(renamed).toMatchObject({ ok: true, tag: { id: rust.id, name: "Systems" } });
		expect(joinRows(state)).toEqual(before);
		expect(ids(await user.taggedQueue(rust.id))).toEqual(["post-2", "post-1", "post-0"]);
	});

	test("refuses a rename colliding with another label, and names it", async () => {
		let { user } = await createReader();

		let rust = await makeTag(user, "Rust");
		let cooking = await makeTag(user, "Cooking");

		let refused = await user.renameTag(cooking.id, "rust");

		expect(refused).toMatchObject({ ok: false, reason: "tag-exists", tag: { id: rust.id } });
		expect((await user.getTag(cooking.id))?.name).toBe("Cooking");
	});

	test("deleting removes the join rows, deletes no post and unsaves none", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 2);

		let rust = await makeTag(user, "Rust");
		await user.tagItem("post-0", { tagId: rust.id });
		await user.tagItem("post-1", { tagId: rust.id });

		let removed = await user.deleteTag(rust.id);

		expect(removed).toMatchObject({ ok: true, name: "Rust", items: 2 });
		expect(joinRows(state)).toEqual([]);
		expect(await user.getTag(rust.id)).toBeNull();
		expect(ids(await user.savedQueue())).toEqual(["post-1", "post-0"]);
	});
});

describe("what a label outlives, and what it does not", () => {
	test("unsaving a post drops its labels and returns it to the rule that would have taken it", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 1);

		let rust = await makeTag(user, "Rust");
		await user.tagItem("post-0", { tagId: rust.id });

		await user.saveItem("post-0", false);

		expect(joinRows(state)).toEqual([]);
		expect(ids(await user.taggedQueue(rust.id))).toEqual([]);

		// The post itself is still there, unlabelled, under the ordinary rules.
		expect(ids(await user.readingQueue({ readState: "all" }))).toEqual(["post-0"]);
	});

	test("the velocity sweep leaves no orphaned join row", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);

		seedItems(state, FEED_ID, [
			{ id: "old", publishedAt: Date.now() - 30 * DAY_MS },
			{ id: "new", publishedAt: Date.now() },
		]);

		let rust = await makeTag(user, "Rust");
		await user.tagItem("new", { tagId: rust.id });

		await user.setVelocity(FEED_ID, "breaking");

		expect(orphanedRows(state)).toEqual([]);
		expect(ids(await user.taggedQueue(rust.id))).toEqual(["new"]);
	});

	test("the budget's reclamation leaves no orphaned join row", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);

		seedItems(
			state,
			FEED_ID,
			Array.from({ length: 6 }, (_value, order) => ({
				id: `read-${order}`,
				publishedAt: (order + 1) * DAY_MS,
				readAt: 1,
			})),
		);
		seedRun(state, FEED_ID, 1, "keep");

		let rust = await makeTag(user, "Rust");
		await user.tagItem("keep-0", { tagId: rust.id });

		await setBudget(2);
		await user.synchronize();

		expect(orphanedRows(state)).toEqual([]);
		expect(ids(await user.taggedQueue(rust.id))).toEqual(["keep-0"]);
	});

	test("unfollowing a feed leaves no orphaned join row", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 2);

		let rust = await makeTag(user, "Rust");
		await user.tagItem("post-0", { tagId: rust.id });

		await user.unfollowFeed(FEED_ID);

		expect(orphanedRows(state)).toEqual([]);
	});
});

describe("a label a rule may apply", () => {
	test("applies one the reader already has, and creates none", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 2);

		let rust = await makeTag(user, "Rust");

		let applied = await user.tagItem("post-0", { name: "rust" }, false);
		expect(applied).toMatchObject({ ok: true, tag: { id: rust.id } });

		let refused = await user.tagItem("post-1", { name: "Cooking" }, false);

		expect(refused).toMatchObject({ ok: false, reason: "not-found" });
		expect(await user.listTags()).toHaveLength(1);
		expect(joinRows(state)).toEqual([`${rust.id}:post-0`]);
	});

	test("keeps the post it labels, and stops applying once the shelf is full", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 1);

		let rust = await makeTag(user, "Rust");

		state.storage.sql.exec(
			`INSERT INTO feed_items
				(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
				 created_at, updated_at)
			 WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ?)
			 SELECT 'kept-' || n, ?, 'kept-' || n, 'kept', NULL, NULL, NULL, n, NULL, 1, 0, 0 FROM seq`,
			SAVED_LIMIT,
			FEED_ID,
		);

		let refused = await user.tagItem("post-0", { tagId: rust.id }, false);

		expect(refused).toMatchObject({ ok: false, reason: "saved-full" });
		expect(joinRows(state)).toEqual([]);
	});

	test("a label the reader took off is not put back", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedRun(state, FEED_ID, 1);

		let rust = await makeTag(user, "Rust");
		await user.tagItem("post-0", { tagId: rust.id });

		await user.untagItem("post-0", rust.id);

		expect(joinRows(state)).toEqual([]);
		// The post keeps its place on the shelf: a label is a reason, and it had others.
		expect(ids(await user.savedQueue())).toEqual(["post-0"]);
	});
});

describe("pinned feeds", () => {
	test("carries the pin on the summary the rail already reads", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID, "Daily");

		expect((await user.listFeeds())[0]?.pinnedAt).toBeNull();

		await user.pinFeed(FEED_ID, true);

		let listed = await user.listFeeds();
		expect(listed).toHaveLength(1);
		expect(listed[0]?.pinnedAt).not.toBeNull();
	});

	test("refuses the eleventh pin", async () => {
		let { state, user } = await createReader();

		for (let order = 0; order < PIN_LIMIT; order += 1) {
			seedFeed(state, `feed-${order}`);
			expect(await user.pinFeed(`feed-${order}`, true)).toMatchObject({ ok: true, pinned: true });
		}

		seedFeed(state, "feed-extra");
		let refused = await user.pinFeed("feed-extra", true);

		expect(refused).toMatchObject({ ok: false, reason: "pin-limit", allowed: PIN_LIMIT });
		expect((await user.pinnedStrip()).map((entry) => entry.feed.id)).toHaveLength(PIN_LIMIT);
	});

	test("reads at most three unread posts per pinned feed", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID, "Daily");
		seedFeed(state, "feed-2", "Weekly");

		seedRun(state, FEED_ID, 5);
		seedItems(state, "feed-2", [
			{ id: "read-one", publishedAt: DAY_MS, readAt: 1 },
			{ id: "unread-one", publishedAt: 2 * DAY_MS },
		]);

		await user.pinFeed(FEED_ID, true);
		await user.pinFeed("feed-2", true);

		let strip = await user.pinnedStrip();

		expect(strip.map((entry) => entry.feed.id)).toEqual([FEED_ID, "feed-2"]);
		expect(strip[0]?.items.map((item) => item.id)).toEqual(["post-4", "post-3", "post-2"]);
		expect(strip[1]?.items.map((item) => item.id)).toEqual(["unread-one"]);
	});

	/**
	 * A pin is presentation. The queue's statement, predicate and cursor are what they were,
	 * so pinning mid-scroll cannot remove a post from a page not yet fetched.
	 */
	test("pinning and unpinning mid-scroll changes no page of the queue and no cursor", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);
		seedFeed(state, "feed-2");

		seedRun(state, FEED_ID, 3);
		seedRun(state, "feed-2", 3, "other");

		let first = await user.readingQueue({ readState: "all", limit: 3 });
		if (!first.ok) throw new Error("expected a page");

		await user.pinFeed(FEED_ID, true);
		let underPin = await user.readingQueue({
			cursor: first.cursors.next,
			readState: "all",
			limit: 3,
		});

		await user.pinFeed(FEED_ID, false);
		let unpinned = await user.readingQueue({
			cursor: first.cursors.next,
			readState: "all",
			limit: 3,
		});

		expect(ids(underPin)).toEqual(ids(unpinned));
		expect(ids(underPin)).toHaveLength(3);
		expect(ids(first).every((id) => !ids(underPin).includes(id))).toBe(true);
	});

	test("refuses to pin a feed the reader does not follow", async () => {
		let { user } = await createReader();

		expect(await user.pinFeed("feed-nobody-follows", true)).toMatchObject({
			ok: false,
			reason: "not-following",
		});
	});
});

describe("the measured rate a quiet feed is grouped by", () => {
	test("is written down from what the feed's own object reported", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);

		await user.recordPublishingRate(FEED_ID, 1 / 30);

		expect((await user.listFeeds())[0]?.postsPerDay).toBeCloseTo(1 / 30);
	});

	test("leaves the stored rate alone when nothing has been measured", async () => {
		let { state, user } = await createReader();
		seedFeed(state, FEED_ID);

		await user.recordPublishingRate(FEED_ID, 2);
		await user.recordPublishingRate(FEED_ID, null);

		expect((await user.listFeeds())[0]?.postsPerDay).toBe(2);
	});
});
