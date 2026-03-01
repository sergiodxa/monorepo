import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class LogoutUri {
	static table = createTable({
		name: "client_logout_uris",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			client_id: s.string(),
			uri: s.string(),
			type: s.enum_(["post_logout", "backchannel", "frontchannel"]),
			session_required: s.defaulted(s.boolean(), false),
			environment: s.nullable(s.string()),
			created_at: s.string(),
		},
	});

	static async list(db: Database, clientId: string) {
		return await db.findMany(LogoutUri.table, { where: { client_id: clientId } });
	}

	static async create(
		db: Database,
		clientId: string,
		data: {
			uri: string;
			type: "post_logout" | "backchannel" | "frontchannel";
			sessionRequired?: boolean;
			environment?: string;
		},
	) {
		return await db.create(LogoutUri.table, {
			id: crypto.randomUUID(),
			client_id: clientId,
			uri: data.uri,
			type: data.type,
			session_required: data.sessionRequired ?? false,
			environment: data.environment ?? null,
			created_at: new Date().toISOString(),
		});
	}

	static async destroy(db: Database, id: string) {
		let logoutUri = await db.findOne(LogoutUri.table, { where: { id } });
		if (!logoutUri) throw new RecordNotFoundError(LogoutUri.table, { id });
		return await db.delete(LogoutUri.table, { id });
	}

	static async findByType(
		db: Database,
		clientId: string,
		type: "post_logout" | "backchannel" | "frontchannel",
	) {
		let logoutUris = await db.findMany(LogoutUri.table, {
			where: { client_id: clientId },
		});
		return logoutUris.filter((logoutUri) => logoutUri.type === type);
	}
}
