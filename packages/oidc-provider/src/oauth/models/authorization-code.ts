/**
 * Model for OAuth 2.0 authorization codes.
 *
 * Issues short-lived, single-use codes for the authorization-code flow and
 * consumes them atomically (deleting on read) while carrying the PKCE, nonce, and
 * auth-time data the token endpoint needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/**
 * Model for OAuth 2.0 authorization codes.
 * Handles creation, consumption, and cleanup of single-use authorization codes.
 */
export default class AuthorizationCode {
	/**
	 * Time-to-live for authorization codes (10 minutes in milliseconds).
	 * Per RFC 6749, authorization codes should be short-lived.
	 */
	static TTL = 10 * 60 * 1000;

	/** Error thrown when attempting to consume an expired authorization code. */
	static ExpiredCodeError = class extends Error {
		override name = "ExpiredCodeError";
	};

	/** Error thrown when attempting to consume an already-consumed code. */
	static AlreadyConsumedError = class extends Error {
		override name = "AlreadyConsumedError";
	};

	/** Database table schema for authorization codes. */
	static table = table({
		name: "authorization_codes",
		primaryKey: ["code"],
		columns: {
			code: c.text(),
			client_id: c.text(),
			subject_id: c.text(),
			session_id: c.text(),
			redirect_uri: c.text(),
			/** Space-separated list of scopes. */
			scope: c.text().nullable(),
			nonce: c.text().nullable(),
			pkce_challenge: c.text().nullable(),
			pkce_method: c.enum(["S256", "plain"]).nullable(),
			/** Unix timestamp in seconds. */
			auth_time: c.integer(),
			/** Unix timestamp in milliseconds. */
			expires_at: c.integer(),
			/** Unix timestamp in milliseconds. */
			created_at: c.integer(),
		},
	});

	/**
	 * Creates a new authorization code.
	 * @param db - Database instance
	 * @param data - Authorization code data including client, subject, session, and PKCE info
	 * @returns The generated authorization code string
	 */
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

	/**
	 * Consumes an authorization code, returning its data.
	 * Codes are deleted immediately per RFC 6749 (single-use requirement).
	 * @param db - Database instance
	 * @param code - The authorization code to consume
	 * @returns The code's associated data
	 * @throws {AlreadyConsumedError} If the code has already been consumed
	 * @throws {ExpiredCodeError} If the code has expired
	 * @example
	 * let data = await AuthorizationCode.consume(db, code);
	 */
	static async consume(db: Database, code: string) {
		let record = await db.findOne(AuthorizationCode.table, { where: { code } });
		if (!record) throw new AuthorizationCode.AlreadyConsumedError();

		await db.delete(AuthorizationCode.table, { code });

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

	/**
	 * Removes all expired authorization codes from the database.
	 * @param db - Database instance
	 * @param now - Current timestamp in milliseconds
	 * @returns Number of expired codes deleted
	 */
	static async cleanupExpired(db: Database, now: number) {
		let records = await db.findMany(AuthorizationCode.table);
		let expiredRecords = records.filter((record) => record.expires_at < now);

		if (expiredRecords.length === 0) return 0;

		await Promise.all(
			expiredRecords.map((record) => db.delete(AuthorizationCode.table, { code: record.code })),
		);

		return expiredRecords.length;
	}
}
