/**
 * Unit tests for the `Blog` control-plane model: creation defaults, lookups, status
 * transitions, soft-delete/restore, and the in-memory filters behind `listByAccount`
 * and `findDeletedBefore`, exercised against an in-memory SQLite database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { type TestDatabase, createTestDatabase } from "~/app/test/db";

import Account from "./account";
import Blog from "./blog";

let harness: TestDatabase;

beforeEach(() => {
	harness = createTestDatabase();
});

afterEach(() => {
	harness.sqliteDb.close();
});

/** Inserts an account so blog rows satisfy the FK constraint. */
async function seedAccount(subject = "sub-1"): Promise<string> {
	let account = await Account.findOrCreateFromProfile(harness.db, {
		subject,
		email: `${subject}@example.com`,
	});
	return account.id;
}

describe("Blog.create", () => {
	test("creates a blog in provisioning status with hostname inactive", async () => {
		let accountId = await seedAccount();

		let blog = await Blog.create(harness.db, {
			accountId,
			name: "My Blog",
			slug: "my-blog",
			region: "wnam",
		});

		expect(blog.status).toBe("provisioning");
		expect(blog.custom_hostname_active).toBe(0);
		expect(blog.deleted_at).toBeNull();
		expect(blog.account_id).toBe(accountId);
	});

	test("assigns a distinct id to each created blog", async () => {
		let accountId = await seedAccount();

		let first = await Blog.create(harness.db, {
			accountId,
			name: "One",
			slug: "one",
			region: "wnam",
		});
		let second = await Blog.create(harness.db, {
			accountId,
			name: "Two",
			slug: "two",
			region: "wnam",
		});

		expect(first.id).not.toBe(second.id);
	});
});

describe("Blog lookups", () => {
	test("findById returns the matching blog", async () => {
		let accountId = await seedAccount();
		let created = await Blog.create(harness.db, {
			accountId,
			name: "My Blog",
			slug: "my-blog",
			region: "wnam",
		});

		let found = await Blog.findById(harness.db, created.id);

		expect(found?.id).toBe(created.id);
	});

	test("findBySlug resolves a blog by its unique slug", async () => {
		let accountId = await seedAccount();
		await Blog.create(harness.db, {
			accountId,
			name: "My Blog",
			slug: "my-blog",
			region: "wnam",
		});

		let found = await Blog.findBySlug(harness.db, "my-blog");

		expect(found?.slug).toBe("my-blog");
	});

	test("findBySlug returns null for an unknown slug", async () => {
		let found = await Blog.findBySlug(harness.db, "does-not-exist");

		expect(found).toBeNull();
	});
});

describe("Blog.listByAccount", () => {
	test("returns the account's non-deleted blogs", async () => {
		let accountId = await seedAccount();
		await Blog.create(harness.db, {
			accountId,
			name: "Kept",
			slug: "kept",
			region: "wnam",
		});
		let deleted = await Blog.create(harness.db, {
			accountId,
			name: "Gone",
			slug: "gone",
			region: "wnam",
		});
		await Blog.softDelete(harness.db, deleted.id);

		let blogs = await Blog.listByAccount(harness.db, accountId);

		expect(blogs).toHaveLength(1);
		expect(blogs[0]!.slug).toBe("kept");
	});

	test("does not return blogs owned by other accounts", async () => {
		let mine = await seedAccount("mine");
		let theirs = await seedAccount("theirs");
		await Blog.create(harness.db, { accountId: mine, name: "Mine", slug: "mine", region: "wnam" });
		await Blog.create(harness.db, {
			accountId: theirs,
			name: "Theirs",
			slug: "theirs",
			region: "wnam",
		});

		let blogs = await Blog.listByAccount(harness.db, mine);

		expect(blogs).toHaveLength(1);
		expect(blogs[0]!.account_id).toBe(mine);
	});
});

describe("Blog status transitions", () => {
	test("setStatus updates the lifecycle status", async () => {
		let accountId = await seedAccount();
		let blog = await Blog.create(harness.db, {
			accountId,
			name: "My Blog",
			slug: "my-blog",
			region: "wnam",
		});

		await Blog.setStatus(harness.db, blog.id, "active");

		let updated = await Blog.findById(harness.db, blog.id);
		expect(updated?.status).toBe("active");
	});

	test("setCustomHostnameActive toggles the custom-hostname flag", async () => {
		let accountId = await seedAccount();
		let blog = await Blog.create(harness.db, {
			accountId,
			name: "My Blog",
			slug: "my-blog",
			region: "wnam",
		});

		await Blog.setCustomHostnameActive(harness.db, blog.id, true);
		expect((await Blog.findById(harness.db, blog.id))?.custom_hostname_active).toBe(1);

		await Blog.setCustomHostnameActive(harness.db, blog.id, false);
		expect((await Blog.findById(harness.db, blog.id))?.custom_hostname_active).toBe(0);
	});

	test("softDelete marks the blog deleted and stamps deleted_at", async () => {
		let accountId = await seedAccount();
		let blog = await Blog.create(harness.db, {
			accountId,
			name: "My Blog",
			slug: "my-blog",
			region: "wnam",
		});

		await Blog.softDelete(harness.db, blog.id);

		let deleted = await Blog.findById(harness.db, blog.id);
		expect(deleted?.status).toBe("deleted");
		expect(deleted?.deleted_at).not.toBeNull();
	});

	test("restore clears deleted_at and returns the blog to active", async () => {
		let accountId = await seedAccount();
		let blog = await Blog.create(harness.db, {
			accountId,
			name: "My Blog",
			slug: "my-blog",
			region: "wnam",
		});
		await Blog.softDelete(harness.db, blog.id);

		await Blog.restore(harness.db, blog.id);

		let restored = await Blog.findById(harness.db, blog.id);
		expect(restored?.status).toBe("active");
		expect(restored?.deleted_at).toBeNull();
	});
});

describe("Blog.findDeletedBefore", () => {
	test("returns only blogs soft-deleted strictly before the cutoff", async () => {
		let accountId = await seedAccount();
		let old = await Blog.create(harness.db, {
			accountId,
			name: "Old",
			slug: "old",
			region: "wnam",
		});
		let recent = await Blog.create(harness.db, {
			accountId,
			name: "Recent",
			slug: "recent",
			region: "wnam",
		});
		await Blog.softDelete(harness.db, old.id);
		await Blog.softDelete(harness.db, recent.id);
		// Backdate the "old" blog's deletion so it falls before the cutoff.
		await harness.db.update(
			Blog.table,
			{ id: old.id },
			{ deleted_at: "2020-01-01T00:00:00.000Z", updated_at: "2020-01-01T00:00:00.000Z" },
		);

		let purgeable = await Blog.findDeletedBefore(harness.db, "2020-06-01T00:00:00.000Z");

		expect(purgeable).toHaveLength(1);
		expect(purgeable[0]!.id).toBe(old.id);
	});

	test("excludes non-deleted blogs even when created before the cutoff", async () => {
		let accountId = await seedAccount();
		await Blog.create(harness.db, {
			accountId,
			name: "Active",
			slug: "active",
			region: "wnam",
		});

		let purgeable = await Blog.findDeletedBefore(harness.db, "2999-01-01T00:00:00.000Z");

		expect(purgeable).toHaveLength(0);
	});
});

describe("Blog.destroy", () => {
	test("hard-deletes the blog row", async () => {
		let accountId = await seedAccount();
		let blog = await Blog.create(harness.db, {
			accountId,
			name: "My Blog",
			slug: "my-blog",
			region: "wnam",
		});

		await Blog.destroy(harness.db, blog.id);

		expect(await Blog.findById(harness.db, blog.id)).toBeNull();
	});
});
