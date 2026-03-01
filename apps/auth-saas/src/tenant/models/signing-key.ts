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

		// Keys are stored as PEM strings, which JWK.importKeyPair expects
		return await JWK.importKeyPair({
			id: record.id as `${string}-${string}-${string}-${string}-${string}`,
			alg: JWK.Algoritm.ES256,
			privateKey: record.privateKey,
			publicKey: record.publicKey,
			created: new Date(record.createdAt).getTime(),
		});
	}

	static async getAll(db: Database): Promise<JWK.KeyPair[]> {
		let records = await db.findMany(SigningKey.table);

		let keyPairs: JWK.KeyPair[] = [];
		for (let record of records) {
			let keyPair = await JWK.importKeyPair({
				id: record.id as `${string}-${string}-${string}-${string}-${string}`,
				alg: JWK.Algoritm.ES256,
				privateKey: record.privateKey,
				publicKey: record.publicKey,
				created: new Date(record.createdAt).getTime(),
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

		// rawKeyPair.privateKey and publicKey are already PEM strings
		await db.create(SigningKey.table, {
			id: rawKeyPair.id,
			privateKey: rawKeyPair.privateKey,
			publicKey: rawKeyPair.publicKey,
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

		// rawKeyPair.privateKey and publicKey are already PEM strings
		await db.create(SigningKey.table, {
			id: rawKeyPair.id,
			privateKey: rawKeyPair.privateKey,
			publicKey: rawKeyPair.publicKey,
			algorithm: "ES256",
			isCurrent: true,
			createdAt: now,
			expiresAt: null,
		});

		return keyPair;
	}
}

namespace SigningKey {}
