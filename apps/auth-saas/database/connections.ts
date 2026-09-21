/**
 * Social identity provider connections: the `connections` and `connection_mappings`
 * tables, and the configuration operations over them — the catalog and generic
 * connections a tenant sets up so its sign-in page can offer a provider a person
 * already holds an account with. Building and running the actual sign-in flow
 * against a connection is a later pass's job; everything here is configuration:
 * saving a connection's shape and credentials, enabling and removing it, and
 * describing what a sign-in page renders buttons from.
 *
 * Reads `attributeDefinitions` from `subjects.ts` to validate a mapping's `target`,
 * the one cross-reference this module needs — the same way `credentials.ts` reads
 * from `subjects.ts`, `passwords.ts` and `passkeys.ts` for its own single check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { seal } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { column as c, eq, table } from "remix/data-table";

import type { ConnectionCatalogEntry } from "./connection-catalog";

import { writeAuditEvent } from "./audit-events";
import { findConnectionCatalogEntry } from "./connection-catalog";
import { attributeDefinitions } from "./subjects";

/** The audit actor for a call with no operator identity threaded through today. */
const PLATFORM_ACTOR = { type: "platform", id: "system" } as const;

/** Mints a `conn` id for a new connection. */
const connectionRowId = typeid("conn");

/**
 * A tenant's configured social identity provider, either pre-filled from
 * {@link ConnectionCatalogEntry} or supplied from scratch. Created disabled and
 * refused a `true` `enabled` write until it holds a sealed client secret, so a
 * half-configured provider never appears on a sign-in page.
 */
export const connections = table({
	name: "connections",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		slug: c.text(),
		// Plain text rather than a narrow enum: a later addition extends this same
		// table with a directory-routed kind, and a text column needs no migration
		// to accept it.
		kind: c.text(),
		catalog_entry: c.text().nullable(),
		display_name: c.text(),
		enabled: c.boolean().default(false),
		issuer: c.text().nullable(),
		authorization_endpoint: c.text().nullable(),
		token_endpoint: c.text().nullable(),
		userinfo_endpoint: c.text().nullable(),
		client_id: c.text(),
		client_secret_sealed: c.text().nullable(),
		scopes: c.json(),
		subject_claim: c.text(),
		email_authority: c.boolean(),
		auto_link: c.boolean().default(false),
		on_unknown_subject: c.enum(["create", "refuse"] as const).default("create"),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** One claim a connection maps into a subject's profile or a declared attribute. */
export const connectionMappings = table({
	name: "connection_mappings",
	primaryKey: ["connection_id", "target"],
	columns: {
		connection_id: c.text(),
		source: c.text(),
		target: c.text(),
		apply: c.enum(["on-create", "on-every-sign-in"] as const),
	},
});

/**
 * The flow in progress for one sign-in attempt against a connection. Pass 2 is
 * what populates and reads this table; it is created now so the schema a
 * connection extends into is whole in one migration.
 */
export const connectionTransactions = table({
	name: "connection_transactions",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		connection_id: c.text(),
		state: c.text(),
		nonce: c.text(),
		verifier: c.text(),
		hostname: c.text(),
		authorization_request_id: c.text().nullable(),
		scopes: c.json(),
		expires_at: c.integer(),
	},
});

export type ConnectionRow = TableRow<typeof connections>;
export type ConnectionMappingRow = TableRow<typeof connectionMappings>;

/** Which protocol shape a connection carries. `saml` is a later addition's own kind, not built here. */
export type ConnectionKind = "oidc" | "oauth2";

/** When a mapped claim is written: only at first sign-in, or refreshed on every one. */
export type MappingApply = "on-create" | "on-every-sign-in";

/** What happens when nobody the mapped claims resolve to already exists — Pass 2's own job to act on. */
export type OnUnknownSubject = "create" | "refuse";

/** One row of {@link SaveConnectionInput}'s `mappings`. */
export interface ConnectionMappingInput {
	source: string;
	target: string;
	apply: MappingApply;
}

/**
 * The standard profile columns a mapping's `target` may name instead of a
 * declared attribute key, read off `subjects.ts`'s own `SubjectProfile` shape
 * rather than duplicated here as a second list that could drift from it.
 */
export const STANDARD_PROFILE_TARGETS = new Set([
	"name",
	"givenName",
	"familyName",
	"nickname",
	"preferredUsername",
	"picture",
	"locale",
	"zoneinfo",
]);

let MappingInputSchema = s.object({
	source: s.string(),
	target: s.string(),
	apply: s.enum_(["on-create", "on-every-sign-in"] as const),
});

let SaveConnectionSchema = s.object({
	connectionId: s.optional(s.string()),
	slug: s.string(),
	displayName: s.optional(s.string()),
	catalogEntry: s.optional(s.string()),
	kind: s.optional(s.enum_(["oidc", "oauth2"] as const)),
	issuer: s.optional(s.string()),
	authorizationEndpoint: s.optional(s.string()),
	tokenEndpoint: s.optional(s.string()),
	userinfoEndpoint: s.optional(s.string()),
	clientId: s.string(),
	clientSecret: s.optional(s.string()),
	scopes: s.optional(s.array(s.string())),
	subjectClaim: s.optional(s.string()),
	emailAuthority: s.optional(s.boolean()),
	autoLink: s.optional(s.boolean()),
	onUnknownSubject: s.optional(s.enum_(["create", "refuse"] as const)),
	mappings: s.optional(s.array(MappingInputSchema)),
	/**
	 * The tenant's own platform-subdomain origin, filled in by the tenant object from
	 * its `#issuer()` rather than asked of a caller — the same way `exchangeCode` and
	 * `publishMetadata` fill in `issuer` themselves. Named apart from the connection's
	 * own `issuer` field, which is the *provider's* discovery URL for an OIDC
	 * connection and would otherwise collide with this one.
	 */
	callbackOrigin: s.string(),
});

export interface SaveConnectionInput {
	/** Present to update an existing connection; absent to create one. */
	connectionId?: string;
	/** Unique per tenant, chosen once — refused on an update that tries to change it. */
	slug: string;
	displayName?: string;
	/** A {@link findConnectionCatalogEntry} id; when set, pre-fills everything but `clientId`/`clientSecret`. */
	catalogEntry?: string;
	/** Required for a from-scratch connection; ignored (the catalog entry's own kind wins) for a catalog-backed one. */
	kind?: ConnectionKind;
	issuer?: string;
	authorizationEndpoint?: string;
	tokenEndpoint?: string;
	userinfoEndpoint?: string;
	clientId: string;
	/** Omitted to leave an update's existing secret as it was, or to save a connection with none yet. */
	clientSecret?: string;
	scopes?: string[];
	subjectClaim?: string;
	emailAuthority?: boolean;
	autoLink?: boolean;
	onUnknownSubject?: OnUnknownSubject;
	/** The connection's whole mapping set, replaced wholesale on every save. */
	mappings?: ConnectionMappingInput[];
	callbackOrigin: string;
}

/** A connection's public record, as every RPC method hands it back — never the sealed secret. */
export interface ConnectionRecord {
	id: string;
	slug: string;
	kind: string;
	catalogEntry: string | null;
	displayName: string;
	enabled: boolean;
	issuer: string | null;
	authorizationEndpoint: string | null;
	tokenEndpoint: string | null;
	userinfoEndpoint: string | null;
	clientId: string;
	/** Whether a secret is sealed for this connection — never the secret itself. */
	hasClientSecret: boolean;
	scopes: string[];
	subjectClaim: string;
	emailAuthority: boolean;
	autoLink: boolean;
	onUnknownSubject: OnUnknownSubject;
	mappings: ConnectionMappingInput[];
	createdAt: number;
	updatedAt: number;
}

function toConnectionRecord(
	row: ConnectionRow,
	mappings: ConnectionMappingRow[],
): ConnectionRecord {
	return {
		id: row.id,
		slug: row.slug,
		kind: row.kind,
		catalogEntry: row.catalog_entry,
		displayName: row.display_name,
		enabled: row.enabled,
		issuer: row.issuer,
		authorizationEndpoint: row.authorization_endpoint,
		tokenEndpoint: row.token_endpoint,
		userinfoEndpoint: row.userinfo_endpoint,
		clientId: row.client_id,
		hasClientSecret: row.client_secret_sealed !== null,
		scopes: row.scopes as string[],
		subjectClaim: row.subject_claim,
		emailAuthority: row.email_authority,
		autoLink: row.auto_link,
		onUnknownSubject: row.on_unknown_subject as OnUnknownSubject,
		mappings: mappings.map((mapping) => ({
			source: mapping.source,
			target: mapping.target,
			apply: mapping.apply as MappingApply,
		})),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/** The redirect URI a provider's console is told once: fixed to the tenant's platform subdomain, named by this connection's own immutable slug. */
export function buildCallbackUrl(callbackOrigin: string, slug: string): string {
	return `${callbackOrigin}/u/connections/${slug}/callback`;
}

/** Whether a mapping's `target` resolves against a standard profile column or a declared attribute key. */
async function isKnownMappingTarget(db: Database, target: string): Promise<boolean> {
	if (STANDARD_PROFILE_TARGETS.has(target)) return true;
	let definition = await db.find(attributeDefinitions, { key: target });
	return definition !== null;
}

/** Why {@link saveConnection} refused the shape it was given. */
export type SaveConnectionValidationFailure =
	| { ok: false; reason: "unknown-catalog-entry"; catalogEntry: string }
	| { ok: false; reason: "missing-kind" }
	| { ok: false; reason: "unsupported-kind"; kind: string }
	| { ok: false; reason: "missing-issuer" }
	| { ok: false; reason: "missing-endpoint"; endpoint: string }
	| { ok: false; reason: "missing-display-name" }
	| { ok: false; reason: "unknown-mapping-target"; target: string };

/** The shape {@link saveConnection} resolves an input down to before writing anything. */
interface ResolvedConnectionShape {
	kind: ConnectionKind;
	displayName: string;
	issuer: string | null;
	authorizationEndpoint: string | null;
	tokenEndpoint: string | null;
	userinfoEndpoint: string | null;
	scopes: string[];
	subjectClaim: string;
	emailAuthority: boolean;
}

/**
 * Resolves a catalog-backed or from-scratch input down to the fields the table
 * actually stores, validating that an OIDC shape carries an issuer and an OAuth2
 * shape carries all three endpoints.
 */
function resolveConnectionShape(
	parsed: Pick<
		SaveConnectionInput,
		| "catalogEntry"
		| "kind"
		| "displayName"
		| "issuer"
		| "authorizationEndpoint"
		| "tokenEndpoint"
		| "userinfoEndpoint"
		| "scopes"
		| "subjectClaim"
		| "emailAuthority"
	>,
): { ok: true; shape: ResolvedConnectionShape } | SaveConnectionValidationFailure {
	let catalog: ConnectionCatalogEntry | undefined;

	if (parsed.catalogEntry !== undefined) {
		catalog = findConnectionCatalogEntry(parsed.catalogEntry);
		if (!catalog) {
			return { ok: false, reason: "unknown-catalog-entry", catalogEntry: parsed.catalogEntry };
		}
	}

	let kind = catalog?.kind ?? parsed.kind;
	if (!kind) return { ok: false, reason: "missing-kind" };
	if (kind !== "oidc" && kind !== "oauth2") return { ok: false, reason: "unsupported-kind", kind };

	let displayName = parsed.displayName ?? catalog?.displayName;
	if (!displayName) return { ok: false, reason: "missing-display-name" };

	let issuer = catalog?.kind === "oidc" ? catalog.issuer : (parsed.issuer ?? null);
	let authorizationEndpoint =
		catalog?.kind === "oauth2"
			? catalog.authorizationEndpoint
			: (parsed.authorizationEndpoint ?? null);
	let tokenEndpoint =
		catalog?.kind === "oauth2" ? catalog.tokenEndpoint : (parsed.tokenEndpoint ?? null);
	let userinfoEndpoint =
		catalog?.kind === "oauth2" ? catalog.userinfoEndpoint : (parsed.userinfoEndpoint ?? null);

	if (kind === "oidc" && !issuer) return { ok: false, reason: "missing-issuer" };

	if (kind === "oauth2") {
		if (!authorizationEndpoint) {
			return { ok: false, reason: "missing-endpoint", endpoint: "authorizationEndpoint" };
		}
		if (!tokenEndpoint) return { ok: false, reason: "missing-endpoint", endpoint: "tokenEndpoint" };
		if (!userinfoEndpoint) {
			return { ok: false, reason: "missing-endpoint", endpoint: "userinfoEndpoint" };
		}
	}

	let scopes = parsed.scopes ?? catalog?.scopes ?? [];
	let subjectClaim = parsed.subjectClaim ?? catalog?.subjectClaim ?? "sub";
	let emailAuthority = parsed.emailAuthority ?? catalog?.emailAuthority ?? false;

	return {
		ok: true,
		shape: {
			kind,
			displayName,
			issuer,
			authorizationEndpoint,
			tokenEndpoint,
			userinfoEndpoint,
			scopes,
			subjectClaim,
			emailAuthority,
		},
	};
}

/** Replaces a connection's whole mapping set, validating every `target` first so nothing partial is ever written. */
async function replaceMappings(
	db: Database,
	connectionId: string,
	mappings: ConnectionMappingInput[],
): Promise<{ ok: true } | { ok: false; reason: "unknown-mapping-target"; target: string }> {
	for (let mapping of mappings) {
		let known = await isKnownMappingTarget(db, mapping.target);
		if (!known) return { ok: false, reason: "unknown-mapping-target", target: mapping.target };
	}

	await db.deleteMany(connectionMappings, { where: { connection_id: connectionId } });

	for (let mapping of mappings) {
		await db.create(connectionMappings, {
			connection_id: connectionId,
			source: mapping.source,
			target: mapping.target,
			apply: mapping.apply,
		});
	}

	return { ok: true };
}

export type SaveConnectionResult =
	| { ok: true; connection: ConnectionRecord; callbackUrl: string }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "slug-immutable" }
	| { ok: false; reason: "duplicate-slug" }
	| SaveConnectionValidationFailure;

/**
 * Validates and writes a connection's whole configuration in one call: resolves a
 * catalog entry or a from-scratch shape, validates every mapping's `target` against
 * a standard profile column or a declared attribute key, seals the client secret
 * when one is given, and claims the slug. Creates a new connection when
 * `connectionId` is omitted, refusing a slug already claimed by another; updates the
 * named one otherwise, refusing an attempt to change its slug.
 *
 * A connection is written disabled by default and stays however it was left on an
 * update — enabling one is {@link setConnectionEnabled}'s job, not this call's.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The whole connection to save, and the origin its callback URL is
 * built against.
 * @returns The connection's public record and the callback URL to register with the
 * provider, or which rule refused the save.
 */
export async function saveConnection(
	db: Database,
	sealKey: CryptoKey,
	input: SaveConnectionInput,
): Promise<SaveConnectionResult> {
	let parsed = s.parse(SaveConnectionSchema, input);

	let existing = parsed.connectionId
		? await db.find(connections, { id: parsed.connectionId })
		: null;
	if (parsed.connectionId && !existing) return { ok: false, reason: "not-found" };
	if (existing && existing.slug !== parsed.slug) return { ok: false, reason: "slug-immutable" };

	if (!existing) {
		let taken = await db.findOne(connections, { where: { slug: parsed.slug } });
		if (taken) return { ok: false, reason: "duplicate-slug" };
	}

	let resolved = resolveConnectionShape(parsed);
	if (!resolved.ok) return resolved;

	let mappings = parsed.mappings ?? [];

	let now = Date.now();
	let id = existing?.id ?? connectionRowId(generateUUID()).toString();

	let sealedSecret: string | undefined;
	if (parsed.clientSecret !== undefined) {
		let sealedResult = await seal(sealKey, parsed.clientSecret);
		if (isFailure(sealedResult)) throw new Error("failed to seal the connection's client secret");
		sealedSecret = sealedResult.data;
	}

	if (existing) {
		await db.update(
			connections,
			{ id },
			{
				display_name: resolved.shape.displayName,
				catalog_entry: parsed.catalogEntry ?? null,
				kind: resolved.shape.kind,
				issuer: resolved.shape.issuer,
				authorization_endpoint: resolved.shape.authorizationEndpoint,
				token_endpoint: resolved.shape.tokenEndpoint,
				userinfo_endpoint: resolved.shape.userinfoEndpoint,
				client_id: parsed.clientId,
				...(sealedSecret !== undefined ? { client_secret_sealed: sealedSecret } : {}),
				scopes: resolved.shape.scopes,
				subject_claim: resolved.shape.subjectClaim,
				email_authority: resolved.shape.emailAuthority,
				auto_link: parsed.autoLink ?? existing.auto_link,
				on_unknown_subject: parsed.onUnknownSubject ?? existing.on_unknown_subject,
				updated_at: now,
			},
		);
	} else {
		await db.create(connections, {
			id,
			slug: parsed.slug,
			kind: resolved.shape.kind,
			catalog_entry: parsed.catalogEntry ?? null,
			display_name: resolved.shape.displayName,
			enabled: false,
			issuer: resolved.shape.issuer,
			authorization_endpoint: resolved.shape.authorizationEndpoint,
			token_endpoint: resolved.shape.tokenEndpoint,
			userinfo_endpoint: resolved.shape.userinfoEndpoint,
			client_id: parsed.clientId,
			client_secret_sealed: sealedSecret ?? null,
			scopes: resolved.shape.scopes,
			subject_claim: resolved.shape.subjectClaim,
			email_authority: resolved.shape.emailAuthority,
			auto_link: parsed.autoLink ?? false,
			on_unknown_subject: parsed.onUnknownSubject ?? "create",
			created_at: now,
			updated_at: now,
		});
	}

	let mapped = await replaceMappings(db, id, mappings);
	if (!mapped.ok) return mapped;

	let row = await db.find(connections, { id });
	if (!row) throw new Error("connection row missing immediately after its own write");

	let mappingRows = await db.findMany(connectionMappings, { where: { connection_id: id } });

	await writeAuditEvent(db, {
		action: existing ? "connection.updated" : "connection.created",
		actor: PLATFORM_ACTOR,
		targetType: "connection",
		targetId: id,
		outcome: "succeeded",
		detail: { slug: parsed.slug, kind: resolved.shape.kind },
	});

	return {
		ok: true,
		connection: toConnectionRecord(row, mappingRows),
		callbackUrl: buildCallbackUrl(parsed.callbackOrigin, row.slug),
	};
}

export type SetConnectionEnabledResult =
	| { ok: true; connection: ConnectionRecord }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "missing-secret" };

/**
 * Turns a connection on or off. A connection that authenticates with a client
 * secret is enabled only once one is sealed, since a half-configured provider
 * must never appear on a sign-in page; a connection whose readiness is a set of
 * certificates has that checked by the call that owns them.
 *
 * @param db - The tenant's database.
 * @param input - The connection's slug, and whether it should now be enabled.
 * @returns The connection's public record, or why the change was refused.
 */
export async function setConnectionEnabled(
	db: Database,
	input: { slug: string; enabled: boolean },
): Promise<SetConnectionEnabledResult> {
	let row = await db.findOne(connections, { where: { slug: input.slug } });
	if (!row) return { ok: false, reason: "not-found" };

	if (input.enabled && row.kind !== "saml" && row.client_secret_sealed === null) {
		return { ok: false, reason: "missing-secret" };
	}

	await db.update(connections, { id: row.id }, { enabled: input.enabled, updated_at: Date.now() });

	let updated = await db.find(connections, { id: row.id });
	if (!updated) throw new Error("connection row missing immediately after its own update");

	let mappingRows = await db.findMany(connectionMappings, { where: { connection_id: row.id } });

	await writeAuditEvent(db, {
		action: input.enabled ? "connection.enabled" : "connection.disabled",
		actor: PLATFORM_ACTOR,
		targetType: "connection",
		targetId: row.id,
		outcome: "succeeded",
		detail: { slug: row.slug },
	});

	return { ok: true, connection: toConnectionRecord(updated, mappingRows) };
}

export type RemoveConnectionResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Removes a connection and its mappings.
 *
 * Account linking — the identity record a subject signed in through this
 * connection would be attached to — is a later addition's job and does not exist
 * in this codebase yet, so there is currently nothing for `unlinkIdentities` to
 * check against: removal always proceeds. Once that identity table exists, this is
 * where it is read: refuse when a live identity still references this connection
 * unless `unlinkIdentities` is `true`, and unlink each one before the delete below
 * rather than growing a second removal path.
 *
 * @param db - The tenant's database.
 * @param input - The connection's slug, and whether a referencing identity may be
 * unlinked rather than block the removal.
 * @returns Success, or that no such connection exists.
 */
export async function removeConnection(
	db: Database,
	input: { slug: string; unlinkIdentities: boolean },
): Promise<RemoveConnectionResult> {
	let row = await db.findOne(connections, { where: { slug: input.slug } });
	if (!row) return { ok: false, reason: "not-found" };

	await db.deleteMany(connectionMappings, { where: { connection_id: row.id } });
	await db.delete(connections, { id: row.id });

	await writeAuditEvent(db, {
		action: "connection.removed",
		actor: PLATFORM_ACTOR,
		targetType: "connection",
		targetId: row.id,
		outcome: "succeeded",
		detail: { slug: row.slug },
	});

	return { ok: true };
}

/** Nothing to pass yet; kept as an input parameter for the same shape every other RPC method takes. */
export type DescribeConnectionsInput = Record<string, never>;

export interface DescribeConnectionsResult {
	connections: ConnectionRecord[];
}

/**
 * Every enabled connection's public record, the read a sign-in page renders its
 * provider buttons from. A disabled connection — including one still missing its
 * client secret — never appears here.
 *
 * @param db - The tenant's database.
 * @returns Every enabled connection, oldest first.
 */
export async function describeConnections(
	db: Database,
	_input: DescribeConnectionsInput = {},
): Promise<DescribeConnectionsResult> {
	let rows = await db.findMany(connections, {
		where: eq("enabled", true),
		orderBy: ["created_at", "asc"],
	});

	let result: ConnectionRecord[] = [];

	for (let row of rows) {
		let mappingRows = await db.findMany(connectionMappings, { where: { connection_id: row.id } });
		result.push(toConnectionRecord(row, mappingRows));
	}

	return { connections: result };
}
