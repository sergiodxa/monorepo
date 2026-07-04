import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { base64UrlEncode } from "../../shared/lib/base64url";

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
	static table = table({
		name: "webauthn_challenges",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			/** Base64URL encoded challenge. */
			challenge: c.text(),
			type: c.enum(["registration", "authentication"]),
			/** For authentication flows. */
			subject_id: c.text().nullable(),
			/** For registration flows. */
			email: c.text().nullable(),
			client_id: c.text().nullable(),
			redirect_uri: c.text().nullable(),
			state: c.text().nullable(),
			nonce: c.text().nullable(),
			scope: c.text().nullable(),
			/** PKCE code_challenge for OAuth 2.1 compliance. */
			pkce_challenge: c.text().nullable(),
			pkce_method: c.enum(["S256", "plain"]).nullable(),
			expires_at: c.integer(),
			created_at: c.integer(),
		},
	});

	/**
	 * Creates a challenge for WebAuthn registration.
	 * @param db - Database instance
	 * @param data - Registration data including email and optional OAuth parameters
	 * @returns Object containing the challenge ID, challenge value, and userId for credential creation
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
		// Generate a stable user ID for WebAuthn credential creation
		// This will be the subject ID when the registration completes
		let userId = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
		let now = Date.now();

		await db.create(WebAuthnChallenge.table, {
			id,
			challenge,
			type: "registration",
			subject_id: userId, // Store userId as subject_id for later retrieval
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

		return { id, challenge, userId };
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
