import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

// TTL: 5 minutes
const CHALLENGE_TTL = 5 * 60 * 1000;

export default class WebAuthnChallenge {
	static ExpiredChallengeError = class extends Error {
		override name = "ExpiredChallengeError";
	};

	static InvalidChallengeError = class extends Error {
		override name = "InvalidChallengeError";
	};

	static table = createTable({
		name: "webauthn_challenges",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			challenge: s.string(), // Base64URL encoded challenge
			type: s.enum_(["registration", "authentication"]),
			subject_id: s.nullable(s.string()), // For authentication
			email: s.nullable(s.string()), // For registration
			client_id: s.nullable(s.string()),
			redirect_uri: s.nullable(s.string()),
			state: s.nullable(s.string()),
			nonce: s.nullable(s.string()),
			scope: s.nullable(s.string()),
			expires_at: s.number(),
			created_at: s.number(),
		},
	});

	static async createForRegistration(
		db: Database,
		data: {
			email: string;
			clientId?: string;
			redirectUri?: string;
			state?: string;
			nonce?: string;
			scope?: string;
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
			expires_at: now + CHALLENGE_TTL,
			created_at: now,
		});

		return { id, challenge };
	}

	static async createForAuthentication(
		db: Database,
		data: {
			subjectId: string;
			clientId?: string;
			redirectUri?: string;
			state?: string;
			nonce?: string;
			scope?: string;
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
			expires_at: now + CHALLENGE_TTL,
			created_at: now,
		});

		return { id, challenge };
	}

	static async consume(db: Database, id: string) {
		let record = await db.findOne(WebAuthnChallenge.table, { where: { id } });
		if (!record) throw new WebAuthnChallenge.InvalidChallengeError();

		// Delete immediately (single-use)
		await db.delete(WebAuthnChallenge.table, { id });

		if (record.expires_at < Date.now()) {
			throw new WebAuthnChallenge.ExpiredChallengeError();
		}

		return record;
	}

	private static generateChallenge(): string {
		let bytes = crypto.getRandomValues(new Uint8Array(32));
		// Base64URL encode
		return btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");
	}

	static async cleanupExpired(db: Database, now: number) {
		let records = await db.findMany(WebAuthnChallenge.table);
		let expiredRecords = records.filter((record) => record.expires_at < now);

		if (expiredRecords.length === 0) return 0;

		// Delete in parallel for better performance
		await Promise.all(
			expiredRecords.map((record) => db.delete(WebAuthnChallenge.table, { id: record.id })),
		);

		return expiredRecords.length;
	}
}
