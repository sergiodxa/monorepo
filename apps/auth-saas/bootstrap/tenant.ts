/**
 * Defines the per-tenant Durable Object that hosts an isolated OIDC provider instance.
 * Each tenant gets its own SqlStorage-backed database, signing keys, and cleanup alarm;
 * this class wires those up and forwards HTTP requests to `@pkg/oidc-provider`.
 *
 * The DO also enforces the tenant-runtime entitlement gate: when the control plane
 * suspends a tenant (billing lapse or operator action) it pushes a `suspended` flag in
 * here, and the DO blocks its OIDC/OAuth2 provider surface itself — independent of the
 * control-plane database — so traffic that reaches the DO directly via Cloudflare for
 * SaaS `hostMetadata` is stopped too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OidcProvider } from "@pkg/oidc-provider";

import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";
import { createOidcProvider, verifyInternalToken } from "@pkg/oidc-provider";
import { DurableObject } from "cloudflare:workers";

import { shouldBlockWhileSuspended, suspendedResponse } from "~/app/lib/entitlement";
import AnalyticsService from "~/app/services/analytics";

/**
 * Durable Object storage key holding the tenant's suspension flag. Stored in the DO's
 * key-value storage (not the provider's SQL database) so the entitlement gate never
 * depends on the provider engine or its migrations.
 */
const SUSPENDED_STORAGE_KEY = "entitlement:suspended";

/** Internal control endpoint the control plane calls to set/clear the suspension flag. */
const SUSPEND_CONTROL_PATH = "/__control/suspend";

/**
 * Per-tenant Durable Object hosting the OIDC provider.
 *
 * A thin wrapper: it builds the SqlStorage-backed database adapter and forwards
 * everything to `@pkg/oidc-provider`, injecting the internal-token secret and an
 * analytics sink that forwards to the platform's Analytics Engine service. It also
 * owns the tenant's suspension flag and blocks provider traffic while suspended.
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
			// Run migrations inside blockConcurrencyWhile so the DO never serves a request
			// against an unmigrated schema.
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
	 * Handles an incoming HTTP request. Serves the internal suspension-control endpoint,
	 * enforces the entitlement gate (blocking the OIDC/OAuth2 provider surface while the
	 * tenant is suspended), and otherwise delegates to the tenant's OIDC provider.
	 *
	 * @param request - The request forwarded to this tenant DO.
	 * @returns The control-endpoint response, a `402` when suspended, or the provider's response.
	 */
	override async fetch(request: Request) {
		let pathname = new URL(request.url).pathname;

		// The internal control endpoint toggles the suspension flag and never reaches the
		// provider; it is always available so a suspended tenant can be un-suspended.
		if (pathname === SUSPEND_CONTROL_PATH) return await this.handleSuspendControl(request);

		// Block the public provider surface while suspended; the Management API stays
		// reachable so the control plane can still manage and re-provision the tenant.
		if (this.#suspended && shouldBlockWhileSuspended(pathname)) return suspendedResponse();

		return this.#provider.fetch(request);
	}

	/**
	 * Internal control endpoint (`POST /__control/suspend`) that sets or clears the
	 * tenant's suspension flag. Authenticated with the shared internal token (the same
	 * secret and `X-Internal-Token` header the Management API uses), so only the control
	 * plane can toggle entitlement.
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
	 * the next daily alarm.
	 *
	 * @returns A promise that resolves once cleanup and rescheduling complete.
	 */
	override async alarm() {
		await this.#provider.cleanup();
		await this.scheduleCleanupAlarm();
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
