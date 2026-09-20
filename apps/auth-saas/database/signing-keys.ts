/**
 * A tenant's signing keys and its declared custom claims. The private half of a key
 * never leaves the object: every export here but `currentSigningKeyPair` returns a
 * published key set, never a `KeyPair`, so a caller holding the result has exactly
 * what a relying party is allowed to see. `currentSigningKeyPair` hands back the
 * live pair for the minting operation to sign with, and only a signed token string
 * ever crosses back out from there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { JWK } from "@sdxc/jwt";
import * as s from "remix/data-schema";
import { and, column as c, gt, isNull, lte, notNull, or, table } from "remix/data-table";

import { writeAuditEvent } from "./audit-events";

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

/** How many custom claims a tenant may declare at once. */
const MAX_CUSTOM_CLAIMS = 16;

/** How large the declared names and the attribute keys they read may serialize to. */
const MAX_CUSTOM_CLAIMS_PAYLOAD_BYTES = 4 * 1024;

/**
 * A namespaced-URI shape: a scheme-like prefix, a colon, then the rest of the name —
 * matching both a full URL (`https://example.com/roles`) and a bare URN
 * (`urn:example:roles`) without requiring HTTP specifically.
 */
const CUSTOM_CLAIM_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\S+$/;

/** Every claim name this design already gives a meaning to, reserved from redeclaration. */
const RESERVED_CLAIM_NAMES = new Set([
	"sub",
	"iss",
	"aud",
	"exp",
	"iat",
	"auth_time",
	"nonce",
	"azp",
	"amr",
	"sid",
	"jti",
	"client_id",
	"scope",
	"name",
	"given_name",
	"family_name",
	"nickname",
	"preferred_username",
	"picture",
	"locale",
	"zoneinfo",
	"email",
	"email_verified",
]);

/** A signing key's whole lifecycle in one row: staged, signing, retired, or gone. */
export const signingKeys = table({
	name: "signing_keys",
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

/** One claim a tenant declares onto its own tokens, read from a subject attribute. */
export const customClaims = table({
	name: "custom_claims",
	primaryKey: ["name"],
	columns: {
		name: c.text(),
		attribute_key: c.text(),
		placement: c.enum(["id_token", "access_token", "both"] as const),
		scope: c.text(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export type SigningKeyRow = TableRow<typeof signingKeys>;
export type CustomClaimRow = TableRow<typeof customClaims>;

/** The published document `.well-known/jwks.json` serves, with no private material. */
export type PublishedKeySet = ReturnType<typeof JWK.toJSON>;

export interface AdvanceSigningKeysInput {
	now?: number;
}

let AdvanceSigningKeysSchema = s.object({ now: s.optional(s.number()) });

/**
 * Performs every rotation transition due at the given time — staging a successor,
 * promoting a staged key and retiring the incumbent, deleting a key past its publish
 * window — and returns the resulting published set. Safe to call when nothing is due,
 * which is what lets a scheduled job page every tenant and call it on each one.
 *
 * @param db - The tenant's database.
 * @param input - The clock to advance the rotation against.
 * @returns The key set now published for this tenant.
 */
export async function advanceSigningKeys(
	db: Database,
	input: AdvanceSigningKeysInput = {},
): Promise<PublishedKeySet> {
	let parsed = s.parse(AdvanceSigningKeysSchema, input);
	let now = parsed.now ?? Date.now();

	for (let step = 0; step < MAX_ROTATION_STEPS_PER_CALL; step++) {
		if (await ensureSigningKey(db, now)) continue;

		let signing = await currentSigningKey(db);
		if (!signing || signing.signing_from === null) break;

		let staged = await db.findOne(signingKeys, { where: isNull("signing_from") });

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

	await db.deleteMany(signingKeys, {
		where: and(notNull("publish_until"), lte("publish_until", now)),
	});

	return publishedKeySet(db, now);
}

export interface PublishKeySetInput {
	now?: number;
}

let PublishKeySetSchema = s.object({ now: s.optional(s.number()) });

/**
 * Re-renders the tenant's currently published key set without performing any rotation
 * transition, for refilling a KV entry that is missing or being repaired.
 *
 * @param db - The tenant's database.
 * @param input - The clock a row's publish window is measured against.
 * @returns The key set currently published for this tenant.
 */
export async function publishKeySet(
	db: Database,
	input: PublishKeySetInput = {},
): Promise<PublishedKeySet> {
	let parsed = s.parse(PublishKeySetSchema, input);
	return publishedKeySet(db, parsed.now ?? Date.now());
}

/**
 * Generates this tenant's first signing key when it has none, staged and signing at
 * once — a tenant is never left in a state where a token can be requested and nothing
 * can sign it. Shared by provisioning, which calls it directly, and by
 * {@link advanceSigningKeys}, which calls it whenever every key has somehow lapsed.
 *
 * @param db - The tenant's database.
 * @param now - When the key starts signing.
 * @returns Whether a key was generated; `false` when one was already signing.
 */
export async function ensureSigningKey(db: Database, now: number = Date.now()): Promise<boolean> {
	let signing = await currentSigningKey(db);
	if (signing) return false;

	await insertGeneratedKey(db, JWK.Algorithm.ES256, now, now);
	return true;
}

export interface CustomClaimDeclaration {
	name: string;
	attributeKey: string;
	placement: "id_token" | "access_token" | "both";
	scope: string;
}

export interface SetCustomClaimsInput {
	claims: CustomClaimDeclaration[];
}

export type SetCustomClaimsResult =
	| { ok: true }
	| { ok: false; reason: "duplicate-name"; name: string }
	| { ok: false; reason: "not-namespaced"; name: string }
	| { ok: false; reason: "reserved-name"; name: string }
	| { ok: false; reason: "too-many-claims" }
	| { ok: false; reason: "payload-too-large" };

let CustomClaimSchema = s.object({
	name: s.string(),
	attributeKey: s.string(),
	placement: s.enum_(["id_token", "access_token", "both"] as const),
	scope: s.string(),
});

let SetCustomClaimsSchema = s.object({ claims: s.array(CustomClaimSchema) });

/**
 * Replaces the tenant's whole set of declared custom claims in one write, refusing a
 * name that is not namespaced as a URI, one already claimed by a registered or minted
 * claim, or a set over the claim or payload-size cap.
 *
 * @param db - The tenant's database.
 * @param input - The full set of claims the tenant now declares.
 * @returns Success, or which rule refused the call.
 */
export async function setCustomClaims(
	db: Database,
	input: SetCustomClaimsInput,
): Promise<SetCustomClaimsResult> {
	let parsed = s.parse(SetCustomClaimsSchema, input);

	if (parsed.claims.length > MAX_CUSTOM_CLAIMS) return { ok: false, reason: "too-many-claims" };

	let seen = new Set<string>();

	for (let claim of parsed.claims) {
		if (seen.has(claim.name)) return { ok: false, reason: "duplicate-name", name: claim.name };
		seen.add(claim.name);

		if (RESERVED_CLAIM_NAMES.has(claim.name)) {
			return { ok: false, reason: "reserved-name", name: claim.name };
		}

		if (!CUSTOM_CLAIM_NAME_PATTERN.test(claim.name)) {
			return { ok: false, reason: "not-namespaced", name: claim.name };
		}
	}

	let payload = parsed.claims.map((claim) => ({
		name: claim.name,
		attributeKey: claim.attributeKey,
	}));
	let payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
	if (payloadBytes > MAX_CUSTOM_CLAIMS_PAYLOAD_BYTES)
		return { ok: false, reason: "payload-too-large" };

	let now = Date.now();

	await db.deleteMany(customClaims, { where: {} });

	for (let claim of parsed.claims) {
		await db.create(customClaims, {
			name: claim.name,
			attribute_key: claim.attributeKey,
			placement: claim.placement,
			scope: claim.scope,
			created_at: now,
			updated_at: now,
		});
	}

	return { ok: true };
}

/** The one row, if any, whose `signing_from` is set and has not been retired. */
async function currentSigningKey(db: Database): Promise<SigningKeyRow | null> {
	return db.findOne(signingKeys, { where: and(notNull("signing_from"), isNull("retired_at")) });
}

/**
 * Hands back the tenant's current signing key as a usable `KeyPair`, private half
 * included, for the token endpoint to sign with. This is the one export from this
 * module that carries private key material — reserved for the minting operation
 * itself, since producing a token is the one thing worth crossing the object's
 * boundary for; the string a caller signs with this pair is all that leaves.
 *
 * @param db - The tenant's database.
 * @returns The current signing key pair, or `null` when somehow none is signing.
 */
export async function currentSigningKeyPair(db: Database): Promise<JWK.KeyPair | null> {
	let signing = await currentSigningKey(db);
	if (!signing) return null;

	return JWK.importKeyPair(toSerializedKeyPair(signing));
}

/** Promotes a staged key to signing and retires the key it replaces. */
async function promoteStagedKey(
	db: Database,
	staged: SigningKeyRow,
	signing: SigningKeyRow,
	now: number,
): Promise<void> {
	await db.update(signingKeys, { id: staged.id }, { signing_from: now });
	await db.update(
		signingKeys,
		{ id: signing.id },
		{ retired_at: now, publish_until: now + RETIRED_WINDOW_MS },
	);

	await writeAuditEvent(db, {
		action: "signing_key.rotated",
		actor: { type: "platform", id: "system" },
		targetType: "signing_key",
		targetId: staged.id,
		outcome: "succeeded",
		detail: { retiredKeyId: signing.id },
		at: now,
	});
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

	await db.create(signingKeys, {
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
async function publishedKeySet(db: Database, now: number): Promise<PublishedKeySet> {
	let rows = await db.findMany(signingKeys, {
		where: or(isNull("publish_until"), gt("publish_until", now)),
	});

	let pairs = await Promise.all(rows.map((row) => JWK.importKeyPair(toSerializedKeyPair(row))));

	return JWK.toJSON(pairs);
}

/** Turns a stored row back into the shape `JWK.importKeyPair` accepts. */
function toSerializedKeyPair(row: SigningKeyRow): JWK.SerializedKeyPair {
	return {
		id: row.id as JWK.SerializedKeyPair["id"],
		alg: row.alg as JWK.Algorithm,
		publicKey: row.public_key,
		privateKey: row.private_key,
		created: row.created_at,
	};
}
