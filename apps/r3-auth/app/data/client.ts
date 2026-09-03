/**
 * Data access for registered OAuth clients: lookup, the paginated listing and count
 * the admin screens read, create/update/delete with secret generation and rotation,
 * and the routine that bootstraps the authorization server's own client row the first
 * time it needs to sign somebody in to its own account area.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid";

import type { SelectClient } from "~/database/schema";

import { AUTH_SERVER_CLIENT_ID, AUTH_SERVER_NAME } from "~/app/config";
import { clients } from "~/database/schema";

/** Fields accepted when registering a client; the secret is generated on create. */
export interface CreateClientInput {
	name: string;
	description?: string | null;
	logo_url?: string | null;
	redirect_uri: string;
	logout_uri: string;
}

/**
 * Fields accepted when updating a client. `regenerateSecret` rotates the secret,
 * which is the only way to change it.
 */
export interface UpdateClientInput {
	name?: string;
	description?: string | null;
	logo_url?: string | null;
	redirect_uri?: string;
	logout_uri?: string;
	backchannel_logout_uri?: string | null;
	backchannel_logout_session_required?: "true" | "false";
	frontchannel_logout_uri?: string | null;
	frontchannel_logout_session_required?: "true" | "false";
	regenerateSecret?: boolean;
}

export default class Client {
	/** Finds a client by id, or `null` when it is not registered. */
	static async findById(db: Database, id: string): Promise<SelectClient | null> {
		return await db.findOne(clients, { where: { id } });
	}

	/**
	 * Finds a client by the exact logout URI it registered, or `null` when no client
	 * registered that address. Exact equality on the stored column decides whether an
	 * address is a destination the server may send a browser to; the oldest match wins.
	 */
	static async findByLogoutUri(db: Database, logoutUri: string): Promise<SelectClient | null> {
		return await db.findOne(clients, {
			where: { logout_uri: logoutUri },
			orderBy: ["created_at", "asc"],
		});
	}

	/** Lists clients newest first, which is the order the admin list shows them in. */
	static async findAll(
		db: Database,
		options: { limit: number; offset: number },
	): Promise<SelectClient[]> {
		return await db.findMany(clients, {
			limit: options.limit,
			offset: options.offset,
			orderBy: ["created_at", "desc"],
		});
	}

	/** Total number of registered clients, for the admin dashboard. */
	static async count(db: Database): Promise<number> {
		return await db.count(clients);
	}

	/**
	 * Registers a client with a freshly generated secret. The returned row is the one
	 * place that secret is ever surfaced, so a caller shows it right away or loses it.
	 */
	static async create(db: Database, input: CreateClientInput): Promise<SelectClient> {
		return await db.create(
			clients,
			{
				id: generateUUID(),
				name: input.name,
				description: input.description ?? null,
				logo_url: input.logo_url ?? null,
				secret: generateUUID(),
				redirect_uri: input.redirect_uri,
				logout_uri: input.logout_uri,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Updates a client, rotating its secret when asked. `newSecret` is set only on a
	 * rotation, so a caller reveals it exactly once.
	 *
	 * @returns The updated row, plus the new secret when one was generated.
	 */
	static async update(
		db: Database,
		id: string,
		input: UpdateClientInput,
	): Promise<SelectClient & { newSecret?: string }> {
		let { regenerateSecret, ...changes } = input;
		let newSecret = regenerateSecret ? generateUUID() : undefined;

		let client = await db.update(
			clients,
			id,
			newSecret ? { ...changes, secret: newSecret } : changes,
			{ touch: true },
		);

		return { ...client, newSecret };
	}

	/** Deletes a client; cascades take its sessions and grants with it. */
	static async delete(db: Database, id: string): Promise<boolean> {
		return await db.delete(clients, id);
	}

	/**
	 * Returns the authorization server's own client registration, creating it on first
	 * use with a generated secret and callback URLs derived from the request origin.
	 * An existing registration keeps the origin already recorded on it.
	 *
	 * @param requestUrl - URL of the request that needs the registration, used as the origin.
	 */
	static async ensureAuthServerClient(db: Database, requestUrl: URL): Promise<SelectClient> {
		let existing = await Client.findById(db, AUTH_SERVER_CLIENT_ID);
		if (existing) return existing;

		let baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

		return await db.create(
			clients,
			{
				id: AUTH_SERVER_CLIENT_ID,
				name: AUTH_SERVER_NAME,
				secret: generateUUID(),
				redirect_uri: `${baseUrl}/auth/callback`,
				logout_uri: `${baseUrl}/authorize`,
			},
			{ touch: true, returnRow: true },
		);
	}
}
