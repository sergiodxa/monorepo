/**
 * Checks the reader's models against a migrated reader database: the settings row they
 * provision, the scopes counts are written in, the ids they mint, and the rows deleting a
 * folder or a label rewrites in the same turn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { unwrap } from "@sdxc/result";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { UserModels } from "~/database/models/user";

import { runMigrations } from "~/database/migrations";
import { userModels } from "~/database/models/user";
import { SETTINGS_ID } from "~/database/models/user/settings";

let models: UserModels;

beforeEach(async () => {
	let adapter = createSQLStorageDatabaseAdapter(createSqlStorage());
	await runMigrations(adapter);
	models = userModels.bind({ db: new Database(adapter, { now: () => Date.now() }) });
});

/** Follows one feed by writing its subscription row. */
async function follow(feedUrl: string, folderId: string | null = null) {
	return unwrap(
		await models.subscriptions.create({
			feed_id: `canonical-${feedUrl}`,
			feed_url: feedUrl,
			title: feedUrl,
			folder_id: folderId,
		}),
	);
}

/** Writes one post of a subscription, unread and unsaved unless told otherwise. */
async function post(id: string, subscriptionId: string, marks: { saved?: boolean } = {}) {
	let created = await models.posts.create({
		id,
		feed_id: subscriptionId,
		guid: id,
		title: id,
		published_at: 1,
		saved_at: marks.saved ? 1 : null,
	});
	return unwrap(created);
}

describe("settings", () => {
	test("provisions the one row once, and writes onto it", async () => {
		expect(await models.settings.current()).toBeNull();

		let first = await models.settings.provision("sub-1");
		let again = await models.settings.provision("sub-2");

		expect(first.id).toBe(SETTINGS_ID);
		expect(again.subject).toBe("sub-1");
		expect(first.tier).toBe("free");
		expect((await models.settings.write({ email: "a@example.com" })).email).toBe("a@example.com");
	});
});

describe("subscriptions", () => {
	test("mints a feed id and finds a row by its address", async () => {
		let followed = await follow("https://example.com/feed.xml");

		expect(followed.id.startsWith("feed_")).toBe(true);
		expect((await models.subscriptions.byUrl("https://example.com/feed.xml"))?.id).toBe(
			followed.id,
		);
	});

	test("leaves an unfollowed row out of followed, pinned and notified counts", async () => {
		let kept = await follow("https://example.com/a.xml");
		let gone = await follow("https://example.com/b.xml");
		await models.subscriptions.write(kept.id, { pinned_at: 1, notify: true });
		await models.subscriptions.write(gone.id, { pinned_at: 1, notify: true, unfollowed_at: 1 });

		expect(await models.subscriptions.followed().count()).toBe(1);
		expect(await models.subscriptions.followed().pinned().count()).toBe(1);
		expect(await models.subscriptions.notified().count()).toBe(1);
	});
});

describe("folders", () => {
	test("finds or creates by title, creating once", async () => {
		let made = await models.folders.findOrCreate("Tech");
		let found = await models.folders.findOrCreate("Tech");

		expect(found.id).toBe(made.id);
		expect(made.id.startsWith("folder_")).toBe(true);
		expect(await models.folders.query().count()).toBe(1);
	});

	test("deleting one unfiles its subscriptions and their posts and deletes no post", async () => {
		let folder = await models.folders.findOrCreate("Tech");
		let feed = await follow("https://example.com/feed.xml", folder.id);
		await post("p1", feed.id);
		await models.posts.ofSubscription(feed.id).update({ folder_id: folder.id });

		unwrap(await models.folders.delete({ id: folder.id }));

		expect((await models.subscriptions.find({ id: feed.id }))?.folder_id).toBeNull();
		expect((await models.posts.find({ id: "p1" }))?.folder_id).toBeNull();
	});
});

describe("tags", () => {
	test("deleting a label takes it off every post and keeps the posts", async () => {
		let feed = await follow("https://example.com/feed.xml");
		await post("p1", feed.id, { saved: true });
		let tag = unwrap(await models.tags.create({ name: "Rust", slug: "rust" }));
		let applied = unwrap(
			await models.itemTags.create({ tag_id: tag.id, item_id: "p1", published_at: 1 }),
		);

		expect(applied.created_at).toBeGreaterThan(0);
		expect((await models.tags.bySlug("rust"))?.id).toBe(tag.id);

		unwrap(await models.tags.delete({ id: tag.id }));

		expect(await models.itemTags.onPost("p1").count()).toBe(0);
		expect(await models.posts.saved().count()).toBe(1);
	});
});

describe("devices", () => {
	test("registers an endpoint once and clears its failures on the next registration", async () => {
		let keys = { p256dh: "k", auth: "a", vapid_key: null, user_agent: null, locale: "en" };
		let first = await models.devices.register("https://push.example.com/1", keys);
		await models.devices.update({ id: first.id }, { failure_count: 3 });

		let again = await models.devices.register("https://push.example.com/1", {
			...keys,
			locale: "es",
		});

		expect(again.id).toBe(first.id);
		expect(again.failure_count).toBe(0);
		expect(again.locale).toBe("es");
		expect(await models.devices.query().count()).toBe(1);
	});
});
