import type { Database } from "remix/data-table";

import { JWK } from "@edgefirst-dev/jwt";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class SigningKey {
	static table = createTable({
		name: "signing_keys",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			private_key: s.string(),
			public_key: s.string(),
			algorithm: s.defaulted(s.string(), "ES256"),
			is_current: s.defaulted(s.boolean(), true),
			created_at: s.string(),
			expires_at: s.nullable(s.string()),
		},
	});

	static list(db: Database) {
		return db.findMany(SigningKey.table);
	}

	static show(db: Database, id: string) {
		return db.findOne(SigningKey.table, { where: { id } });
	}

	static async getCurrent(db: Database): Promise<JWK.KeyPair | null> {
		let record = await db.findOne(SigningKey.table, { where: { is_current: true } });
		if (!record) return null;

		// Keys are stored as PEM strings, which JWK.importKeyPair expects
		return await JWK.importKeyPair({
			id: record.id as `${string}-${string}-${string}-${string}-${string}`,
			alg: JWK.Algoritm.ES256,
			privateKey: record.private_key,
			publicKey: record.public_key,
			created: new Date(record.created_at).getTime(),
		});
	}

	static async getAll(db: Database): Promise<JWK.KeyPair[]> {
		let records = await db.findMany(SigningKey.table);

		let keyPairs: JWK.KeyPair[] = [];
		for (let record of records) {
			let keyPair = await JWK.importKeyPair({
				id: record.id as `${string}-${string}-${string}-${string}-${string}`,
				alg: JWK.Algoritm.ES256,
				privateKey: record.private_key,
				publicKey: record.public_key,
				created: new Date(record.created_at).getTime(),
			});
			keyPairs.push(keyPair);
		}

		return keyPairs;
	}

	static async generate(db: Database): Promise<JWK.KeyPair> {
		let rawKeyPair = await JWK.generateKeyPair(JWK.Algoritm.ES256);
		let keyPair = await JWK.importKeyPair(rawKeyPair);

		let existingCurrent = await db.findMany(SigningKey.table, {
			where: { is_current: true },
		});

		for (let existing of existingCurrent) {
			await db.update(SigningKey.table, { id: existing.id }, { is_current: false });
		}

		let now = new Date().toISOString();

		// rawKeyPair.privateKey and publicKey are already PEM strings
		await db.create(SigningKey.table, {
			id: rawKeyPair.id,
			private_key: rawKeyPair.privateKey,
			public_key: rawKeyPair.publicKey,
			algorithm: "ES256",
			is_current: true,
			created_at: now,
			expires_at: null,
		});

		return keyPair;
	}

	static async rotate(db: Database): Promise<JWK.KeyPair> {
		let existingCurrent = await db.findMany(SigningKey.table, {
			where: { is_current: true },
		});

		for (let existing of existingCurrent) {
			await db.update(SigningKey.table, { id: existing.id }, { is_current: false });
		}

		let rawKeyPair = await JWK.generateKeyPair(JWK.Algoritm.ES256);
		let keyPair = await JWK.importKeyPair(rawKeyPair);

		let now = new Date().toISOString();

		// rawKeyPair.privateKey and publicKey are already PEM strings
		await db.create(SigningKey.table, {
			id: rawKeyPair.id,
			private_key: rawKeyPair.privateKey,
			public_key: rawKeyPair.publicKey,
			algorithm: "ES256",
			is_current: true,
			created_at: now,
			expires_at: null,
		});

		return keyPair;
	}

	static async destroy(db: Database, id: string) {
		let signingKey = await db.findOne(SigningKey.table, { where: { id } });
		if (!signingKey) throw new RecordNotFoundError(SigningKey.table, { id });

		// Don't allow deleting the current signing key
		if (signingKey.is_current) {
			throw new SigningKey.CannotDeleteCurrentKeyError();
		}

		return await db.delete(SigningKey.table, { id });
	}

	static CannotDeleteCurrentKeyError = class extends Error {
		override name = "CannotDeleteCurrentKeyError";
		constructor() {
			super("Cannot delete the current signing key. Rotate first.");
		}
	};
}
