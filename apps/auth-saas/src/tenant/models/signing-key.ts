import type { Database } from "remix/data-table";

import { JWK } from "@edgefirst-dev/jwt";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

export default class SigningKey {
	static table = createTable({
		name: "signing_keys",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			privateKey: s.string(),
			publicKey: s.string(),
			algorithm: s.defaulted(s.string(), "ES256"),
			isCurrent: s.defaulted(s.boolean(), true),
			createdAt: s.string(),
			expiresAt: s.nullable(s.string()),
		},
	});

	static async getCurrent(db: Database): Promise<JWK.KeyPair | null> {
		let record = await db.findOne(SigningKey.table, { where: { isCurrent: true } });
		if (!record) return null;

		return await JWK.importKeyPair({
			privateKey: JSON.parse(record.privateKey) as JsonWebKey,
			publicKey: JSON.parse(record.publicKey) as JsonWebKey,
		});
	}

	static async getAll(db: Database): Promise<JWK.KeyPair[]> {
		let records = await db.findMany(SigningKey.table);

		let keyPairs: JWK.KeyPair[] = [];
		for (let record of records) {
			let keyPair = await JWK.importKeyPair({
				privateKey: JSON.parse(record.privateKey) as JsonWebKey,
				publicKey: JSON.parse(record.publicKey) as JsonWebKey,
			});
			keyPairs.push(keyPair);
		}

		return keyPairs;
	}

	static async generate(db: Database): Promise<JWK.KeyPair> {
		let rawKeyPair = await JWK.generateKeyPair(JWK.Algoritm.ES256);
		let keyPair = await JWK.importKeyPair(rawKeyPair);

		let existingCurrent = await db.findMany(SigningKey.table, {
			where: { isCurrent: true },
		});

		for (let existing of existingCurrent) {
			await db.update(SigningKey.table, { id: existing.id }, { isCurrent: false });
		}

		let now = new Date().toISOString();

		await db.create(SigningKey.table, {
			id: crypto.randomUUID(),
			privateKey: JSON.stringify(rawKeyPair.privateKey),
			publicKey: JSON.stringify(rawKeyPair.publicKey),
			algorithm: "ES256",
			isCurrent: true,
			createdAt: now,
			expiresAt: null,
		});

		return keyPair;
	}

	static async rotate(db: Database): Promise<JWK.KeyPair> {
		let existingCurrent = await db.findMany(SigningKey.table, {
			where: { isCurrent: true },
		});

		for (let existing of existingCurrent) {
			await db.update(SigningKey.table, { id: existing.id }, { isCurrent: false });
		}

		let rawKeyPair = await JWK.generateKeyPair(JWK.Algoritm.ES256);
		let keyPair = await JWK.importKeyPair(rawKeyPair);

		let now = new Date().toISOString();

		await db.create(SigningKey.table, {
			id: crypto.randomUUID(),
			privateKey: JSON.stringify(rawKeyPair.privateKey),
			publicKey: JSON.stringify(rawKeyPair.publicKey),
			algorithm: "ES256",
			isCurrent: true,
			createdAt: now,
			expiresAt: null,
		});

		return keyPair;
	}
}

namespace SigningKey {}
