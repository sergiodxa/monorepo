import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

export default class Client {
	static table = createTable({
		name: "clients",
		columns: {
			id: s.string(),
		},
	});

	static async list(db: Database) {
		return await db.findMany(Client.table);
	}

	static async show(db: Database, id: string) {
		return await db.findOne(Client.table, { where: { id } });
	}

	static async create(db: Database, data: Partial<Client>) {
		return await db.create(Client.table, data);
	}

	static async update(db: Database, id: string, data: Partial<Client>) {
		return await db.update(Client.table, id, data);
	}

	static async destroy(db: Database, id: string) {
		return await db.delete(Client.table, id);
	}
}

namespace Client {}
