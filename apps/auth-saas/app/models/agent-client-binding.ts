/**
 * Data model for agent client bindings: which tenant a machine credential
 * registered against the platform tenant may reach. Wraps the
 * `agent_client_bindings` D1 table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** One agent client binding row as the control plane stores it. */
export type AgentClientBindingRow = TableRow<typeof AgentClientBinding.table>;

/**
 * Active-record–style model for agent client bindings, exposing static query
 * and mutation helpers over the `agent_client_bindings` table.
 *
 * @example
 * let binding = await AgentClientBinding.findByClientId(db, clientId);
 */
export default class AgentClientBinding {
	/** The `agent_client_bindings` D1 table definition, keyed on the client id it names. */
	static table = table({
		name: "agent_client_bindings",
		primaryKey: ["client_id"],
		columns: {
			client_id: c.text(),
			tenant_id: c.text(),
			created_at: c.integer(),
		},
	});

	/**
	 * Writes the row naming which tenant a newly-registered machine client may reach.
	 *
	 * @param db - Database connection.
	 * @param data - The client id the binding names, and the tenant it may reach.
	 * @returns A promise resolving to the newly-created row.
	 */
	static create(
		db: Database,
		data: { clientId: string; tenantId: string },
	): Promise<AgentClientBindingRow> {
		return db.create(
			AgentClientBinding.table,
			{
				client_id: data.clientId,
				tenant_id: data.tenantId,
				created_at: Date.now(),
			},
			{ returnRow: true },
		);
	}

	/**
	 * Finds the tenant a client id is bound to.
	 *
	 * @param db - Database connection.
	 * @param clientId - The client id a bearer token named.
	 * @returns A promise resolving to the binding row, or null for a client with
	 * no binding — a person's own client, rather than a machine's.
	 */
	static findByClientId(db: Database, clientId: string): Promise<AgentClientBindingRow | null> {
		return db.findOne(AgentClientBinding.table, { where: { client_id: clientId } });
	}

	/**
	 * Lists every machine credential registered against a tenant, oldest first.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @returns A promise resolving to the tenant's agent client binding rows.
	 */
	static listByTenantId(db: Database, tenantId: string): Promise<AgentClientBindingRow[]> {
		return db.findMany(AgentClientBinding.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Deletes a client's binding, for a client disabled or deleted at its own tenant.
	 *
	 * @param db - Database connection.
	 * @param clientId - The client id whose binding to delete.
	 * @returns A promise resolving to whether a row was deleted.
	 */
	static deleteByClientId(db: Database, clientId: string): Promise<boolean> {
		return db.delete(AgentClientBinding.table, { client_id: clientId });
	}
}
