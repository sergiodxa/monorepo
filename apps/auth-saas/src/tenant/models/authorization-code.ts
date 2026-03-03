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
			client_id: s.string(),
			subject_id: s.string(),
			session_id: s.string(),
			redirect_uri: s.string(),
			scope: s.nullable(s.string()), // space-separated
			nonce: s.nullable(s.string()),
			pkce_challenge: s.nullable(s.string()),
			pkce_method: s.nullable(s.enum_(["S256", "plain"])),
			auth_time: s.number(), // Unix timestamp in seconds
			expires_at: s.number(), // Unix timestamp in ms
			created_at: s.number(), // Unix timestamp in ms
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
			client_id: data.clientId,
			subject_id: data.subjectId,
			session_id: data.sessionId,
			redirect_uri: data.redirectUri,
			scope: data.scope?.join(" ") ?? null,
			nonce: data.nonce ?? null,
			pkce_challenge: data.pkce?.challenge ?? null,
			pkce_method: data.pkce?.method ?? null,
			auth_time: authTime,
			expires_at: now + AuthorizationCode.TTL,
			created_at: now,
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
		if (record.expires_at < Date.now()) {
			throw new AuthorizationCode.ExpiredCodeError();
		}

		return {
			clientId: record.client_id,
			subjectId: record.subject_id,
			sessionId: record.session_id,
			redirectUri: record.redirect_uri,
			scope: record.scope?.split(" ") ?? [],
			nonce: record.nonce,
			pkce: record.pkce_challenge
				? {
						challenge: record.pkce_challenge,
						method: record.pkce_method as "S256" | "plain",
					}
				: null,
			authTime: record.auth_time,
		};
	}

	static async cleanupExpired(db: Database, now: number) {
		let records = await db.findMany(AuthorizationCode.table);
		let expiredRecords = records.filter((record) => record.expires_at < now);

		if (expiredRecords.length === 0) return 0;

		// Delete in parallel for better performance
		await Promise.all(
			expiredRecords.map((record) => db.delete(AuthorizationCode.table, { code: record.code })),
		);

		return expiredRecords.length;
	}
}
