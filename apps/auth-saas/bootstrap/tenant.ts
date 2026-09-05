/**
 * Per-tenant Durable Object hosting an isolated OIDC provider instance with its
 * own SqlStorage-backed database, signing keys, and cleanup alarm. A suspension
 * flag set by the control plane blocks the OIDC/OAuth2 surface in the DO itself,
 * stopping traffic that reaches it directly via Cloudflare for SaaS
 * `hostMetadata`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OidcProvider } from "@sdxc/oidc-provider";

import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { createOidcProvider, verifyInternalToken } from "@sdxc/oidc-provider";
import { DurableObject } from "cloudflare:workers";

import { shouldBlockWhileSuspended, suspendedResponse } from "~/app/lib/entitlement";
import AnalyticsService from "~/app/services/analytics";

import { logger } from "./logger";

/**
 * Durable Object storage key holding the tenant's suspension flag, kept in the
 * DO's own key-value storage so the entitlement gate stays independent of the
 * provider engine and its migrations.
 */
const SUSPENDED_STORAGE_KEY = "entitlement:suspended";

/** Internal control endpoint the control plane calls to set/clear the suspension flag. */
const SUSPEND_CONTROL_PATH = "/__control/suspend";

/**
 * Wraps `@sdxc/oidc-provider` over the DO's SqlStorage, injecting the
 * internal-token secret and an analytics sink for the platform's Analytics
 * Engine.
 */
export default class Tenant extends DurableObject<Cloudflare.Env> {
	#provider: OidcProvider;

	/**
	 * In-memory copy of the persisted suspension flag, loaded once during {@link setup}
	 * so the entitlement gate adds no per-request storage read. Kept in sync whenever the
	 * control endpoint changes it.
	 */
	#suspended = false;

	/**
	 * Constructs the tenant DO, creating the OIDC provider over the DO's SqlStorage and
	 * blocking concurrency until the one-time setup (migrate, keys, alarm, suspension
	 * flag) completes.
	 *
	 * @param ctx - The Durable Object state (storage, concurrency controls).
	 * @param env - The Cloudflare worker environment bindings.
	 */
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);

		this.#provider = createOidcProvider({
			database: createSQLStorageDatabaseAdapter(ctx.storage.sql),
			internalSecret: env.INTERNAL_SECRET,
			analytics: {
				trackAuthentication: (tenantId, subjectId) =>
					AnalyticsService.trackAuthentication(tenantId, subjectId),
				trackRegistration: (tenantId, subjectId) =>
					AnalyticsService.trackRegistration(tenantId, subjectId),
			},
			migrations: "manual",
		});

		void ctx.blockConcurrencyWhile(() => this.setup());
	}

	/**
	 * One-time boot: migrate, ensure signing keys, load the suspension flag, and schedule
	 * the cleanup alarm.
	 */
	private async setup() {
		await this.#provider.migrate();
		await this.#provider.ensureSigningKeys();
		this.#suspended = (await this.ctx.storage.get<boolean>(SUSPENDED_STORAGE_KEY)) ?? false;
		await this.scheduleCleanupAlarm();
	}

	/**
	 * Opens the request's log with the tenant's id, so the provider's own middleware
	 * joins it and one record carries both the tenant and the route. Checks the control
	 * endpoint first, unconditionally, so a suspended tenant can always be un-suspended,
	 * then blocks the OIDC/OAuth2 surface while suspended — the Management API stays
	 * reachable so the control plane can still manage it.
	 *
	 * @param request - The request forwarded to this tenant DO.
	 * @returns The control-endpoint response, a `402` when suspended, or the provider's response.
	 */
	override fetch(request: Request) {
		return logger.open("request", { tenant: { id: this.tenantId } }).run(async (log) => {
			let pathname = new URL(request.url).pathname;

			if (pathname === SUSPEND_CONTROL_PATH) {
				let response = await this.handleSuspendControl(request);
				log.set({ http: { status: response.status } });
				return response;
			}

			if (this.#suspended && shouldBlockWhileSuspended(pathname)) {
				let response = suspendedResponse();
				log.note("tenant.suspended").set({ http: { status: response.status } });
				return response;
			}

			return this.#provider.fetch(request);
		});
	}

	/**
	 * The id the control plane addresses this tenant by. Stubs are obtained by name, so
	 * the name is the tenant id; the hex id stands in for an object reached any other way.
	 */
	private get tenantId(): string {
		return this.ctx.id.name ?? this.ctx.id.toString();
	}

	/**
	 * Internal control endpoint (`POST /__control/suspend`) that sets or clears the
	 * tenant's suspension flag, authenticated with the shared internal token so only
	 * the control plane can toggle entitlement.
	 *
	 * @param request - The control request carrying `{ suspended: boolean }` as JSON.
	 * @returns `200` on success, `401` for a missing/invalid token, `400` for a bad body.
	 */
	private async handleSuspendControl(request: Request): Promise<Response> {
		if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

		let token = request.headers.get("x-internal-token");
		if (!token || !(await verifyInternalToken(token, this.env.INTERNAL_SECRET))) {
			return new Response(JSON.stringify({ error: "unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		let body = (await request.json().catch(() => null)) as { suspended?: unknown } | null;
		if (!body || typeof body.suspended !== "boolean") {
			return new Response(JSON.stringify({ error: "invalid_request" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		this.#suspended = body.suspended;
		await this.ctx.storage.put(SUSPENDED_STORAGE_KEY, body.suspended);

		return new Response(JSON.stringify({ ok: true, suspended: body.suspended }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Durable Object alarm handler: runs the provider's periodic cleanup and reschedules
	 * the next daily alarm, inside an `alarm` log carrying the tenant's id.
	 *
	 * @returns A promise that resolves once cleanup and rescheduling complete.
	 */
	override alarm() {
		return logger.open("alarm", { tenant: { id: this.tenantId } }).run(async () => {
			await this.#provider.cleanup();
			await this.scheduleCleanupAlarm();
		});
	}

	/** Schedules the daily cleanup alarm at the next midnight UTC if none is set. */
	private async scheduleCleanupAlarm() {
		let existingAlarm = await this.ctx.storage.getAlarm();
		if (existingAlarm) return;

		let tomorrow = new Date();
		tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
		tomorrow.setUTCHours(0, 0, 0, 0);
		await this.ctx.storage.setAlarm(tomorrow.getTime());
	}
}
