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
			subjectId: s.string(),
			token: s.string(),
			expiresAt: s.number(),
			createdAt: s.number(),
		},
	});

	static async create(db: Database, subjectId: string) {
		let id = crypto.randomUUID();
		let token = EmailVerificationToken.generateToken();
		let now = Date.now();

		await db.create(EmailVerificationToken.table, {
			id,
			subjectId,
			token,
			expiresAt: now + TOKEN_TTL,
			createdAt: now,
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

		if (record.expiresAt < Date.now()) {
			throw new EmailVerificationToken.ExpiredTokenError();
		}

		return { subjectId: record.subjectId };
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

		let expiredRecords = records.filter((record) => record.expiresAt < now);

		for (let record of expiredRecords) {
			await db.delete(EmailVerificationToken.table, { id: record.id });
		}

		return expiredRecords.length;
	}
}
