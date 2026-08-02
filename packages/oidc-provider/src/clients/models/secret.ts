/**
 * Model for OAuth 2.0 client secrets.
 *
 * Generates prefixed secrets, stores only their hashes, and verifies presented
 * secrets in a timing-safe way (parallel comparison, plus an equivalent amount of
 * work when a client has no secrets) to avoid leaking which secret matched, or
 * whether any exists at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { randomToken } from "@pkg/crypto";
import { isFailure, unwrap } from "@pkg/result";
import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "../../shared/lib/db-errors";
import { hashSecret, spendVerificationCost, verifySecret } from "../../shared/lib/password-hash";
import { toIsoString, toIsoStringOptional } from "../../shared/lib/timestamp";

/** Entropy behind a generated secret, in bytes. */
const SECRET_BYTES = 32;

/** Prefix every generated secret carries, so a leaked one is recognizable. */
const SECRET_PREFIX = "sdx_auth";

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
	static table = table({
		name: "client_secrets",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			client_id: c.text(),
			secret_hash: c.text(),
			name: c.text().nullable(),
			last_used_at: c.text().nullable(),
			expires_at: c.text().nullable(),
			created_at: c.text(),
		},
	});

	/**
	 * Generates a cryptographically secure secret value.
	 * @returns Secret string prefixed with `sdx_auth_`
	 */
	static generateSecretValue(): string {
		return randomToken({ bytes: SECRET_BYTES, prefix: SECRET_PREFIX });
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
		let secretHash = unwrap(await hashSecret(plainSecret));
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
	 * An equivalent hashing operation is performed when no secrets exist, to
	 * prevent timing attacks that could detect the absence of secrets.
	 * A secret still stored in the superseded hash format is rewritten in the
	 * current one as part of the same write that records its use, since a match
	 * is the only moment the plaintext is available to hash again.
	 * A hash that cannot be checked at all counts as a mismatch, so an unreadable
	 * stored value denies the client instead of authenticating it.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @param plainSecret - Plain secret to verify
	 * @returns True if the secret is valid
	 * @example
	 * if (await Secret.verify(db, client.id, presentedSecret)) authenticateClient();
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
			await spendVerificationCost(plainSecret);
			return false;
		}

		let comparisons = await Promise.all(
			validSecrets.map(async (secret) => {
				let checked = await verifySecret(secret.secret_hash, plainSecret);
				if (isFailure(checked)) return { id: secret.id, matches: false, rehashed: null };
				return { id: secret.id, ...checked.data };
			}),
		);

		let match = comparisons.find((comparison) => comparison.matches);
		if (!match) return false;

		await db.update(
			Secret.table,
			{ id: match.id },
			{
				last_used_at: now.toISOString(),
				...(match.rehashed ? { secret_hash: match.rehashed } : {}),
			},
		);

		return true;
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
