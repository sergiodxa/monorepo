/**
 * Defines the per-tenant Durable Object that hosts an isolated OIDC provider instance.
 * Each tenant gets its own SqlStorage-backed database, signing keys, and cleanup alarm;
 * this class wires those up and forwards HTTP requests to `@pkg/oidc-provider`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OidcProvider } from "@pkg/oidc-provider";

import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";
import { createOidcProvider } from "@pkg/oidc-provider";
import { DurableObject } from "cloudflare:workers";

import AnalyticsService from "~/app/services/analytics";

/**
 * Per-tenant Durable Object hosting the OIDC provider.
 *
 * A thin wrapper: it builds the SqlStorage-backed database adapter and forwards
 * everything to `@pkg/oidc-provider`, injecting the internal-token secret and an
 * analytics sink that forwards to the platform's Analytics Engine service.
 */
export default class Tenant extends DurableObject<Cloudflare.Env> {
	#provider: OidcProvider;

	/**
	 * Constructs the tenant DO, creating the OIDC provider over the DO's SqlStorage and
	 * blocking concurrency until the one-time setup (migrate, keys, alarm) completes.
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

		ctx.blockConcurrencyWhile(() => this.setup());
	}

	/** One-time boot: migrate, ensure signing keys, schedule the cleanup alarm. */
	private async setup() {
		await this.#provider.migrate();
		await this.#provider.ensureSigningKeys();
		await this.scheduleCleanupAlarm();
	}

	/**
	 * Handles an incoming HTTP request by delegating to the tenant's OIDC provider.
	 *
	 * @param request - The request forwarded to this tenant DO.
	 * @returns The OIDC provider's response.
	 */
	override fetch(request: Request) {
		return this.#provider.fetch(request);
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
