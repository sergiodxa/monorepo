import type { Database } from "remix/data-table";

import bcrypt from "bcryptjs";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

export default class Credential {
	static InvalidCredentialError = class extends Error {
		override name = "InvalidCredentialError";
	};

	static table = createTable({
		name: "credentials",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			subjectId: s.string(),
			passwordHash: s.string(),
			verifiedAt: s.nullable(s.string()),
			createdAt: s.string(),
			updatedAt: s.string(),
		},
	});

	static findBySubject(db: Database, subjectId: string) {
		return db.findOne(Credential.table, { where: { subjectId } });
	}

	static async create(db: Database, subjectId: string, password: string) {
		let passwordHash = await bcrypt.hash(password, 10);

		return await db.create(Credential.table, {
			id: crypto.randomUUID(),
			subjectId,
			passwordHash,
			verifiedAt: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	}

	static async verify(db: Database, subjectId: string, password: string): Promise<boolean> {
		let credential = await this.findBySubject(db, subjectId);
		if (!credential) throw new this.InvalidCredentialError();
		return await bcrypt.compare(password, credential.passwordHash);
	}

	static async updatePassword(db: Database, subjectId: string, password: string) {
		let credential = await this.findBySubject(db, subjectId);
		if (!credential) throw new this.InvalidCredentialError();

		let passwordHash = await bcrypt.hash(password, 10);

		return await db.update(
			Credential.table,
			{ id: credential.id },
			{
				passwordHash,
				updatedAt: new Date().toISOString(),
			},
		);
	}
}
