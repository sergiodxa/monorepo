import type { Database } from "remix/data-table";

import bcrypt from "bcryptjs";
import { column as c, table } from "remix/data-table";

export default class Credential {
	static InvalidCredentialError = class extends Error {
		override name = "InvalidCredentialError";
	};

	static table = table({
		name: "credentials",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			subject_id: c.text(),
			password_hash: c.text(),
			verified_at: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	static findBySubject(db: Database, subjectId: string) {
		return db.findOne(Credential.table, { where: { subject_id: subjectId } });
	}

	static async create(db: Database, subjectId: string, password: string) {
		let passwordHash = await bcrypt.hash(password, 10);

		return await db.create(Credential.table, {
			id: crypto.randomUUID(),
			subject_id: subjectId,
			password_hash: passwordHash,
			verified_at: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});
	}

	static async verify(db: Database, subjectId: string, password: string): Promise<boolean> {
		let credential = await this.findBySubject(db, subjectId);
		if (!credential) throw new this.InvalidCredentialError();
		return await bcrypt.compare(password, credential.password_hash);
	}

	static async updatePassword(db: Database, subjectId: string, password: string) {
		let credential = await this.findBySubject(db, subjectId);
		if (!credential) throw new this.InvalidCredentialError();

		let passwordHash = await bcrypt.hash(password, 10);

		return await db.update(
			Credential.table,
			{ id: credential.id },
			{
				password_hash: passwordHash,
				updated_at: new Date().toISOString(),
			},
		);
	}
}
