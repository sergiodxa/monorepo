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

/** Minimal "suspended" placeholder page (402 Payment Required). */
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
	#meta: PlatformMeta | null = null;
	#app: BlogEngine | null = null;

	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.ensureMetaTable();
			this.#meta = this.readMeta();
			if (this.#meta) await this.bootEngine(this.#meta);
			await this.scheduleAlarm();
		});
	}

	private ensureMetaTable(): void {
		this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS platform_meta (data TEXT NOT NULL);");
	}

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

	private writeMeta(meta: PlatformMeta): void {
		this.ctx.storage.sql.exec("DELETE FROM platform_meta;");
		this.ctx.storage.sql.exec("INSERT INTO platform_meta (data) VALUES (?);", JSON.stringify(meta));
		this.#meta = meta;
	}

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
			},
		});
		// Engine-owned migrations, inside blockConcurrencyWhile on boot.
		await this.#app.migrate();
	}

	// ---- RPC surface (control plane only) ----

	/** One-time provisioning before the hostname goes live. Idempotent. */
	async initialize(meta: PlatformMeta): Promise<void> {
		this.ensureMetaTable();
		this.writeMeta(meta);
		await this.bootEngine(meta);
		await this.scheduleAlarm();
	}

	/** Push-based config sync (suspension, custom-domain activation, title changes). */
	async updateMeta(patch: Partial<PlatformMeta>): Promise<void> {
		let current = this.#meta ?? this.readMeta();
		if (!current) return;
		let next = { ...current, ...patch };
		this.writeMeta(next);
		await this.bootEngine(next);
	}

	/** Dashboard stats without exposing engine internals. */
	async getStats(): Promise<{ databaseSize: number }> {
		return { databaseSize: this.ctx.storage.sql.databaseSize };
	}

	/** Hard delete: wipes SQLite + alarm so the DO stops billing and ceases to exist. */
	async destroy(): Promise<void> {
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
		this.#meta = null;
		this.#app = null;
	}

	// ---- Request path ----

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
