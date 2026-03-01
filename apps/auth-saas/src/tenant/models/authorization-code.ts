import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

export default class AuthorizationCode {
	static TTL = 10 * 60 * 1000; // 10 minutes

	static ExpiredCodeError = class extends Error {
		override name = "ExpiredCodeError";
	};

	static AlreadyConsumedError = class extends Error {
		override name = "AlreadyConsumedError";
	};

	static table = createTable({
		name: "authorization_codes",
		primaryKey: ["code"],
		columns: {
			code: s.string(),
			clientId: s.string(),
			subjectId: s.string(),
			sessionId: s.string(),
			redirectUri: s.string(),
			scope: s.nullable(s.string()), // space-separated
			nonce: s.nullable(s.string()),
			pkceChallenge: s.nullable(s.string()),
			pkceMethod: s.nullable(s.enum_(["S256", "plain"])),
			authTime: s.number(), // Unix timestamp in seconds
			expiresAt: s.number(), // Unix timestamp in ms
			createdAt: s.number(), // Unix timestamp in ms
		},
	});

	static async create(
		db: Database,
		data: {
			clientId: string;
			subjectId: string;
			sessionId: string;
			redirectUri: string;
			scope?: string[];
			nonce?: string;
			pkce?: { challenge: string; method: "S256" | "plain" };
		},
	) {
		let code = crypto.randomUUID();
		let now = Date.now();
		let authTime = Math.floor(now / 1000);

		await db.create(AuthorizationCode.table, {
			code,
			clientId: data.clientId,
			subjectId: data.subjectId,
			sessionId: data.sessionId,
			redirectUri: data.redirectUri,
			scope: data.scope?.join(" ") ?? null,
			nonce: data.nonce ?? null,
			pkceChallenge: data.pkce?.challenge ?? null,
			pkceMethod: data.pkce?.method ?? null,
			authTime,
			expiresAt: now + AuthorizationCode.TTL,
			createdAt: now,
		});

		return code;
	}

	static async consume(db: Database, code: string) {
		// Find the code
		let record = await db.findOne(AuthorizationCode.table, { where: { code } });
		if (!record) throw new AuthorizationCode.AlreadyConsumedError();

		// Delete immediately (single-use per RFC 6749)
		await db.delete(AuthorizationCode.table, { code });

		// Check expiration
		if (record.expiresAt < Date.now()) {
			throw new AuthorizationCode.ExpiredCodeError();
		}

		return {
			clientId: record.clientId,
			subjectId: record.subjectId,
			sessionId: record.sessionId,
			redirectUri: record.redirectUri,
			scope: record.scope?.split(" ") ?? [],
			nonce: record.nonce,
			pkce: record.pkceChallenge
				? {
						challenge: record.pkceChallenge,
						method: record.pkceMethod as "S256" | "plain",
					}
				: null,
			authTime: record.authTime,
		};
	}

	static async cleanupExpired(db: Database, now: number) {
		let records = await db.findMany(AuthorizationCode.table);

		let expiredRecords = records.filter((record) => record.expiresAt < now);

		for (let record of expiredRecords) {
			await db.delete(AuthorizationCode.table, { code: record.code });
		}

		return expiredRecords.length;
	}
}
