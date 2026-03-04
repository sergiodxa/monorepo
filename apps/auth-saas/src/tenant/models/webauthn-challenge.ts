import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { base64UrlEncode } from "~/lib/base64url";

/** Time-to-live for WebAuthn challenges (5 minutes in milliseconds). */
const CHALLENGE_TTL = 5 * 60 * 1000;

/**
 * Model for WebAuthn challenges.
 * Handles creation and consumption of single-use challenges for registration and authentication.
 */
export default class WebAuthnChallenge {
	/** Error thrown when attempting to consume an expired challenge. */
	static ExpiredChallengeError = class extends Error {
		override name = "ExpiredChallengeError";
	};

	/** Error thrown when attempting to consume an invalid or already-consumed challenge. */
	static InvalidChallengeError = class extends Error {
		override name = "InvalidChallengeError";
	};

	/** Database table schema for WebAuthn challenges. */
	static table = createTable({
		name: "webauthn_challenges",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			/** Base64URL encoded challenge. */
			challenge: s.string(),
			type: s.enum_(["registration", "authentication"]),
			/** For authentication flows. */
			subject_id: s.nullable(s.string()),
			/** For registration flows. */
			email: s.nullable(s.string()),
			client_id: s.nullable(s.string()),
			redirect_uri: s.nullable(s.string()),
			state: s.nullable(s.string()),
			nonce: s.nullable(s.string()),
			scope: s.nullable(s.string()),
			/** PKCE code_challenge for OAuth 2.1 compliance. */
			pkce_challenge: s.nullable(s.string()),
			pkce_method: s.nullable(s.enum_(["S256", "plain"])),
			expires_at: s.number(),
			created_at: s.number(),
		},
	});

	/**
	 * Creates a challenge for WebAuthn registration.
	 * @param db - Database instance
	 * @param data - Registration data including email and optional OAuth parameters
	 * @returns Object containing the challenge ID and challenge value
	 */
	static async createForRegistration(
		db: Database,
		data: {
			email: string;
			clientId?: string;
			redirectUri?: string;
			state?: string;
			nonce?: string;
			scope?: string;
			pkce?: { challenge: string; method: "S256" | "plain" };
		},
	) {
		let id = crypto.randomUUID();
		let challenge = WebAuthnChallenge.generateChallenge();
		let now = Date.now();

		await db.create(WebAuthnChallenge.table, {
			id,
			challenge,
			type: "registration",
			subject_id: null,
			email: data.email,
			client_id: data.clientId ?? null,
			redirect_uri: data.redirectUri ?? null,
			state: data.state ?? null,
			nonce: data.nonce ?? null,
			scope: data.scope ?? null,
			pkce_challenge: data.pkce?.challenge ?? null,
			pkce_method: data.pkce?.method ?? null,
			expires_at: now + CHALLENGE_TTL,
			created_at: now,
		});

		return { id, challenge };
	}

	/**
	 * Creates a challenge for WebAuthn authentication.
	 * @param db - Database instance
	 * @param data - Authentication data including subject ID and optional OAuth parameters
	 * @returns Object containing the challenge ID and challenge value
	 */
	static async createForAuthentication(
		db: Database,
		data: {
			subjectId: string;
			clientId?: string;
			redirectUri?: string;
			state?: string;
			nonce?: string;
			scope?: string;
			pkce?: { challenge: string; method: "S256" | "plain" };
		},
	) {
		let id = crypto.randomUUID();
		let challenge = WebAuthnChallenge.generateChallenge();
		let now = Date.now();

		await db.create(WebAuthnChallenge.table, {
			id,
			challenge,
			type: "authentication",
			subject_id: data.subjectId,
			email: null,
			client_id: data.clientId ?? null,
			redirect_uri: data.redirectUri ?? null,
			state: data.state ?? null,
			nonce: data.nonce ?? null,
			scope: data.scope ?? null,
			pkce_challenge: data.pkce?.challenge ?? null,
			pkce_method: data.pkce?.method ?? null,
			expires_at: now + CHALLENGE_TTL,
			created_at: now,
		});

		return { id, challenge };
	}

	/**
	 * Consumes a WebAuthn challenge.
	 * Challenges are deleted immediately (single-use).
	 * @param db - Database instance
	 * @param id - Challenge ID
	 * @returns The challenge record
	 * @throws {InvalidChallengeError} If the challenge is invalid or already consumed
	 * @throws {ExpiredChallengeError} If the challenge has expired
	 */
	static async consume(db: Database, id: string) {
		let record = await db.findOne(WebAuthnChallenge.table, { where: { id } });
		if (!record) throw new WebAuthnChallenge.InvalidChallengeError();

		await db.delete(WebAuthnChallenge.table, { id });

		if (record.expires_at < Date.now()) {
			throw new WebAuthnChallenge.ExpiredChallengeError();
		}

		return record;
	}

	/**
	 * Generates a Base64URL-encoded challenge value.
	 * @returns 32-byte random challenge encoded as Base64URL
	 */
	private static generateChallenge(): string {
		let bytes = crypto.getRandomValues(new Uint8Array(32));
		return base64UrlEncode(bytes);
	}

	/**
	 * Removes all expired challenges from the database.
	 * @param db - Database instance
	 * @param now - Current timestamp in milliseconds
	 * @returns Number of expired challenges deleted
	 */
	static async cleanupExpired(db: Database, now: number) {
		let records = await db.findMany(WebAuthnChallenge.table);
		let expiredRecords = records.filter((record) => record.expires_at < now);

		if (expiredRecords.length === 0) return 0;

		await Promise.all(
			expiredRecords.map((record) => db.delete(WebAuthnChallenge.table, { id: record.id })),
		);

		return expiredRecords.length;
	}
}
