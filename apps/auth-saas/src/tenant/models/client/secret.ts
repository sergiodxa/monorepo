import type { Database, PrimaryKeyInput } from "remix/data-table";

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
			clientId: s.string(),
			secretHash: s.string(),
			name: s.nullable(s.string()),
			lastUsedAt: s.nullable(s.string()),
			expiresAt: s.nullable(s.string()),
			createdAt: s.string(),
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
		let secrets = await db.findMany(Secret.table, { where: { clientId } });
		return secrets.map((secret) => ({
			id: secret.id,
			name: secret.name,
			createdAt: secret.createdAt,
			lastUsedAt: secret.lastUsedAt,
			expiresAt: secret.expiresAt,
		}));
	}

	static async create(db: Database, clientId: string, name?: string, expiresAt?: string) {
		let plainSecret = this.generateSecretValue();
		let secretHash = await bcrypt.hash(plainSecret, 10);
		let id = crypto.randomUUID();

		await db.create(Secret.table, {
			id,
			clientId,
			secretHash,
			name: name ?? null,
			lastUsedAt: null,
			expiresAt: expiresAt ?? null,
			createdAt: new Date().toISOString(),
		});

		return { id, plainSecret };
	}

	static async verify(db: Database, clientId: string, plainSecret: string): Promise<boolean> {
		let secrets = await db.findMany(Secret.table, { where: { clientId } });

		for (let secret of secrets) {
			if (secret.expiresAt && new Date(secret.expiresAt) < new Date()) {
				continue;
			}

			let isMatch = await bcrypt.compare(plainSecret, secret.secretHash);
			if (isMatch) {
				await db.update(
					Secret.table,
					{ id: secret.id },
					{
						lastUsedAt: new Date().toISOString(),
					},
				);
				return true;
			}
		}

		return false;
	}

	static async destroy(db: Database, id: PrimaryKeyInput<typeof Secret.table>) {
		let secret = await db.findOne(Secret.table, { where: { id } });
		if (!secret) throw new RecordNotFoundError(Secret.table, id);
		return await db.delete(Secret.table, id);
	}
}
