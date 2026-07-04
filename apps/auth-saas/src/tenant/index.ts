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

	override fetch(request: Request) {
		return this.#provider.fetch(request);
	}

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
