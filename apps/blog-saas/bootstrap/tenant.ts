/**
 * The per-tenant Blog Durable Object: a thin host that stores control-plane-pushed
 * config in its own SQLite, boots `@pkg/blog-engine` over a SqlStorage adapter,
 * enforces lifecycle state (suspended/deleted/custom-domain), and forwards requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BlogEngine } from "@pkg/blog-engine";

import { createBlogEngine } from "@pkg/blog-engine";
import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";

/** Control-plane-pushed tenant configuration, stored in the DO's own SQLite. */
export interface PlatformMeta {
	blog_id: string;
	title: string;
	/** `{slug}.blog.sergiodxa.com` */
	subdomain_host: string;
	/** `subdomain_host` or the active custom domain. */
	canonical_host: string;
	custom_hostname_active: 0 | 1;
	status: "active" | "suspended" | "deleted";
	oidc_issuer: string;
	oidc_client_id: string;
	oidc_client_secret: string;
	cookie_secret: string;
	/** Owner email/subject, pre-authorized as the blog's first admin. */
	owner: string;
}

/**
 * Builds the minimal placeholder page served for a suspended blog, prompting the
 * owner to fix billing. Returned instead of the real site so public traffic hits a
 * clear message rather than an error.
 *
 * @returns A 402 Payment Required HTML response.
 */
function suspendedPage(): Response {
	return new Response(
		`<!doctype html><meta charset="utf-8"><title>Suspended</title>` +
			`<body style="font-family:system-ui;max-width:32rem;margin:6rem auto;text-align:center">` +
			`<h1>This blog is temporarily unavailable</h1>` +
			`<p>The owner needs to update their billing to restore it.</p></body>`,
		{ status: 402, headers: { "content-type": "text/html; charset=utf-8" } },
	);
}

/**
 * Per-tenant Durable Object hosting a blog. A thin host, not an application: it
 * stores control-plane-pushed config in its own SQLite, boots `@pkg/blog-engine`
 * over a SqlStorage adapter, enforces lifecycle state, and forwards requests.
 */
export default class Blog extends DurableObject<Cloudflare.Env> {
	/** Cached tenant config; `null` until the DO is provisioned via {@link initialize}. */
	#meta: PlatformMeta | null = null;
	/** The booted blog engine; `null` until config exists and {@link bootEngine} runs. */
	#app: BlogEngine | null = null;

	/**
	 * Rehydrates the DO on wake: ensures the meta table, loads any stored config,
	 * boots the engine if config exists, and (re)schedules the housekeeping alarm —
	 * all inside `blockConcurrencyWhile` so no request is served mid-boot.
	 *
	 * @param ctx Durable Object runtime state (storage, alarms, concurrency).
	 * @param env The worker environment bindings.
	 */
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.ensureMetaTable();
			this.#meta = this.readMeta();
			if (this.#meta) await this.bootEngine(this.#meta);
			await this.scheduleAlarm();
		});
	}

	/** Creates the single-row `platform_meta` table if absent (idempotent). */
	private ensureMetaTable(): void {
		this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS platform_meta (data TEXT NOT NULL);");
	}

	/**
	 * Reads the stored tenant config from the DO's SQLite.
	 *
	 * @returns The parsed {@link PlatformMeta}, or `null` if none is stored or the
	 *   stored JSON is corrupt.
	 */
	private readMeta(): PlatformMeta | null {
		let rows = [
			...this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM platform_meta LIMIT 1;"),
		];
		if (rows.length === 0) return null;
		try {
			return JSON.parse(rows[0]!.data) as PlatformMeta;
		} catch {
			return null;
		}
	}

	/**
	 * Persists tenant config, replacing any existing row, and updates the in-memory
	 * cache so subsequent reads see the new value without a round-trip.
	 *
	 * @param meta The tenant config to store.
	 */
	private writeMeta(meta: PlatformMeta): void {
		this.ctx.storage.sql.exec("DELETE FROM platform_meta;");
		this.ctx.storage.sql.exec("INSERT INTO platform_meta (data) VALUES (?);", JSON.stringify(meta));
		this.#meta = meta;
	}

	/**
	 * Constructs and migrates the `@pkg/blog-engine` instance for this tenant, wiring
	 * it to the DO's own SqlStorage and the per-blog session/OIDC config. Migrations
	 * run here (inside the boot's `blockConcurrencyWhile`) since the engine owns them.
	 *
	 * @param meta The tenant config providing session, auth, and owner settings.
	 */
	private async bootEngine(meta: PlatformMeta): Promise<void> {
		this.#app = createBlogEngine({
			database: createSQLStorageDatabaseAdapter(this.ctx.storage.sql),
			migrations: "manual",
			isProd: true,
			session: { secret: meta.cookie_secret },
			auth: {
				issuer: meta.oidc_issuer,
				clientId: meta.oidc_client_id,
				clientSecret: meta.oidc_client_secret,
				admins: [meta.owner],
				// Multi-tenant: only the provisioned owner (allow-listed above) may be an
				// admin. Disable the first-user bootstrap so a stray SSO visitor to a
				// freshly provisioned tenant cannot claim admin before the owner does.
				bootstrapFirstAdmin: false,
			},
		});
		// Engine-owned migrations, inside blockConcurrencyWhile on boot.
		await this.#app.migrate();
	}

	// ---- RPC surface (control plane only) ----

	/**
	 * One-time provisioning called by the control plane before the hostname goes live:
	 * stores config, boots the engine, and schedules housekeeping. Idempotent, so a
	 * retried provisioning attempt is safe.
	 *
	 * @param meta The full tenant config to install.
	 */
	async initialize(meta: PlatformMeta): Promise<void> {
		this.ensureMetaTable();
		this.writeMeta(meta);
		await this.bootEngine(meta);
		await this.scheduleAlarm();
	}

	/**
	 * Push-based config sync from the control plane (suspension, custom-domain
	 * activation, title changes). Merges the patch over current config and reboots the
	 * engine so the change takes effect; a no-op if the DO was never initialized.
	 *
	 * @param patch The subset of {@link PlatformMeta} fields to overwrite.
	 */
	async updateMeta(patch: Partial<PlatformMeta>): Promise<void> {
		let current = this.#meta ?? this.readMeta();
		if (!current) return;
		let next = { ...current, ...patch };
		this.writeMeta(next);
		await this.bootEngine(next);
	}

	/**
	 * Reports lightweight tenant stats for the dashboard without exposing engine
	 * internals.
	 *
	 * @returns The DO's SQLite database size in bytes.
	 */
	async getStats(): Promise<{ databaseSize: number }> {
		return { databaseSize: this.ctx.storage.sql.databaseSize };
	}

	/**
	 * Hard-deletes the tenant: deletes the alarm and wipes all DO storage so the
	 * Durable Object stops incurring cost and effectively ceases to exist. Called by
	 * the purge job after the retention window.
	 */
	async destroy(): Promise<void> {
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
		this.#meta = null;
		this.#app = null;
	}

	// ---- Request path ----

	/**
	 * Serves a request through the tenant's blog engine after enforcing lifecycle
	 * gates: unprovisioned → 404, deleted → 410, custom-domain-active subdomain hides
	 * public pages (admin stays), suspended → 402 for public paths (`/cms` stays open).
	 *
	 * @param request The incoming request routed to this tenant DO.
	 * @returns The engine's response, or a lifecycle-gate response (404/410/402).
	 */
	override async fetch(request: Request): Promise<Response> {
		if (!this.#meta || !this.#app) return new Response("Not found", { status: 404 });
		let meta = this.#meta;
		let url = new URL(request.url);

		// Deleted blogs answer 410 during the retention window (before purge).
		if (meta.status === "deleted") return new Response("Gone", { status: 410 });

		// Once the custom domain is active the public site moves there and the subdomain
		// stops serving public pages (no redirect). The admin surface (`/cms`, `/auth`)
		// stays on the subdomain because the per-blog OIDC client's callback is
		// registered there; otherwise activating a domain would lock the owner out.
		if (meta.custom_hostname_active === 1 && url.hostname === meta.subdomain_host) {
			let isAdminPath = url.pathname.startsWith("/cms") || url.pathname.startsWith("/auth");
			if (!isAdminPath) return new Response("Not found", { status: 404 });
		}

		// Suspension: public traffic blocked; /cms stays reachable to fix billing.
		if (meta.status === "suspended" && !url.pathname.startsWith("/cms")) {
			return suspendedPage();
		}

		return this.#app.fetch(request);
	}

	/**
	 * Durable Object alarm handler; fires daily and simply re-arms the next alarm so
	 * the DO keeps a heartbeat for future housekeeping.
	 */
	override async alarm(): Promise<void> {
		await this.scheduleAlarm();
	}

	/** Schedules the daily housekeeping alarm at the next midnight UTC if unset. */
	private async scheduleAlarm(): Promise<void> {
		let existing = await this.ctx.storage.getAlarm();
		if (existing) return;
		let tomorrow = new Date();
		tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
		tomorrow.setUTCHours(0, 0, 0, 0);
		await this.ctx.storage.setAlarm(tomorrow.getTime());
	}
}
