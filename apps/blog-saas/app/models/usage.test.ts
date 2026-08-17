/**
 * Unit tests for the `UsageDaily` control-plane model: the idempotent per-blog/day
 * page-view upsert (`record`), the unreported-rows filter that drives Polar
 * ingestion, and the `markReported` idempotency guard, against in-memory SQLite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { type TestDatabase, createTestDatabase } from "~/app/test/db";

import Account from "./account";
import Blog from "./blog";
import UsageDaily from "./usage";

let harness: TestDatabase;

beforeEach(() => {
	harness = createTestDatabase();
});

afterEach(() => {
	harness.sqliteDb.close();
});

/** Seeds an account + blog so usage rows satisfy the FK constraint. */
async function seedBlog(slug = "my-blog"): Promise<string> {
	let account = await Account.findOrCreateFromProfile(harness.db, {
		subject: `sub-${slug}`,
		email: `${slug}@example.com`,
	});
	let blog = await Blog.create(harness.db, {
		accountId: account.id,
		name: slug,
		slug,
		region: "wnam",
	});
	return blog.id;
}

describe("UsageDaily.record", () => {
	test("inserts a fresh page-view row for a blog/day, unreported", async () => {
		let blogId = await seedBlog();

		await UsageDaily.record(harness.db, blogId, "2026-07-04", 100);

		let rows = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });
		expect(rows).toHaveLength(1);
		expect(rows[0]!.page_views).toBe(100);
		expect(rows[0]!.reported_at).toBeNull();
	});

	test("overwrites the count on re-run for the same blog/day (idempotent)", async () => {
		let blogId = await seedBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-04", 100);

		await UsageDaily.record(harness.db, blogId, "2026-07-04", 150);

		let rows = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });
		expect(rows).toHaveLength(1);
		expect(rows[0]!.page_views).toBe(150);
	});

	test("keeps distinct rows for different days of the same blog", async () => {
		let blogId = await seedBlog();

		await UsageDaily.record(harness.db, blogId, "2026-07-04", 100);
		await UsageDaily.record(harness.db, blogId, "2026-07-05", 200);

		let rows = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });
		expect(rows).toHaveLength(2);
	});
});

describe("UsageDaily.findUnreported", () => {
	test("returns only rows that have not been reported to Polar", async () => {
		let blogId = await seedBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-04", 100);
		await UsageDaily.record(harness.db, blogId, "2026-07-05", 200);
		let rows = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });
		let reported = rows.find((row) => row.date === "2026-07-04")!;
		await UsageDaily.markReported(harness.db, reported.id);

		let unreported = await UsageDaily.findUnreported(harness.db);

		expect(unreported).toHaveLength(1);
		expect(unreported[0]!.date).toBe("2026-07-05");
	});

	test("returns an empty list when every row is reported", async () => {
		let blogId = await seedBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-04", 100);
		let rows = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });
		await UsageDaily.markReported(harness.db, rows[0]!.id);

		expect(await UsageDaily.findUnreported(harness.db)).toHaveLength(0);
	});
});

describe("UsageDaily.markReported", () => {
	test("stamps reported_at so the row is no longer unreported", async () => {
		let blogId = await seedBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-04", 100);
		let rows = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });

		await UsageDaily.markReported(harness.db, rows[0]!.id);

		let updated = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });
		expect(updated[0]!.reported_at).not.toBeNull();
	});
});
