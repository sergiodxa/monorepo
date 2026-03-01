import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class RedirectUri {
	static InvalidRedirectUriError = class extends Error {
		override name = "InvalidRedirectUriError";
	};

	static table = createTable({
		name: "client_redirect_uris",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			client_id: s.string(),
			uri: s.string(),
			environment: s.nullable(s.string()),
			created_at: s.string(),
		},
	});

	static async list(db: Database, clientId: string) {
		return await db.findMany(RedirectUri.table, { where: { client_id: clientId } });
	}

	static async create(db: Database, clientId: string, uri: string, environment?: string) {
		return await db.create(RedirectUri.table, {
			id: crypto.randomUUID(),
			client_id: clientId,
			uri,
			environment: environment ?? null,
			created_at: new Date().toISOString(),
		});
	}

	static async destroy(db: Database, id: string) {
		let redirectUri = await db.findOne(RedirectUri.table, { where: { id } });
		if (!redirectUri) throw new RecordNotFoundError(RedirectUri.table, { id });
		return await db.delete(RedirectUri.table, { id });
	}

	static async validate(db: Database, clientId: string, uri: string): Promise<boolean> {
		let redirectUris = await db.findMany(RedirectUri.table, {
			where: { client_id: clientId },
		});
		return redirectUris.some((redirectUri) => redirectUri.uri === uri);
	}
}
