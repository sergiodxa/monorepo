/**
 * Registered OAuth clients: lookup by logout URI, the newest-first listing the admin screens
 * page through, registration with a generated secret, edits that may rotate it, and the
 * authorization server's own registration, created the first time it signs somebody in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow, NotFound } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { createModel } from "@sdxc/data-model";
import { isFailure, success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";

import type { PageWindow } from "~/app/models/subjects";
import type { SelectClient } from "~/database/schema";

import { AUTH_SERVER_CLIENT_ID, AUTH_SERVER_NAME } from "~/app/config";
import { clients } from "~/database/schema";

/**
 * The changes an edit accepts. `regenerateSecret` rotates the secret, which is the only way
 * to change it.
 */
export interface ClientEdit {
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

/** An edited client, carrying `newSecret` only when the edit rotated it. */
export interface EditedClient extends SelectClient {
	newSecret?: string;
}

export const Clients = createModel(clients, {
	optional: [
		"id",
		"secret",
		"backchannel_logout_session_required",
		"frontchannel_logout_session_required",
	],

	methods: {
		/**
		 * The client that registered exactly this logout URI, or `null`. Exact equality decides
		 * whether an address is a destination the server may send a browser to; the oldest
		 * registration wins.
		 */
		findByLogoutUri(logoutUri: string) {
			return this.query().where({ logout_uri: logoutUri }).orderBy("created_at", "asc").first();
		},

		/** One page of clients newest first, the order the admin list shows them in. */
		page(window: PageWindow) {
			return this.query()
				.orderBy("created_at", "desc")
				.limit(window.limit)
				.offset(window.offset)
				.all();
		},

		/**
		 * Applies an edit, rotating the secret when asked. The new secret is reported once, on
		 * the answer, so a caller reveals it exactly once.
		 */
		async edit(
			id: string,
			input: ClientEdit,
		): Promise<Result<EditedClient, ValidationError | NotFound>> {
			let { regenerateSecret, ...changes } = input;
			let newSecret = regenerateSecret ? generateUUID() : undefined;

			let updated = await this.update(
				id,
				newSecret === undefined ? changes : { ...changes, secret: newSecret },
			);
			if (isFailure(updated)) return updated;

			return success({ ...updated.data, newSecret });
		},

		/**
		 * The authorization server's own registration, created on first use with a generated
		 * secret and callback URLs on the requesting origin. An existing registration keeps the
		 * origin already recorded on it.
		 *
		 * @param requestUrl - URL of the request that needs the registration.
		 */
		async ensureAuthServerClient(requestUrl: URL): Promise<Result<SelectClient, ValidationError>> {
			let existing = await this.find(AUTH_SERVER_CLIENT_ID);
			if (existing !== null) return success(existing);

			let baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

			return await this.create({
				id: AUTH_SERVER_CLIENT_ID,
				name: AUTH_SERVER_NAME,
				redirect_uri: `${baseUrl}/auth/callback`,
				logout_uri: `${baseUrl}/authorize`,
			});
		},
	},

	callbacks: {
		/**
		 * Gives a new client a generated id and secret. The created row is the one place that
		 * secret is surfaced, so a caller shows it right away or loses it.
		 */
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				secret: values.secret ?? generateUUID(),
			};
		},
	},
});

/** A registered client, as reads return it. */
export type Client = ModelRow<typeof Clients>;

export default Clients;
