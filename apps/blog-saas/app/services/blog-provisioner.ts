/**
 * The `BlogProvisioner` service: the single place that keeps the control plane and a
 * tenant blog in sync across its lifecycle — slug generation, per-blog OIDC client
 * provisioning, Durable Object config push (RPC), and the KV slug cache.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { HostnameClient } from "@pkg/hostname";
import type { Database } from "remix/data-table";

import { env } from "cloudflare:workers";

import type { Region } from "~/app/models/blog";
import type Blog from "~/bootstrap/tenant";
import type { PlatformMeta } from "~/bootstrap/tenant";

import Account from "~/app/models/account";
import BlogModel from "~/app/models/blog";
import Hostname from "~/app/models/hostname";
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

type BlogStub = DurableObjectStub<Blog>;

/**
 * Owns the blog lifecycle side effects the control plane must keep in sync:
 * slug generation, per-blog OIDC client provisioning, DO config push (RPC), and
 * the KV slug cache. Contained here so "push on every change" stays one service.
 */
export class BlogProvisioner {
	#db: Database;
	#hostnames: HostnameClient | null;

	/**
	 * @param db The control-plane database this provisioner reads and writes.
	 * @param hostnames The Cloudflare custom-hostname client, used by {@link purge} to
	 *   delete the external hostname before removing the local blog. Optional so tests
	 *   and lifecycle paths that skip purging can construct the provisioner directly;
	 *   when absent, {@link purge} still finishes, purging local state only.
	 */
	constructor(db: Database, hostnames: HostnameClient | null = null) {
		this.#db = db;
		this.#hostnames = hostnames;
	}

	/**
	 * Provisions a new blog end-to-end: generates a unique slug, inserts the row in
	 * `provisioning`, then runs the retryable provisioning steps. If provisioning
	 * fails the row stays `provisioning` and can be retried via {@link provision}.
	 *
	 * @param input The new blog's owning account, display name, and region.
	 * @returns The provisioned blog row (or the freshly created row if re-reading fails).
	 * @example
	 * let blog = await provisioner.create({ accountId, name: "My Blog", region: "wnam" });
	 */
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

	/**
	 * Runs the retryable provisioning steps for an existing blog: OIDC client, DO
	 * config push, and the KV slug cache, provisioning active only when the account
	 * is currently entitled and suspended until the Polar webhook activates it.
	 *
	 * @param blogId The id of the (typically `provisioning`) blog to provision.
	 * @returns A promise resolving once provisioning completes.
	 * @throws If no blog exists for `blogId`, or if OIDC client provisioning fails.
	 */
	async provision(blogId: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) throw new Error("Blog not found");

		let subdomainHost = `${blog.slug}.${env.PLATFORM_DOMAIN}`;
		let account = await this.accountEmail(blog.account_id);
		let client = await this.provisionOidcClient(blog.slug, subdomainHost);

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

	/**
	 * Soft-deletes a blog: marks the row deleted (so the DO answers 410), and removes
	 * the KV slug cache entry so the subdomain stops resolving. The hard purge happens
	 * later via {@link purge}. A no-op if the blog does not exist.
	 *
	 * @param blogId The id of the blog to soft-delete.
	 * @returns A promise resolving once the soft delete completes.
	 */
	async softDelete(blogId: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) return;
		await BlogModel.softDelete(this.#db, blog.id);
		await env.SLUG_CACHE.delete(`slug:${blog.slug}`);
		await this.stub(blog.id, blog.region).updateMeta({ status: "deleted" });
	}

	/**
	 * Restores a soft-deleted blog: re-checks billing entitlement so it comes back
	 * active only for a currently entitled account, suspended otherwise, and
	 * re-seeds the KV slug cache either way for the DO's own gate to serve or 402.
	 *
	 * @param blogId The id of the blog to restore.
	 * @returns A promise resolving once the restore completes.
	 */
	async restore(blogId: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) return;
		let entitled = Subscription.isActive(
			await Subscription.findByAccount(this.#db, blog.account_id),
		);
		let status: "active" | "suspended" = entitled ? "active" : "suspended";
		await BlogModel.restore(this.#db, blog.id, status);
		await env.SLUG_CACHE.put(
			`slug:${blog.slug}`,
			JSON.stringify({ blogId: blog.id, region: blog.region }),
		);
		await this.stub(blog.id, blog.region).updateMeta({ status });
	}

	/**
	 * Hard-deletes a blog: deletes its Cloudflare custom hostname, wipes the DO's
	 * storage, and removes the D1 row, deleting the hostname first since the row's
	 * cascade would otherwise remove the id needed to clean it up.
	 *
	 * @param blogId The id of the blog to purge.
	 * @returns A promise resolving once the purge completes.
	 * @throws If the Cloudflare custom-hostname deletion fails (so the cron retries).
	 */
	async purge(blogId: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) return;

		let hostname = await Hostname.findByBlog(this.#db, blog.id);
		if (hostname && this.#hostnames) await this.#hostnames.delete(hostname.id);

		await this.stub(blog.id, blog.region).destroy();
		await BlogModel.destroy(this.#db, blog.id);
	}

	/**
	 * Activates a validated custom domain for a blog: records the flag in D1 and pushes
	 * the new canonical host to the DO, after which the subdomain stops serving public
	 * pages. A no-op if the blog does not exist.
	 *
	 * @param blogId The id of the blog to activate the domain for.
	 * @param hostname The validated custom hostname to make canonical.
	 * @returns A promise resolving once activation completes.
	 */
	async activateCustomHostname(blogId: string, hostname: string): Promise<void> {
		let blog = await BlogModel.findById(this.#db, blogId);
		if (!blog) return;
		await BlogModel.setCustomHostnameActive(this.#db, blog.id, true);
		await this.stub(blog.id, blog.region).updateMeta({
			canonical_host: hostname,
			custom_hostname_active: 1,
		});
	}

	/**
	 * Fans a status change out to every blog of an account, updating each D1 row and
	 * pushing the status to each DO. Used by the Polar webhook to suspend or reactivate
	 * all of an account's blogs on subscription changes.
	 *
	 * @param accountId The account whose blogs to update.
	 * @param status The status to apply to every blog.
	 * @returns A promise resolving once all blogs are updated.
	 */
	async setAccountBlogsStatus(accountId: string, status: "suspended" | "active"): Promise<void> {
		let blogs = await BlogModel.listByAccount(this.#db, accountId);
		for (let blog of blogs) {
			await BlogModel.setStatus(this.#db, blog.id, status);
			await this.stub(blog.id, blog.region).updateMeta({ status });
		}
	}

	/**
	 * Resolves the typed RPC stub for a blog's Durable Object, pinned near its region.
	 *
	 * @param blogId The blog id used to address the DO by name.
	 * @param region The blog's region, used as a DO location hint.
	 * @returns A typed stub for RPC calls to the blog DO.
	 */
	private stub(blogId: string, region: string): BlogStub {
		let locationHint = region as DurableObjectLocationHint;
		return env.BLOG.getByName(blogId, { locationHint }) as unknown as BlogStub;
	}

	/**
	 * Looks up an account's email, used as the blog owner (first admin) in the DO
	 * config.
	 *
	 * @param accountId The account id.
	 * @returns The account's email, or an empty string if the account is missing.
	 */
	private async accountEmail(accountId: string): Promise<string> {
		let account = await Account.findById(this.#db, accountId);
		return account?.email ?? "";
	}

	/**
	 * Derives a URL-safe, unique slug from a blog name: lowercased and hyphenated,
	 * avoiding reserved subdomains, and suffixed with random hex if the base collides
	 * with an existing blog.
	 *
	 * @param name The blog's display name.
	 * @returns A slug not currently used by any blog and not reserved.
	 */
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

	/**
	 * Provisions a confidential OIDC client for this blog on the sso tenant, with its
	 * callback registered on the blog's subdomain so admin auth keeps working even
	 * after a custom domain is activated.
	 *
	 * @param slug The blog slug, used to name the client.
	 * @param subdomainHost The blog's subdomain host, used to build the redirect URI.
	 * @returns The new client's credentials.
	 * @throws If the provisioning request fails or returns no credentials.
	 */
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

	/**
	 * Obtains a machine-to-machine access token for the sso tenant's Management API
	 * via the client-credentials grant, used to authorize OIDC client provisioning.
	 *
	 * @returns The bearer access token.
	 * @throws If the token request fails or the response has no `access_token`.
	 */
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
