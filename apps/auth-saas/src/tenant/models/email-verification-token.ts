import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

// TTL: 24 hours
const TOKEN_TTL = 24 * 60 * 60 * 1000;

export default class EmailVerificationToken {
	static ExpiredTokenError = class extends Error {
		override name = "ExpiredTokenError";
	};

	static InvalidTokenError = class extends Error {
		override name = "InvalidTokenError";
	};

	static table = createTable({
		name: "email_verification_tokens",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			subject_id: s.string(),
			token: s.string(),
			expires_at: s.number(),
			created_at: s.number(),
		},
	});

	static async create(db: Database, subjectId: string) {
		let id = crypto.randomUUID();
		let token = EmailVerificationToken.generateToken();
		let now = Date.now();

		await db.create(EmailVerificationToken.table, {
			id,
			subject_id: subjectId,
			token,
			expires_at: now + TOKEN_TTL,
			created_at: now,
		});

		return token;
	}

	static async consume(db: Database, token: string) {
		let record = await db.findOne(EmailVerificationToken.table, {
			where: { token },
		});
		if (!record) throw new EmailVerificationToken.InvalidTokenError();

		// Delete immediately (single-use)
		await db.delete(EmailVerificationToken.table, { id: record.id });

		if (record.expires_at < Date.now()) {
			throw new EmailVerificationToken.ExpiredTokenError();
		}

		return { subjectId: record.subject_id };
	}

	private static generateToken(): string {
		let bytes = crypto.getRandomValues(new Uint8Array(32));
		// URL-safe base64
		return btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");
	}

	static async cleanupExpired(db: Database, now: number) {
		let records = await db.findMany(EmailVerificationToken.table);

		let expiredRecords = records.filter((record) => record.expires_at < now);

		for (let record of expiredRecords) {
			await db.delete(EmailVerificationToken.table, { id: record.id });
		}

		return expiredRecords.length;
	}
}
