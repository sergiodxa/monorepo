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
			subjectId: s.nullable(s.string()), // For authentication
			email: s.nullable(s.string()), // For registration
			clientId: s.nullable(s.string()),
			redirectUri: s.nullable(s.string()),
			state: s.nullable(s.string()),
			nonce: s.nullable(s.string()),
			scope: s.nullable(s.string()),
			expiresAt: s.number(),
			createdAt: s.number(),
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
			subjectId: null,
			email: data.email,
			clientId: data.clientId ?? null,
			redirectUri: data.redirectUri ?? null,
			state: data.state ?? null,
			nonce: data.nonce ?? null,
			scope: data.scope ?? null,
			expiresAt: now + CHALLENGE_TTL,
			createdAt: now,
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
			subjectId: data.subjectId,
			email: null,
			clientId: data.clientId ?? null,
			redirectUri: data.redirectUri ?? null,
			state: data.state ?? null,
			nonce: data.nonce ?? null,
			scope: data.scope ?? null,
			expiresAt: now + CHALLENGE_TTL,
			createdAt: now,
		});

		return { id, challenge };
	}

	static async consume(db: Database, id: string) {
		let record = await db.findOne(WebAuthnChallenge.table, { where: { id } });
		if (!record) throw new WebAuthnChallenge.InvalidChallengeError();

		// Delete immediately (single-use)
		await db.delete(WebAuthnChallenge.table, { id });

		if (record.expiresAt < Date.now()) {
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

		let expiredRecords = records.filter((record) => record.expiresAt < now);

		for (let record of expiredRecords) {
			await db.delete(WebAuthnChallenge.table, { id: record.id });
		}

		return expiredRecords.length;
	}
}
