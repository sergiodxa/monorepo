/**
 * Unit tests for the `Hostname` control-plane model: pending-record creation, the
 * per-blog/per-hostname lookups, the `findPending` polling query, and status/ssl
 * mutation and deletion, against an in-memory SQLite database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { type TestDatabase, createTestDatabase } from "~/app/test/db";

import Account from "./account";
import Blog from "./blog";
import Hostname from "./hostname";

let harness: TestDatabase;

beforeEach(() => {
	harness = createTestDatabase();
});

afterEach(() => {
	harness.sqliteDb.close();
});

/** Seeds an account + blog so hostname rows satisfy the FK constraint. */
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

describe("Hostname.create", () => {
	test("creates a hostname in pending_validation with the given validation record", async () => {
		let blogId = await seedBlog();

		let hostname = await Hostname.create(harness.db, {
			id: "hn_1",
			blogId,
			hostname: "blog.example.com",
			validationTxtName: "_cf.blog.example.com",
			validationTxtValue: "token-123",
		});

		expect(hostname.status).toBe("pending_validation");
		expect(hostname.hostname).toBe("blog.example.com");
		expect(hostname.validation_txt_name).toBe("_cf.blog.example.com");
		expect(hostname.validation_txt_value).toBe("token-123");
		expect(hostname.ssl_status).toBeNull();
	});

	test("defaults the validation record fields to null when omitted", async () => {
		let blogId = await seedBlog();

		let hostname = await Hostname.create(harness.db, {
			id: "hn_1",
			blogId,
			hostname: "blog.example.com",
		});

		expect(hostname.validation_txt_name).toBeNull();
		expect(hostname.validation_txt_value).toBeNull();
	});
});

describe("Hostname lookups", () => {
	test("findByBlog resolves the blog's hostname record", async () => {
		let blogId = await seedBlog();
		await Hostname.create(harness.db, { id: "hn_1", blogId, hostname: "blog.example.com" });

		let found = await Hostname.findByBlog(harness.db, blogId);

		expect(found?.hostname).toBe("blog.example.com");
	});

	test("findByHostname resolves a record by its hostname string", async () => {
		let blogId = await seedBlog();
		await Hostname.create(harness.db, { id: "hn_1", blogId, hostname: "blog.example.com" });

		let found = await Hostname.findByHostname(harness.db, "blog.example.com");

		expect(found?.blog_id).toBe(blogId);
	});

	test("findByHostname returns null for an unregistered hostname", async () => {
		expect(await Hostname.findByHostname(harness.db, "nope.example.com")).toBeNull();
	});
});

describe("Hostname.findPending", () => {
	test("returns only hostnames still awaiting validation", async () => {
		let pendingBlog = await seedBlog("pending");
		let activeBlog = await seedBlog("active");
		await Hostname.create(harness.db, {
			id: "hn_pending",
			blogId: pendingBlog,
			hostname: "pending.example.com",
		});
		await Hostname.create(harness.db, {
			id: "hn_active",
			blogId: activeBlog,
			hostname: "active.example.com",
		});
		await Hostname.setStatus(harness.db, "hn_active", "active", "active");

		let pending = await Hostname.findPending(harness.db);

		expect(pending).toHaveLength(1);
		expect(pending[0]!.id).toBe("hn_pending");
	});
});

describe("Hostname.setStatus", () => {
	test("updates the validation status and ssl status", async () => {
		let blogId = await seedBlog();
		await Hostname.create(harness.db, { id: "hn_1", blogId, hostname: "blog.example.com" });

		await Hostname.setStatus(harness.db, "hn_1", "active", "active");

		let updated = await Hostname.findByBlog(harness.db, blogId);
		expect(updated?.status).toBe("active");
		expect(updated?.ssl_status).toBe("active");
	});

	test("clears the ssl status to null when omitted", async () => {
		let blogId = await seedBlog();
		await Hostname.create(harness.db, { id: "hn_1", blogId, hostname: "blog.example.com" });
		await Hostname.setStatus(harness.db, "hn_1", "active", "active");

		await Hostname.setStatus(harness.db, "hn_1", "pending_validation");

		let updated = await Hostname.findByBlog(harness.db, blogId);
		expect(updated?.status).toBe("pending_validation");
		expect(updated?.ssl_status).toBeNull();
	});
});

describe("Hostname.destroy", () => {
	test("removes the hostname record", async () => {
		let blogId = await seedBlog();
		await Hostname.create(harness.db, { id: "hn_1", blogId, hostname: "blog.example.com" });

		await Hostname.destroy(harness.db, "hn_1");

		expect(await Hostname.findByBlog(harness.db, blogId)).toBeNull();
	});
});
