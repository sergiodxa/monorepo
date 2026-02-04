import type { Database } from "~/db/index";

export default class Client {
	static async findById(db: Database, id: string) {
		return await db.query.clients.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, id);
			},
		});
	}
}
