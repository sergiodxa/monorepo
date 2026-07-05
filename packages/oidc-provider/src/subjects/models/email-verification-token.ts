/**
 * Model for single-use email verification tokens.
 *
 * Issues 24-hour, URL-safe tokens tied to a subject and consumes them atomically
 * (deleting on read) so a subject's email address can be verified via a link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Time-to-live for email verification tokens (24 hours in milliseconds). */
const TOKEN_TTL = 24 * 60 * 60 * 1000;

/**
 * Model for email verification tokens.
 * Handles creation, consumption, and cleanup of single-use verification tokens.
 */
export default class EmailVerificationToken {
	/** Error thrown when attempting to consume an expired token. */
	static ExpiredTokenError = class extends Error {
		override name = "ExpiredTokenError";
	};

	/** Error thrown when attempting to consume an invalid or already-consumed token. */
	static InvalidTokenError = class extends Error {
		override name = "InvalidTokenError";
	};

	/** Database table schema for email verification tokens. */
	static table = table({
		name: "email_verification_tokens",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			subject_id: c.text(),
			token: c.text(),
			expires_at: c.integer(),
			created_at: c.integer(),
		},
	});

	/**
	 * Creates a new email verification token.
	 * @param db - Database instance
	 * @param subjectId - ID of the subject to verify
	 * @returns The generated token string
	 */
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

	/**
	 * Consumes an email verification token.
	 * Tokens are deleted immediately (single-use).
	 * @param db - Database instance
	 * @param token - The token to consume
	 * @returns Object containing the associated subject ID
	 * @throws {InvalidTokenError} If the token is invalid or already consumed
	 * @throws {ExpiredTokenError} If the token has expired
	 */
	static async consume(db: Database, token: string) {
		let record = await db.findOne(EmailVerificationToken.table, {
			where: { token },
		});
		if (!record) throw new EmailVerificationToken.InvalidTokenError();

		await db.delete(EmailVerificationToken.table, { id: record.id });

		if (record.expires_at < Date.now()) {
			throw new EmailVerificationToken.ExpiredTokenError();
		}

		return { subjectId: record.subject_id };
	}

	/**
	 * Generates a URL-safe token string.
	 * @returns 32-byte random token encoded as URL-safe base64
	 */
	private static generateToken(): string {
		let bytes = crypto.getRandomValues(new Uint8Array(32));
		return btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");
	}

	/**
	 * Removes all expired tokens from the database.
	 * @param db - Database instance
	 * @param now - Current timestamp in milliseconds
	 * @returns Number of expired tokens deleted
	 */
	static async cleanupExpired(db: Database, now: number) {
		let records = await db.findMany(EmailVerificationToken.table);
		let expiredRecords = records.filter((record) => record.expires_at < now);

		if (expiredRecords.length === 0) return 0;

		await Promise.all(
			expiredRecords.map((record) => db.delete(EmailVerificationToken.table, { id: record.id })),
		);

		return expiredRecords.length;
	}
}
