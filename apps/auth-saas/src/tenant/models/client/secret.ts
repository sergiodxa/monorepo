import type { Database } from "remix/data-table";

import bcrypt from "bcryptjs";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";
import { toIsoString, toIsoStringOptional } from "~/lib/timestamp";

/**
 * Pre-computed valid bcrypt hash used for timing attack prevention.
 * When no secrets exist for a client, we still perform a bcrypt comparison
 * against this dummy hash to ensure consistent response times.
 */
const TIMING_SAFE_DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W";

/**
 * Model for client secrets.
 * Manages creation, verification, and lifecycle of OAuth 2.0 client secrets.
 */
export default class Secret {
	/** Error thrown when a secret is invalid. */
	static InvalidSecretError = class extends Error {
		override name = "InvalidSecretError";
	};

	/** Database table schema for client secrets. */
	static table = createTable({
		name: "client_secrets",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			client_id: s.string(),
			secret_hash: s.string(),
			name: s.nullable(s.string()),
			last_used_at: s.nullable(s.string()),
			expires_at: s.nullable(s.string()),
			created_at: s.string(),
		},
	});

	/**
	 * Generates a cryptographically secure secret value.
	 * @returns Secret string prefixed with `sdx_auth_`
	 */
	static generateSecretValue(): string {
		let randomBytes = crypto.getRandomValues(new Uint8Array(32));
		let base64 = btoa(String.fromCharCode(...randomBytes))
			.replace(/\+/g, "")
			.replace(/\//g, "")
			.replace(/=/g, "");
		return `sdx_auth_${base64}`;
	}

	/**
	 * Lists all secrets for a client.
	 * Secret hashes are not included in the response.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @returns Array of secret metadata (without hashes)
	 */
	static async list(db: Database, clientId: string) {
		let secrets = await db.findMany(Secret.table, { where: { client_id: clientId } });
		return secrets.map((secret) => ({
			id: secret.id,
			name: secret.name,
			createdAt: toIsoString(secret.created_at),
			lastUsedAt: toIsoStringOptional(secret.last_used_at),
			expiresAt: toIsoStringOptional(secret.expires_at),
		}));
	}

	/**
	 * Creates a new secret for a client.
	 * The plain secret is returned only once and should be stored securely by the client.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @param name - Optional descriptive name
	 * @param expiresAt - Optional expiration date (ISO string)
	 * @returns Object containing the secret ID and plain secret value
	 */
	static async create(db: Database, clientId: string, name?: string, expiresAt?: string) {
		let plainSecret = this.generateSecretValue();
		let secretHash = await bcrypt.hash(plainSecret, 10);
		let id = crypto.randomUUID();

		await db.create(Secret.table, {
			id,
			client_id: clientId,
			secret_hash: secretHash,
			name: name ?? null,
			last_used_at: null,
			expires_at: expiresAt ?? null,
			created_at: new Date().toISOString(),
		});

		return { id, plainSecret };
	}

	/**
	 * Verifies a client secret.
	 * All valid secrets are compared in parallel to prevent timing attacks
	 * that could reveal which position the valid secret is in.
	 * A dummy comparison is performed when no secrets exist to prevent
	 * timing attacks that could detect the absence of secrets.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @param plainSecret - Plain secret to verify
	 * @returns True if the secret is valid
	 */
	static async verify(db: Database, clientId: string, plainSecret: string): Promise<boolean> {
		let secrets = await db.findMany(Secret.table, { where: { client_id: clientId } });
		let now = new Date();

		let validSecrets = secrets.filter((secret) => {
			if (secret.expires_at && new Date(secret.expires_at) < now) {
				return false;
			}
			return true;
		});

		if (validSecrets.length === 0) {
			await bcrypt.compare(plainSecret, TIMING_SAFE_DUMMY_HASH);
			return false;
		}

		let comparisons = await Promise.all(
			validSecrets.map(async (secret) => ({
				id: secret.id,
				isMatch: await bcrypt.compare(plainSecret, secret.secret_hash),
			})),
		);

		let match = comparisons.find((c) => c.isMatch);

		if (match) {
			await db.update(
				Secret.table,
				{ id: match.id },
				{
					last_used_at: now.toISOString(),
				},
			);
			return true;
		}

		return false;
	}

	/**
	 * Deletes a secret.
	 * @param db - Database instance
	 * @param id - Secret ID
	 * @returns Deletion result
	 * @throws {RecordNotFoundError} If secret does not exist
	 */
	static async destroy(db: Database, id: string) {
		let secret = await db.findOne(Secret.table, { where: { id } });
		if (!secret) throw new RecordNotFoundError(Secret.table, { id });
		return await db.delete(Secret.table, { id });
	}
}
