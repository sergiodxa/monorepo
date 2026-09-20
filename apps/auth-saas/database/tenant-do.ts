/**
 * The per-tenant Durable Object. One object holds one tenant's identity state — its
 * settings, and later its subjects, clients, sessions and signing keys — in the SQLite
 * database Cloudflare gives the object, reachable by no query that could reach another
 * tenant's.
 *
 * It exposes typed RPC methods only, no `fetch` handler. A caller reaches this object for
 * a whole operation it validates and performs itself, never a query it would have to
 * assemble the rest of somewhere else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { column as c, Database, table } from "remix/data-table";

import { runMigrations } from "./tenant-migrations";

/** One row: the tenant id this object is addressed by, its issuer, and its creation time. */
const settings = table({
	name: "settings",
	primaryKey: ["tenant_id"],
	columns: {
		tenant_id: c.text(),
		issuer: c.text(),
		created_at: c.integer(),
	},
});

/** What `provision` hands back: the schema now applied, and the issuer it recorded. */
export interface ProvisionResult {
	applied: string[];
	issuer: string;
}

/**
 * One tenant's identity state, isolated in this object's own SQLite database.
 */
export default class Tenant extends DurableObject<Cloudflare.Env> {
	#db: Database;

	/** The migrations applied during construction, read by `provision` once it settles. */
	#migrated: Promise<{ applied: string[] }>;

	/**
	 * Opens this tenant's database and applies whatever schema has not run yet, queuing
	 * every method behind it so none observes a half-applied schema.
	 *
	 * @param ctx - The object's storage, alarms and concurrency gate.
	 * @param env - The Worker's bindings.
	 */
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);

		let driver = createSQLStorageDatabaseAdapter(ctx.storage.sql);
		this.#db = new Database(driver);
		this.#migrated = ctx.blockConcurrencyWhile(() => runMigrations(driver));
	}

	/**
	 * Provisions this tenant: waits on the schema the constructor already started
	 * migrating, then records the tenant's id and issuer in `settings`. A first boot and a
	 * catch-up boot behind several releases take the same path, because both wait on the
	 * one migration run the constructor starts.
	 *
	 * @param input - The tenant id this object is addressed by, and the issuer it mints
	 * tokens under.
	 * @returns The migration ids applied on this boot, and the issuer now recorded.
	 */
	async provision(input: { tenantId: string; issuer: string }): Promise<ProvisionResult> {
		let { applied } = await this.#migrated;

		let existing = await this.#db.find(settings, { tenant_id: input.tenantId });

		if (existing) {
			await this.#db.update(settings, { tenant_id: input.tenantId }, { issuer: input.issuer });
		} else {
			await this.#db.create(settings, {
				tenant_id: input.tenantId,
				issuer: input.issuer,
				created_at: Date.now(),
			});
		}

		return { applied, issuer: input.issuer };
	}

	/**
	 * Destroys everything this object holds, for the control plane's purge job. Nothing
	 * calls this yet; the job that will is out of scope here.
	 */
	async erase(): Promise<void> {
		await this.ctx.storage.deleteAll();
	}
}
