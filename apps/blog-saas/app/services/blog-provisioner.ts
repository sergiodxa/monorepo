import type { Database } from "remix/data-table";

import { env } from "cloudflare:workers";

import type { Region } from "~/app/models/blog";
import type Blog from "~/bootstrap/tenant";
import type { PlatformMeta } from "~/bootstrap/tenant";

import Account from "~/app/models/account";
import BlogModel from "~/app/models/blog";
import Subscription from "~/app/models/subscription";

/** Slugs that cannot be used for a blog (reserved subdomains). */
const RESERVED_SLUGS = new Set([
	"sso",
	"www",
	"api",
	"cdn",
	"assets",
	"mail",
	"status",
	"fallback",
]);

/** Typed RPC handle to a Blog Durable Object. */
type BlogStub = DurableObjectStub<Blog>;

/**
 * Owns the blog lifecycle side effects the control plane must keep in sync:
 * slug generation, per-blog OIDC client provisioning, DO config push (RPC), and
 * the KV slug cache. Contained here so "push on every change" stays one service.
 */
export class BlogProvisioner {
	#db: Database;

	constructor(db: Database) {
		this.#db = db;
	}

	/** Provisions a new blog end-to-end. Steps 3-7 are retryable via `provisioning`. */
	async create(input: { accountId: string; name: string; region: Region }): Promise<BlogModelRow> {
		let slug = await this.uniqueSlug(input.name);
		let blog = await BlogModel.create(this.#db, {
			accountId: input.accountId,
			name: input.name,
			slug,
			region: input.region,
		});

		await this.provision(blog.id);
		return (await BlogModel.findById(this.#db, blog.id)) ?? blog;
	}

	/** Runs the retryable provisioning steps for an existing (provisioning) blog. */
	async provision(blogId: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) throw new Error("Blog not found");

		let subdomainHost = `${blog.slug}.${env.PLATFORM_DOMAIN}`;
		let account = await this.accountEmail(blog.account_id);
		let client = await this.provisionOidcClient(blog.slug, subdomainHost);

		// A blog is only served once the account has an entitling subscription; without
		// one it is provisioned suspended and the Polar webhook flips it to active when
		// the subscription becomes active/trialing.
		let entitled = Subscription.isActive(
			await Subscription.findByAccount(this.#db, blog.account_id),
		);
		let status: "active" | "suspended" = entitled ? "active" : "suspended";

		let meta: PlatformMeta = {
			blog_id: blog.id,
			title: blog.name,
			subdomain_host: subdomainHost,
			canonical_host: subdomainHost,
			custom_hostname_active: 0,
			status,
			oidc_issuer: env.OIDC_ISSUER,
			oidc_client_id: client.clientId,
			oidc_client_secret: client.clientSecret,
			cookie_secret: crypto.randomUUID() + crypto.randomUUID(),
			owner: account,
		};

		await this.stub(blog.id, blog.region).initialize(meta);
		await env.SLUG_CACHE.put(
			`slug:${blog.slug}`,
			JSON.stringify({ blogId: blog.id, region: blog.region }),
		);
		await BlogModel.setStatus(this.#db, blog.id, status);
	}

	/** Soft-deletes a blog: 410 from the DO, KV removed; hard purge happens later. */
	async softDelete(blogId: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) return;
		await BlogModel.softDelete(this.#db, blog.id);
		await env.SLUG_CACHE.delete(`slug:${blog.slug}`);
		await this.stub(blog.id, blog.region).updateMeta({ status: "deleted" });
	}

	/** Restores a soft-deleted blog within the retention window. */
	async restore(blogId: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) return;
		await BlogModel.restore(this.#db, blog.id);
		await env.SLUG_CACHE.put(
			`slug:${blog.slug}`,
			JSON.stringify({ blogId: blog.id, region: blog.region }),
		);
		await this.stub(blog.id, blog.region).updateMeta({ status: "active" });
	}

	/** Hard-deletes a blog: DO storage wiped, D1 row removed. */
	async purge(blogId: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) return;
		await this.stub(blog.id, blog.region).destroy();
		await BlogModel.destroy(this.#db, blog.id);
	}

	/** Activates a validated custom domain: subdomain stops working, canonical flips. */
	async activateCustomHostname(blogId: string, hostname: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) return;
		await BlogModel.setCustomHostnameActive(this.#db, blog.id, true);
		await this.stub(blog.id, blog.region).updateMeta({
			canonical_host: hostname,
			custom_hostname_active: 1,
		});
	}

	/** Fans a status change out to every blog of an account (suspend/reactivate). */
	async setAccountBlogsStatus(accountId: string, status: "suspended" | "active"): Promise<void> {
		let blogs = await BlogModel.listByAccount(this.#db, accountId);
		for (let blog of blogs) {
			await BlogModel.setStatus(this.#db, blog.id, status);
			await this.stub(blog.id, blog.region).updateMeta({ status });
		}
	}

	private stub(blogId: string, region: string): BlogStub {
		let locationHint = region as DurableObjectLocationHint;
		return env.BLOG.getByName(blogId, { locationHint }) as unknown as BlogStub;
	}

	private async accountEmail(accountId: string): Promise<string> {
		let account = await Account.findById(this.#db, accountId);
		return account?.email ?? "";
	}

	private async uniqueSlug(name: string): Promise<string> {
		let base =
			name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "")
				.slice(0, 40) || "blog";
		let slug = RESERVED_SLUGS.has(base) ? `${base}-blog` : base;
		if (!(await BlogModel.findBySlug(this.#db, slug))) return slug;
		return `${slug}-${crypto.randomUUID().slice(0, 6)}`;
	}

	/** Provisions a confidential OIDC client for this blog on the sso tenant. */
	private async provisionOidcClient(
		slug: string,
		subdomainHost: string,
	): Promise<{ clientId: string; clientSecret: string }> {
		let token = await this.managementToken();
		let response = await fetch(new URL("/api/clients", env.OIDC_ISSUER), {
			method: "POST",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: JSON.stringify({
				name: `Blog: ${slug}`,
				type: "confidential",
				redirectUris: [`https://${subdomainHost}/auth/callback`],
			}),
		});
		if (!response.ok) throw new Error(`OIDC client provisioning failed: ${response.status}`);
		let data = (await response.json()) as {
			client_id?: string;
			clientId?: string;
			client_secret?: string;
			clientSecret?: string;
		};
		let clientId = data.client_id ?? data.clientId;
		let clientSecret = data.client_secret ?? data.clientSecret;
		if (!clientId || !clientSecret)
			throw new Error("OIDC client provisioning returned no credentials");
		return { clientId, clientSecret };
	}

	/** Obtains an M2M access token for the sso tenant's Management API. */
	private async managementToken(): Promise<string> {
		let response = await fetch(new URL("/oauth/token", env.OIDC_ISSUER), {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				authorization: `Basic ${btoa(`${env.SSO_MANAGEMENT_CLIENT_ID}:${env.SSO_MANAGEMENT_CLIENT_SECRET}`)}`,
			},
			body: new URLSearchParams({ grant_type: "client_credentials" }),
		});
		if (!response.ok) throw new Error(`Management token request failed: ${response.status}`);
		let data = (await response.json()) as { access_token?: string };
		if (!data.access_token) throw new Error("Management token response missing access_token");
		return data.access_token;
	}
}

type BlogModelRow = Awaited<ReturnType<typeof BlogModel.create>>;
