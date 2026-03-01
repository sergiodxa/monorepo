import type { Database } from "remix/data-table";

import bcrypt from "bcryptjs";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Secret {
	static InvalidSecretError = class extends Error {
		override name = "InvalidSecretError";
	};

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

	static generateSecretValue(): string {
		let randomBytes = crypto.getRandomValues(new Uint8Array(32));
		let base64 = btoa(String.fromCharCode(...randomBytes))
			.replace(/\+/g, "")
			.replace(/\//g, "")
			.replace(/=/g, "");
		return `sdx_auth_${base64}`;
	}

	static async list(db: Database, clientId: string) {
		let secrets = await db.findMany(Secret.table, { where: { client_id: clientId } });
		return secrets.map((secret) => ({
			id: secret.id,
			name: secret.name,
			createdAt: secret.created_at,
			lastUsedAt: secret.last_used_at,
			expiresAt: secret.expires_at,
		}));
	}

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

	static async verify(db: Database, clientId: string, plainSecret: string): Promise<boolean> {
		let secrets = await db.findMany(Secret.table, { where: { client_id: clientId } });

		for (let secret of secrets) {
			if (secret.expires_at && new Date(secret.expires_at) < new Date()) {
				continue;
			}

			let isMatch = await bcrypt.compare(plainSecret, secret.secret_hash);
			if (isMatch) {
				await db.update(
					Secret.table,
					{ id: secret.id },
					{
						last_used_at: new Date().toISOString(),
					},
				);
				return true;
			}
		}

		return false;
	}

	static async destroy(db: Database, id: string) {
		let secret = await db.findOne(Secret.table, { where: { id } });
		if (!secret) throw new RecordNotFoundError(Secret.table, { id });
		return await db.delete(Secret.table, { id });
	}
}
