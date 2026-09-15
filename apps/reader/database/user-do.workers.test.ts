/**
 * Drives the reader's Durable Object the way the app does: inside workerd, through the
 * `USER` binding this app's wrangler config declares, by name, over real RPC. What only
 * the deployment can show is asserted here — that the binding names a class the runtime
 * finds, that the migration tag gives that class SQLite-backed storage for the schema to
 * run against, that the constructor's gate holds the first requests until it has, that
 * one reader's rows are invisible to another, and that the alarm it arms is one the
 * platform accepts. The behaviour behind those methods belongs to the tests that build
 * the object directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import type { UserStore } from "~/database/user-do";

const HOUR_MS = 60 * 60 * 1000;

/**
 * A subject no other test in this file uses. Durable Object storage outlives a test, and
 * `getByName` hands back whatever object that name already has, so each test gets its own
 * reader rather than sharing one and depending on the order they ran in.
 */
function subject(): string {
	return `sub-${crypto.randomUUID()}`;
}

describe("the USER binding", () => {
	test("creates a reader with the default cadence on a first sign-in", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		expect(await stub.getSettings()).toBeNull();

		// The row exists only because the schema does, which needs the class to hold
		// SQLite rather than the key-value storage a `new_classes` migration would give it.
		expect(await stub.ensureUser(name)).toEqual({
			subject: name,
			refreshIntervalHours: 1,
			lastRefreshedAt: null,
		});
	});

	test("answers every request that raced the boot, because the constructor gates them", async () => {
		let stub = env.USER.getByName(subject());

		// All four reach a cold object at once, while the migration is still creating the
		// tables they query; `blockConcurrencyWhile` is what holds them until it has.
		let [stored, feeds, queue, timeline] = await Promise.all([
			stub.getSettings(),
			stub.listFeeds(),
			stub.readingQueue(),
			stub.feedTimeline("feed_00000000000000000000000000"),
		]);

		expect(stored).toBeNull();
		expect(feeds.feeds).toEqual([]);
		expect(queue).toEqual({
			ok: true,
			items: [],
			feeds: [],
			cursors: { next: null, prev: null },
		});
		expect(timeline.ok).toBe(true);
	});

	test("keeps one reader's storage out of another's", async () => {
		let mine = subject();
		let yours = subject();

		await env.USER.getByName(mine).ensureUser(mine);
		await env.USER.getByName(mine).setRefreshInterval(24);

		// A name nobody has signed in under reads as an empty object rather than as the
		// reader next to it, which is what the whole per-reader design rests on.
		expect(await env.USER.getByName(yours).getSettings()).toBeNull();

		expect(await env.USER.getByName(yours).ensureUser(yours)).toEqual({
			subject: yours,
			refreshIntervalHours: 1,
			lastRefreshedAt: null,
		});

		expect((await env.USER.getByName(mine).getSettings())?.refreshIntervalHours).toBe(24);
	});

	test("resolves the same subject to the same object every time it is addressed", async () => {
		let name = subject();

		await env.USER.getByName(name).ensureUser(name);

		// A fresh handle, built from the subject alone the way each request builds one.
		expect(await env.USER.getByName(name).getSettings()).toEqual({
			subject: name,
			refreshIntervalHours: 1,
			lastRefreshedAt: null,
		});

		expect(env.USER.getByName(name).id.toString()).toBe(env.USER.getByName(name).id.toString());
	});

	test("persists a chosen cadence for the next handle to read", async () => {
		let name = subject();
		await env.USER.getByName(name).ensureUser(name);

		let result = await env.USER.getByName(name).setRefreshInterval(6);

		expect(result).toEqual({
			ok: true,
			settings: { subject: name, refreshIntervalHours: 6, lastRefreshedAt: null },
		});

		expect((await env.USER.getByName(name).getSettings())?.refreshIntervalHours).toBe(6);
	});

	test("reports an unlisted cadence across the boundary instead of throwing", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);
		await stub.ensureUser(name);

		let result: UserStore.IntervalResult = await stub.setRefreshInterval(2);

		// A thrown error would arrive here as a bare `Error`, since the platform serializes
		// one by name and message; a refusal arrives as the union the caller switches on.
		expect(result).toEqual({ ok: false, reason: "invalid-interval" });
		expect((await stub.getSettings())?.refreshIntervalHours).toBe(1);
	});

	test("carries a follow refusal back as a plain object a caller can switch on", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);
		await stub.ensureUser(name);

		// A URL rejected before any lookup, so the assertion is about the boundary alone.
		let result: UserStore.FollowResult = await stub.followFeed("mailto:reader@example.com");

		expect(result).toEqual({ ok: false, reason: "invalid-url", feedId: null });
		expect(result).not.toBeInstanceOf(Error);

		let reason = result.ok ? "followed" : result.reason;
		expect(reason).toBe("invalid-url");
	});

	test("arms an alarm the platform accepts, for the reader's own cadence", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);
		await stub.ensureUser(name);

		let armed = await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm());

		expect(armed).not.toBeNull();
		expect(armed).toBeGreaterThan(Date.now() + HOUR_MS - 10_000);
		expect(armed).toBeLessThanOrEqual(Date.now() + HOUR_MS);

		await stub.setRefreshInterval(24);

		let rearmed = await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm());

		expect(rearmed).toBeGreaterThan(Date.now() + 24 * HOUR_MS - 10_000);
		expect(rearmed).toBeLessThanOrEqual(Date.now() + 24 * HOUR_MS);
	});
});

/**
 * The methods the signed-in surface calls before a reader has followed anything. Every one
 * of them can be the first call an object ever answers, so what is asserted here is that
 * they cross the RPC boundary and run against the schema the migration tag gives the class.
 */
describe("a reader who follows nothing yet", () => {
	test("counts no subscriptions and exports none", async () => {
		let stub = env.USER.getByName(subject());

		expect(await stub.countFeeds()).toBe(0);
		expect(await stub.exportFeeds()).toEqual([]);
	});

	test("clears an empty queue and reports the nothing it cleared", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		expect(await stub.markAllRead()).toBe(0);
		expect(await stub.markFeedRead("feed_00000000000000000000000000")).toBe(0);
	});

	test("searches an object whose table the drop migration has already run against", async () => {
		let stub = env.USER.getByName(subject());

		// The column the body was stored in is gone here, so a search that reads `summary`
		// is what says the migration ran and left the table the statement expects.
		let found: UserStore.TimelineResult = await stub.searchPosts("anything");

		expect(found).toEqual({ ok: true, items: [], feeds: [], cursors: { next: null, prev: null } });

		expect(await stub.searchPosts("   ")).toEqual({
			ok: true,
			items: [],
			feeds: [],
			cursors: { next: null, prev: null },
		});
	});

	test("carries a bad feed cursor back as an empty page rather than an error", async () => {
		let stub = env.USER.getByName(subject());

		expect(await stub.listFeeds({ cursor: "not-a-cursor" })).toEqual({
			feeds: [],
			cursors: { next: null, prev: null },
		});

		expect(await stub.searchPosts("anything", { cursor: "not-a-cursor" })).toEqual({
			ok: false,
			reason: "bad-cursor",
		});
	});

	test("sweeps nothing and still records that the reader is up to date", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		expect(await stub.checkAllFeedsNow()).toEqual({
			checked: 0,
			withNewPosts: 0,
			inserted: 0,
			failed: 0,
		});

		let stored = await stub.getSettings();

		expect(stored?.subject).toBe(name);
		expect(stored?.lastRefreshedAt).toBeGreaterThan(0);
	});
});

/**
 * There is no sign-up step, so a reader is created by whichever call reached their object
 * first. A session outlives a deploy, which leaves readers holding objects that the feeds
 * they follow wrote and that no sign-in ever provisioned — so every settings path has to
 * work on an object that `ensureUser` has never run against.
 */
describe("a reader whose settings row was never written", () => {
	test("is named by the subject its object was addressed with", async () => {
		let name = subject();

		// The object provisions its own row from this, so it is asserted against the real
		// runtime rather than trusted from the optional `name` on the type.
		let addressed = await runInDurableObject(
			env.USER.getByName(name),
			(_instance, state) => state.id.name,
		);

		expect(addressed).toBe(name);
	});

	test("saves a cadence rather than failing on the missing row", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		expect(await stub.getSettings()).toBeNull();

		let result: UserStore.IntervalResult = await stub.setRefreshInterval(6);

		expect(result).toEqual({
			ok: true,
			settings: { subject: name, refreshIntervalHours: 6, lastRefreshedAt: null },
		});

		expect(await env.USER.getByName(name).getSettings()).toEqual({
			subject: name,
			refreshIntervalHours: 6,
			lastRefreshedAt: null,
		});
	});

	test("records a refresh run, which needs the row the run itself writes", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		// The alarm owns the sweep's own stamp, and it follows no feeds here, so what this
		// asserts is that a sweep from an unprovisioned object leaves a settings row behind.
		await runInDurableObject(stub, (instance) => instance.alarm());

		let stored = await stub.getSettings();

		expect(stored?.subject).toBe(name);
		expect(stored?.lastRefreshedAt).toBeGreaterThan(0);
	});

	test("arms the schedule on a sign-in that arrives after the row already exists", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		await stub.setRefreshInterval(24);

		// The row is already there, so this stands for the reader's next sign-in: it keeps
		// the cadence they chose rather than resetting them to the default.
		expect(await stub.ensureUser(name)).toEqual({
			subject: name,
			refreshIntervalHours: 24,
			lastRefreshedAt: null,
		});
	});
});
