import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Unit tests for `BlogProvisioner`, the blog-lifecycle service: the billing
 * entitlement gate that decides whether a new blog boots active or suspended, slug
 * generation (normalization, reserved subdomains, collision suffixing), OIDC-client
 * provisioning over `fetch`, and the KV/Durable-Object side effects of the lifecycle
 * transitions. All Cloudflare bindings and network calls are stubbed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { HostnameClient } from "@pkg/hostname";

import type { TestDatabase } from "~/app/test/db";
import type { PlatformMeta } from "~/bootstrap/tenant";

// --- Controllable Cloudflare bindings -------------------------------------------------

/** KV writes/deletes the provisioner performs, keyed by cache key. */
let slugCache: Map<string, string>;
/** Per-blog record of the DO RPC calls the provisioner fans out. */
let stubCalls: Array<{ method: string; arg: unknown }>;

function makeStub() {
	return {
		initialize: async (meta: PlatformMeta) =>
			void stubCalls.push({ method: "initialize", arg: meta }),
		updateMeta: async (patch: Partial<PlatformMeta>) =>
			void stubCalls.push({ method: "updateMeta", arg: patch }),
		destroy: async () => void stubCalls.push({ method: "destroy", arg: undefined }),
	};
}

mock.module("cloudflare:workers", () => ({
	env: {
		PLATFORM_DOMAIN: "blog.test",
		OIDC_ISSUER: "https://sso.test",
		SSO_MANAGEMENT_CLIENT_ID: "mgmt-client",
		SSO_MANAGEMENT_CLIENT_SECRET: "mgmt-secret",
		SLUG_CACHE: {
			put: async (key: string, value: string) => void slugCache.set(key, value),
			delete: async (key: string) => void slugCache.delete(key),
		},
		BLOG: { getByName: () => makeStub() },
	},
	DurableObject: class {},
}));

let { createTestDatabase } = await import("~/app/test/db");
let Account = (await import("~/app/models/account")).default;
let Blog = (await import("~/app/models/blog")).default;
let Hostname = (await import("~/app/models/hostname")).default;
let Subscription = (await import("~/app/models/subscription")).default;
let { BlogProvisioner } = await import("./blog-provisioner");

let harness: TestDatabase;
let realFetch = globalThis.fetch;

/** Records every outbound request URL so tests can assert the OIDC flow ran. */
let fetchedUrls: string[];

/** Installs a `fetch` stub answering the two OIDC provisioning calls with `impl`. */
function stubFetch(impl: (url: string) => Response | Promise<Response> = defaultOidcFetch): void {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		let url = input instanceof URL ? input.toString() : String(input);
		fetchedUrls.push(url);
		return impl(url);
	}) as typeof fetch;
}

/** Happy-path OIDC responses: a management token then client credentials. */
function defaultOidcFetch(url: string): Response {
	if (url.endsWith("/oauth/token")) {
		return new Response(JSON.stringify({ access_token: "mgmt-token" }), { status: 200 });
	}
	if (url.endsWith("/api/clients")) {
		return new Response(
			JSON.stringify({ client_id: "oidc-client-id", client_secret: "oidc-client-secret" }),
			{ status: 200 },
		);
	}
	throw new Error(`unexpected fetch to ${url}`);
}

beforeEach(() => {
	harness = createTestDatabase();
	slugCache = new Map();
	stubCalls = [];
	fetchedUrls = [];
	stubFetch();
});

afterEach(() => {
	harness.sqliteDb.close();
	globalThis.fetch = realFetch;
});

/** Seeds an account and returns its id. */
async function seedAccount(subject = "sub-1"): Promise<string> {
	let account = await Account.findOrCreateFromProfile(harness.db, {
		subject,
		email: `${subject}@example.com`,
	});
	return account.id;
}

describe("BlogProvisioner.create — billing entitlement gate", () => {
	test("provisions a blog suspended when the account has no subscription", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);

		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });

		expect(blog.status).toBe("suspended");
		let init = stubCalls.find((call) => call.method === "initialize");
		expect((init!.arg as PlatformMeta).status).toBe("suspended");
	});

	test("provisions a blog suspended when the subscription is past_due", async () => {
		let accountId = await seedAccount();
		await Subscription.upsert(harness.db, accountId, { status: "past_due" });
		let provisioner = new BlogProvisioner(harness.db);

		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });

		expect(blog.status).toBe("suspended");
	});

	test("provisions a blog active when the subscription is active", async () => {
		let accountId = await seedAccount();
		await Subscription.upsert(harness.db, accountId, { status: "active" });
		let provisioner = new BlogProvisioner(harness.db);

		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });

		expect(blog.status).toBe("active");
		let init = stubCalls.find((call) => call.method === "initialize");
		expect((init!.arg as PlatformMeta).status).toBe("active");
	});

	test("provisions a blog active when the subscription is trialing", async () => {
		let accountId = await seedAccount();
		await Subscription.upsert(harness.db, accountId, { status: "trialing" });
		let provisioner = new BlogProvisioner(harness.db);

		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });

		expect(blog.status).toBe("active");
	});

	test("caches the slug in KV and pushes config to the Durable Object", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);

		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });

		expect(slugCache.get(`slug:${blog.slug}`)).toBe(
			JSON.stringify({ blogId: blog.id, region: "wnam" }),
		);
		expect(stubCalls.some((call) => call.method === "initialize")).toBe(true);
	});

	test("seeds the pushed OIDC client credentials from the provisioning fetch", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);

		await provisioner.create({ accountId, name: "My Blog", region: "wnam" });

		let init = stubCalls.find((call) => call.method === "initialize")!.arg as PlatformMeta;
		expect(init.oidc_client_id).toBe("oidc-client-id");
		expect(init.oidc_client_secret).toBe("oidc-client-secret");
		expect(init.owner).toBe("sub-1@example.com");
		expect(fetchedUrls).toContain("https://sso.test/oauth/token");
		expect(fetchedUrls).toContain("https://sso.test/api/clients");
	});
});

describe("BlogProvisioner.create — slug generation", () => {
	test("slugifies the blog name (lowercase, hyphen-separated)", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);

		let blog = await provisioner.create({ accountId, name: "My Cool Blog!", region: "wnam" });

		expect(blog.slug).toBe("my-cool-blog");
	});

	test("falls back to 'blog' when the name has no slug-safe characters", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);

		let blog = await provisioner.create({ accountId, name: "!!!", region: "wnam" });

		expect(blog.slug).toBe("blog");
	});

	test("suffixes a reserved subdomain slug with -blog", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);

		let blog = await provisioner.create({ accountId, name: "api", region: "wnam" });

		expect(blog.slug).toBe("api-blog");
	});

	test("disambiguates a colliding slug with a random suffix", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);
		let first = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });

		let second = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });

		expect(first.slug).toBe("my-blog");
		expect(second.slug).not.toBe("my-blog");
		expect(second.slug.startsWith("my-blog-")).toBe(true);
	});
});

describe("BlogProvisioner.create — provisioning failures", () => {
	test("leaves the blog row in provisioning when OIDC provisioning fails", async () => {
		let accountId = await seedAccount();
		// Fail the management-token request so provisioning throws mid-flight.
		stubFetch((url) => {
			if (url.endsWith("/oauth/token")) return new Response("nope", { status: 500 });
			return defaultOidcFetch(url);
		});
		let provisioner = new BlogProvisioner(harness.db);

		await expect(
			provisioner.create({ accountId, name: "My Blog", region: "wnam" }),
		).rejects.toThrow();

		// The row was created before the failure and remains retryable.
		let blog = await Blog.findBySlug(harness.db, "my-blog");
		expect(blog?.status).toBe("provisioning");
	});
});

describe("BlogProvisioner lifecycle side effects", () => {
	test("softDelete marks the blog deleted, drops the KV entry and 410s the DO", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);
		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
		stubCalls = [];

		await provisioner.softDelete(blog.id);

		expect((await Blog.findById(harness.db, blog.id))?.status).toBe("deleted");
		expect(slugCache.has(`slug:${blog.slug}`)).toBe(false);
		expect(stubCalls).toContainEqual({ method: "updateMeta", arg: { status: "deleted" } });
	});

	test("restore re-activates an entitled blog, re-adds the KV entry and reactivates the DO", async () => {
		let accountId = await seedAccount();
		// An entitling subscription is required for restore to bring the blog back active.
		await Subscription.upsert(harness.db, accountId, { status: "active" });
		let provisioner = new BlogProvisioner(harness.db);
		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
		await provisioner.softDelete(blog.id);
		stubCalls = [];

		await provisioner.restore(blog.id);

		expect((await Blog.findById(harness.db, blog.id))?.status).toBe("active");
		expect(slugCache.get(`slug:${blog.slug}`)).toBe(
			JSON.stringify({ blogId: blog.id, region: "wnam" }),
		);
		expect(stubCalls).toContainEqual({ method: "updateMeta", arg: { status: "active" } });
	});

	test("restore brings a blog back suspended when the account is not entitled", async () => {
		// No active/trialing subscription: restoring must not silently re-serve the blog.
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);
		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
		await provisioner.softDelete(blog.id);
		stubCalls = [];

		await provisioner.restore(blog.id);

		expect((await Blog.findById(harness.db, blog.id))?.status).toBe("suspended");
		// The slug cache is still re-seeded; the DO's own gate 402s public traffic.
		expect(slugCache.get(`slug:${blog.slug}`)).toBe(
			JSON.stringify({ blogId: blog.id, region: "wnam" }),
		);
		expect(stubCalls).toContainEqual({ method: "updateMeta", arg: { status: "suspended" } });
	});

	test("restore re-suspends when the subscription lapsed to past_due after deletion", async () => {
		let accountId = await seedAccount();
		await Subscription.upsert(harness.db, accountId, { status: "active" });
		let provisioner = new BlogProvisioner(harness.db);
		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
		await provisioner.softDelete(blog.id);
		// Billing lapsed while the blog was soft-deleted.
		await Subscription.upsert(harness.db, accountId, { status: "past_due" });
		stubCalls = [];

		await provisioner.restore(blog.id);

		expect((await Blog.findById(harness.db, blog.id))?.status).toBe("suspended");
		expect(stubCalls).toContainEqual({ method: "updateMeta", arg: { status: "suspended" } });
	});

	test("purge destroys the DO and removes the blog row", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);
		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
		stubCalls = [];

		await provisioner.purge(blog.id);

		expect(await Blog.findById(harness.db, blog.id)).toBeNull();
		expect(stubCalls).toContainEqual({ method: "destroy", arg: undefined });
	});

	test("purge deletes the Cloudflare custom hostname before destroying the DO/row", async () => {
		let accountId = await seedAccount();
		// Record the order of side effects so we can assert CF deletion happens first,
		// before the D1 row cascade would remove the hostname id we need.
		let events: string[] = [];
		let hostnames = {
			delete: async (id: string) => void events.push(`cf-delete:${id}`),
		};
		let provisioner = new BlogProvisioner(harness.db, hostnames as unknown as HostnameClient);
		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
		await Hostname.create(harness.db, {
			id: "hn_cf_1",
			blogId: blog.id,
			hostname: "blog.example.com",
		});
		stubCalls = [];

		await provisioner.purge(blog.id);

		// Cloudflare deletion ran (with the stored id) and the blog row is gone. In
		// production the D1 FK cascade then removes the local hostname row.
		expect(events).toEqual(["cf-delete:hn_cf_1"]);
		expect(stubCalls).toContainEqual({ method: "destroy", arg: undefined });
		expect(await Blog.findById(harness.db, blog.id)).toBeNull();
	});

	test("purge leaves the blog for retry when Cloudflare hostname deletion fails", async () => {
		let accountId = await seedAccount();
		let hostnames = {
			delete: async () => {
				throw new Error("cloudflare down");
			},
		};
		let provisioner = new BlogProvisioner(harness.db, hostnames as unknown as HostnameClient);
		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
		await Hostname.create(harness.db, {
			id: "hn_cf_2",
			blogId: blog.id,
			hostname: "blog.example.com",
		});
		stubCalls = [];

		await expect(provisioner.purge(blog.id)).rejects.toThrow();

		// Neither the DO nor the row were touched, so the next purge run retries cleanly.
		expect(await Blog.findById(harness.db, blog.id)).not.toBeNull();
		expect(await Hostname.findByBlog(harness.db, blog.id)).not.toBeNull();
		expect(stubCalls).not.toContainEqual({ method: "destroy", arg: undefined });
	});

	test("purge without a custom hostname skips Cloudflare deletion", async () => {
		let accountId = await seedAccount();
		let deletedIds: string[] = [];
		let hostnames = { delete: async (id: string) => void deletedIds.push(id) };
		let provisioner = new BlogProvisioner(harness.db, hostnames as unknown as HostnameClient);
		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
		stubCalls = [];

		await provisioner.purge(blog.id);

		expect(deletedIds).toHaveLength(0);
		expect(await Blog.findById(harness.db, blog.id)).toBeNull();
	});

	test("activateCustomHostname flips the flag and pushes the canonical host", async () => {
		let accountId = await seedAccount();
		let provisioner = new BlogProvisioner(harness.db);
		let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
		stubCalls = [];

		await provisioner.activateCustomHostname(blog.id, "www.example.com");

		expect((await Blog.findById(harness.db, blog.id))?.custom_hostname_active).toBe(1);
		expect(stubCalls).toContainEqual({
			method: "updateMeta",
			arg: { canonical_host: "www.example.com", custom_hostname_active: 1 },
		});
	});

	test("setAccountBlogsStatus fans a status change out to every blog of the account", async () => {
		let accountId = await seedAccount();
		await Subscription.upsert(harness.db, accountId, { status: "active" });
		let provisioner = new BlogProvisioner(harness.db);
		let first = await provisioner.create({ accountId, name: "First", region: "wnam" });
		let second = await provisioner.create({ accountId, name: "Second", region: "wnam" });
		stubCalls = [];

		await provisioner.setAccountBlogsStatus(accountId, "suspended");

		expect((await Blog.findById(harness.db, first.id))?.status).toBe("suspended");
		expect((await Blog.findById(harness.db, second.id))?.status).toBe("suspended");
		let updates = stubCalls.filter((call) => call.method === "updateMeta");
		expect(updates).toHaveLength(2);
		expect(updates.every((call) => (call.arg as { status: string }).status === "suspended")).toBe(
			true,
		);
	});

	test("softDelete is a no-op for an unknown blog id", async () => {
		let provisioner = new BlogProvisioner(harness.db);

		await provisioner.softDelete("does-not-exist");

		expect(stubCalls).toHaveLength(0);
	});
});
