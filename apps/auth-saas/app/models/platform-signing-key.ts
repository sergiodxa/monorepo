/**
 * The platform's own signing identity: one rotation shared by every tenant's
 * management API traffic, rather than one per tenant. Every export here but
 * {@link currentPlatformSigningKeyPair} returns a published key set, never a
 * `KeyPair`, so a caller holding the result has exactly what a resource server is
 * allowed to see; `currentPlatformSigningKeyPair` hands back the live pair for the
 * token endpoint to sign with, and only a signed token string ever crosses back out
 * from there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { JWK } from "@sdxc/jwt";
import * as s from "remix/data-schema";
import { and, column as c, gt, isNull, lte, notNull, or, table } from "remix/data-table";

/** How long a staged key is published before it starts signing. */
const STAGED_WINDOW_MS = 24 * 60 * 60 * 1000;

/** How long a key signs before a successor is staged to replace it. */
const SIGNING_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/** How long a retired key stays published after it stops signing. */
const RETIRED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Caps the transitions one call performs. The state machine advances by at most one row
 * change per phase, so a handful of iterations covers every rotation genuinely due at
 * once; the cap only guards against a future bug turning this into an infinite loop.
 */
const MAX_ROTATION_STEPS_PER_CALL = 8;

/** The platform's whole signing lifecycle in one row: staged, signing, retired, or gone. */
export const platformSigningKeys = table({
	name: "platform_signing_keys",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		alg: c.text(),
		public_key: c.text(),
		private_key: c.text(),
		created_at: c.integer(),
		signing_from: c.integer().nullable(),
		retired_at: c.integer().nullable(),
		publish_until: c.integer().nullable(),
	},
});

export type PlatformSigningKeyRow = TableRow<typeof platformSigningKeys>;

/** The published document a management API JWKS endpoint serves, with no private material. */
export type PublishedPlatformKeySet = ReturnType<typeof JWK.toJSON>;

export interface AdvancePlatformSigningKeysInput {
	now?: number;
}

let AdvancePlatformSigningKeysSchema = s.object({ now: s.optional(s.number()) });

/**
 * Performs every rotation transition due at the given time — staging a successor,
 * promoting a staged key and retiring the incumbent, deleting a key past its publish
 * window — and returns the resulting published set. Safe to call when nothing is due,
 * which is what lets a scheduled job call it on every invocation without first
 * checking whether one is due.
 *
 * @param db - The platform database.
 * @param input - The clock to advance the rotation against.
 * @returns The key set now published for the platform.
 */
export async function advancePlatformSigningKeys(
	db: Database,
	input: AdvancePlatformSigningKeysInput = {},
): Promise<PublishedPlatformKeySet> {
	let parsed = s.parse(AdvancePlatformSigningKeysSchema, input);
	let now = parsed.now ?? Date.now();

	for (let step = 0; step < MAX_ROTATION_STEPS_PER_CALL; step++) {
		if (await ensurePlatformSigningKey(db, now)) continue;

		let signing = await currentPlatformSigningKey(db);
		if (!signing || signing.signing_from === null) break;

		let staged = await db.findOne(platformSigningKeys, { where: isNull("signing_from") });

		if (staged && now - staged.created_at >= STAGED_WINDOW_MS) {
			await promoteStagedKey(db, staged, signing, now);
			continue;
		}

		if (!staged && now - signing.signing_from >= SIGNING_WINDOW_MS) {
			await stageSuccessor(db, signing.alg as JWK.Algorithm, now);
			continue;
		}

		break;
	}

	await db.deleteMany(platformSigningKeys, {
		where: and(notNull("publish_until"), lte("publish_until", now)),
	});

	return publishedKeySet(db, now);
}

export interface PublishPlatformKeySetInput {
	now?: number;
}

let PublishPlatformKeySetSchema = s.object({ now: s.optional(s.number()) });

/**
 * Re-renders the platform's currently published key set without performing any
 * rotation transition, for refilling a cache entry that is missing or being repaired.
 *
 * @param db - The platform database.
 * @param input - The clock a row's publish window is measured against.
 * @returns The key set currently published for the platform.
 */
export async function publishPlatformKeySet(
	db: Database,
	input: PublishPlatformKeySetInput = {},
): Promise<PublishedPlatformKeySet> {
	let parsed = s.parse(PublishPlatformKeySetSchema, input);
	return publishedKeySet(db, parsed.now ?? Date.now());
}

/**
 * Generates the platform's first signing key when it has none, staged and signing at
 * once — the platform is never left in a state where a management token can be
 * requested and nothing can sign it. Shared by provisioning and by
 * {@link advancePlatformSigningKeys}, which calls it whenever every key has somehow
 * lapsed.
 *
 * @param db - The platform database.
 * @param now - When the key starts signing.
 * @returns Whether a key was generated; `false` when one was already signing.
 */
export async function ensurePlatformSigningKey(
	db: Database,
	now: number = Date.now(),
): Promise<boolean> {
	let signing = await currentPlatformSigningKey(db);
	if (signing) return false;

	await insertGeneratedKey(db, JWK.Algorithm.ES256, now, now);
	return true;
}

/** The one row, if any, whose `signing_from` is set and has not been retired. */
async function currentPlatformSigningKey(db: Database): Promise<PlatformSigningKeyRow | null> {
	return db.findOne(platformSigningKeys, {
		where: and(notNull("signing_from"), isNull("retired_at")),
	});
}

/**
 * Hands back the platform's current signing key as a usable `KeyPair`, private half
 * included, for the management token endpoint to sign with. This is the one export
 * from this module that carries private key material — reserved for the minting
 * operation itself, since producing a token is the one thing worth crossing this
 * module's boundary for; the string a caller signs with this pair is all that leaves.
 *
 * @param db - The platform database.
 * @returns The current signing key pair, or `null` when somehow none is signing.
 */
export async function currentPlatformSigningKeyPair(db: Database): Promise<JWK.KeyPair | null> {
	let signing = await currentPlatformSigningKey(db);
	if (!signing) return null;

	return JWK.importKeyPair(toSerializedKeyPair(signing));
}

/** Promotes a staged key to signing and retires the key it replaces. */
async function promoteStagedKey(
	db: Database,
	staged: PlatformSigningKeyRow,
	signing: PlatformSigningKeyRow,
	now: number,
): Promise<void> {
	await db.update(platformSigningKeys, { id: staged.id }, { signing_from: now });
	await db.update(
		platformSigningKeys,
		{ id: signing.id },
		{ retired_at: now, publish_until: now + RETIRED_WINDOW_MS },
	);
}

/** Generates a successor for the given algorithm, published but not yet signing. */
async function stageSuccessor(db: Database, alg: JWK.Algorithm, now: number): Promise<void> {
	await insertGeneratedKey(db, alg, now, null);
}

/** Generates a key pair and writes it as a row, signing from the given time or staged. */
async function insertGeneratedKey(
	db: Database,
	alg: JWK.Algorithm,
	now: number,
	signingFrom: number | null,
): Promise<void> {
	let generated = await JWK.generateKeyPair(alg);

	await db.create(platformSigningKeys, {
		id: generated.id,
		alg: generated.alg,
		public_key: generated.publicKey,
		private_key: generated.privateKey,
		created_at: now,
		signing_from: signingFrom,
		retired_at: null,
		publish_until: null,
	});
}

/** Every row staged, signing, or retired but not yet past its publish window. */
async function publishedKeySet(db: Database, now: number): Promise<PublishedPlatformKeySet> {
	let rows = await db.findMany(platformSigningKeys, {
		where: or(isNull("publish_until"), gt("publish_until", now)),
	});

	let pairs = await Promise.all(rows.map((row) => JWK.importKeyPair(toSerializedKeyPair(row))));

	return JWK.toJSON(pairs);
}

/** Turns a stored row back into the shape `JWK.importKeyPair` accepts. */
function toSerializedKeyPair(row: PlatformSigningKeyRow): JWK.SerializedKeyPair {
	return {
		id: row.id as JWK.SerializedKeyPair["id"],
		alg: row.alg as JWK.Algorithm,
		publicKey: row.public_key,
		privateKey: row.private_key,
		created: row.created_at,
	};
}
