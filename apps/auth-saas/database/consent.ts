/**
 * Scopes and grants: what a client may ask for, what a person has agreed to give it, and
 * the consent screen that sits between the two. A scope is a name a client requests; a
 * grant is a person's standing decision about one client, one row per subject and client
 * pair.
 *
 * Deciding what a screen should show and recording the decision a person took are kept as
 * two separate functions here, because they answer to different callers: one resolves a
 * client and a session and only ever reads, the other receives a submitted decision and is
 * the only one that writes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetCursors } from "@sdxc/pagination";
import type { Database, TableRow } from "remix/data-table";

import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { and, column as c, eq, inList, table } from "remix/data-table";

import type { SubjectRow } from "./subjects";

import { clients } from "./clients";
import { subjectIdentifiers, subjects } from "./subjects";

/** Grant summaries a subject's own list returns, most recently agreed to first. */
const DEFAULT_PAGE_SIZE = 20;

/** What a client may ask for, and what each one carries onto a consent screen. */
export const scopes = table({
	name: "scopes",
	primaryKey: ["name"],
	columns: {
		name: c.text(),
		title: c.text(),
		description: c.text(),
		claims: c.json(),
		is_standard: c.boolean(),
		created_at: c.integer(),
	},
});

/** One person's standing decision about one client: which scopes they have agreed to give it. */
export const grants = table({
	name: "grants",
	primaryKey: ["subject_id", "client_id"],
	columns: {
		subject_id: c.text(),
		client_id: c.text(),
		scopes: c.json(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export type ScopeRow = TableRow<typeof scopes>;
export type GrantRow = TableRow<typeof grants>;

/**
 * What a consent screen renders. The client section carries only what a client's record
 * holds today; a logo, a policy link and a terms-of-service link render once a client can
 * register one.
 */
export interface ConsentScreen {
	client: {
		id: string;
		name: string;
		logoUri: string | null;
		policyUri: string | null;
		tosUri: string | null;
	};
	subject: { id: string; displayName: string; email: string | null };
	requested: Array<{ scope: string; title: string; description: string; granted: boolean }>;
}

export interface EvaluateConsentInput {
	subjectId: string;
	clientId: string;
	requestedScopes: string[];
	isFirstParty: boolean;
	promptConsent: boolean;
	silent: boolean;
}

/**
 * What evaluating consent answers: skip straight to the scopes already in force, show a
 * screen for the person to decide on, or refuse because a screen would be needed and the
 * caller asked for no interaction. `not-found` is for a client or subject id that does not
 * resolve in this tenant; only `show` can reach it, since skipping needs neither record.
 */
export type EvaluateConsentResult =
	| { decision: "skip"; grantedScopes: string[] }
	| { decision: "show"; screen: ConsentScreen }
	| { decision: "consent-required-silent" }
	| { decision: "not-found" };

let EvaluateConsentSchema = s.object({
	subjectId: s.string(),
	clientId: s.string(),
	requestedScopes: s.array(s.string()),
	isFirstParty: s.boolean(),
	promptConsent: s.boolean(),
	silent: s.boolean(),
});

/**
 * Decides what a consent screen should show for one authorization request, without
 * writing anything. A first-party client skips unconditionally; otherwise a stored grant
 * that already covers every requested scope skips too, unless `promptConsent` forces a
 * screen anyway. A request outside the stored grant, or with no grant at all, shows one,
 * listing which of the requested scopes are already granted and which are new. When a
 * screen would be needed but the caller demands no interaction, the refusal comes back
 * instead of a screen, so the caller can answer with `consent_required` rather than render
 * anything.
 *
 * @param db - The tenant's database.
 * @param input - The subject and client an authorization request named, the scopes it
 * asked for, whether the client is first-party, and whether consent or silence was
 * demanded.
 * @returns The decision, with the assembled screen only when one is shown.
 */
export async function evaluateConsent(
	db: Database,
	input: EvaluateConsentInput,
): Promise<EvaluateConsentResult> {
	let parsed = s.parse(EvaluateConsentSchema, input);

	if (parsed.isFirstParty) {
		return { decision: "skip", grantedScopes: parsed.requestedScopes };
	}

	let grant = await db.find(grants, { subject_id: parsed.subjectId, client_id: parsed.clientId });
	let existingScopes = grant ? (grant.scopes as string[]) : [];
	let missing = parsed.requestedScopes.filter((scope) => !existingScopes.includes(scope));
	let fullyCovered = grant !== null && missing.length === 0;

	if (!parsed.promptConsent && fullyCovered) {
		return { decision: "skip", grantedScopes: existingScopes };
	}

	if (parsed.silent) return { decision: "consent-required-silent" };

	let screen = await buildConsentScreen(db, parsed, existingScopes);
	if (!screen) return { decision: "not-found" };

	return { decision: "show", screen };
}

/** Assembles the screen `evaluateConsent` shows, or `null` for a client or subject that does not resolve. */
async function buildConsentScreen(
	db: Database,
	input: { subjectId: string; clientId: string; requestedScopes: string[] },
	existingScopes: string[],
): Promise<ConsentScreen | null> {
	let client = await db.find(clients, { id: input.clientId });
	if (!client) return null;

	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return null;

	let primaryEmail = await db.findOne(subjectIdentifiers, {
		where: and(eq("subject_id", input.subjectId), eq("kind", "email"), eq("is_primary", true)),
	});

	let scopeRows =
		input.requestedScopes.length === 0
			? []
			: await db.findMany(scopes, { where: inList("name", input.requestedScopes) });
	let scopeByName = new Map(scopeRows.map((row) => [row.name, row]));

	return {
		client: { id: client.id, name: client.name, logoUri: null, policyUri: null, tosUri: null },
		subject: {
			id: subject.id,
			displayName: displayNameOf(subject),
			email: primaryEmail?.value ?? null,
		},
		requested: input.requestedScopes.map((scope) => {
			let row = scopeByName.get(scope);
			return {
				scope,
				title: row?.title ?? scope,
				description: row?.description ?? "",
				granted: existingScopes.includes(scope),
			};
		}),
	};
}

/** The best name on hand for a consent screen's subject section, falling back to its id. */
function displayNameOf(subject: SubjectRow): string {
	if (subject.name) return subject.name;

	let fullName = [subject.given_name, subject.family_name].filter(Boolean).join(" ");
	if (fullName.length > 0) return fullName;

	return subject.nickname ?? subject.preferred_username ?? subject.id;
}

export interface RecordConsentDecisionInput {
	subjectId: string;
	clientId: string;
	approved: boolean;
	scopes: string[];
}

/** What recording a decision answers: the resulting scope set on approval, nothing on denial. */
export type RecordConsentDecisionResult =
	| { decision: "approved"; scopes: string[] }
	| { decision: "denied" };

let RecordConsentDecisionSchema = s.object({
	subjectId: s.string(),
	clientId: s.string(),
	approved: s.boolean(),
	scopes: s.array(s.string()),
});

/**
 * Records the decision a person took on a consent screen. Approval unions the agreed
 * scopes into the subject's existing grant for this client, creating the row when none
 * exists yet, so a later request asking for fewer scopes never drops what an earlier one
 * already won. Denial changes nothing, leaving the client free to be granted later.
 *
 * @param db - The tenant's database.
 * @param input - The subject and client the decision concerns, whether it was an
 * approval, and the scopes it covers.
 * @returns The full resulting scope set on approval, or that nothing was recorded.
 */
export async function recordConsentDecision(
	db: Database,
	input: RecordConsentDecisionInput,
): Promise<RecordConsentDecisionResult> {
	let parsed = s.parse(RecordConsentDecisionSchema, input);

	if (!parsed.approved) return { decision: "denied" };

	let now = Date.now();
	let existing = await db.find(grants, {
		subject_id: parsed.subjectId,
		client_id: parsed.clientId,
	});

	let scopeSet = new Set(parsed.scopes);
	if (existing) for (let scope of existing.scopes as string[]) scopeSet.add(scope);
	let mergedScopes = [...scopeSet];

	if (existing) {
		await db.update(
			grants,
			{ subject_id: parsed.subjectId, client_id: parsed.clientId },
			{ scopes: mergedScopes, updated_at: now },
		);
	} else {
		await db.create(grants, {
			subject_id: parsed.subjectId,
			client_id: parsed.clientId,
			scopes: mergedScopes,
			created_at: now,
			updated_at: now,
		});
	}

	return { decision: "approved", scopes: mergedScopes };
}

export type RevokeGrantResult = { kind: "revoked" } | { kind: "unknown" };

/**
 * Ends a subject's standing decision for one client, deleting the grant row. Reaching the
 * refresh tokens that decision authorized happens once a table exists to act on, the way
 * `deleteSubject`'s own caller grew to also delete passwords and passkeys once those
 * tables existed.
 *
 * @param db - The tenant's database.
 * @param input - The subject and client whose grant to revoke.
 * @returns That the grant was revoked, or that no such grant existed.
 */
export async function revokeGrant(
	db: Database,
	input: { subjectId: string; clientId: string },
): Promise<RevokeGrantResult> {
	let existing = await db.find(grants, {
		subject_id: input.subjectId,
		client_id: input.clientId,
	});
	if (!existing) return { kind: "unknown" };

	await db.delete(grants, { subject_id: input.subjectId, client_id: input.clientId });

	return { kind: "revoked" };
}

export interface ListGrantsInput {
	subjectId: string;
	cursor?: string | null;
	limit?: number;
}

/** One grant as a subject's account portal renders it. */
export interface GrantSummary {
	clientId: string;
	clientName: string;
	scopes: string[];
	createdAt: number;
}

export type ListGrantsResult =
	| { ok: true; grants: GrantSummary[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ListGrantsSchema = s.object({
	subjectId: s.string(),
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
});

/**
 * A page of a subject's own grants, most recently agreed to first, for the account portal
 * a person reviews and revokes access from.
 *
 * @param db - The tenant's database.
 * @param input - The subject whose grants to list, and where to page from.
 * @returns A page of grant summaries and the cursors around it, or that the given cursor
 * no longer matches this ordering.
 */
export async function listGrants(db: Database, input: ListGrantsInput): Promise<ListGrantsResult> {
	let parsed = s.parse(ListGrantsSchema, input);

	let query = db
		.query(grants)
		.where(eq("subject_id", parsed.subjectId))
		.select("client_id", "scopes", "created_at");

	let page = await Pagination.byKeyset(query, {
		orderBy: [
			["created_at", "desc"],
			["client_id", "desc"],
		],
		cursor: parsed.cursor ?? null,
		limit: parsed.limit ?? DEFAULT_PAGE_SIZE,
	});

	if (isFailure(page)) {
		if (page.error instanceof InvalidCursorError) return { ok: false, reason: "bad-cursor" };
		throw page.error;
	}

	let summaries: GrantSummary[] = [];
	for (let row of page.data.items) {
		let client = await db.find(clients, { id: row.client_id });
		summaries.push({
			clientId: row.client_id,
			clientName: client?.name ?? row.client_id,
			scopes: row.scopes as string[],
			createdAt: row.created_at,
		});
	}

	return { ok: true, grants: summaries, cursors: page.data.cursors };
}
