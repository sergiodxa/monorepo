/**
 * One row of a tenant's directory arriving from elsewhere: validates it against every
 * rule a write would enforce without writing anything, or applies it. Kept standalone
 * from `subjects.ts` because a row bundles several of that module's own writes —
 * `createSubject`, a password hash, a set of role assignments — into the one outcome an
 * import report renders one line from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { password } from "@sdxc/crypto";
import { generateUUID } from "@sdxc/uuid/v4";
import * as s from "remix/data-schema";
import { and, eq } from "remix/data-table";

import type { AssignRoleResult } from "./roles";
import type { CreateSubjectResult, IdentifierKind, SubjectProfile } from "./subjects";

import { writeAuditEvent } from "./audit-events";
import { importPasswordHash } from "./passwords";
import { assignRole, resolveRole } from "./roles";
import { foldIdentifier } from "./subject-identifiers";
import { attributeDefinitions, createSubject, mintSubjectId, subjectIdentifiers } from "./subjects";

/** The audit actor for a call with no operator identity threaded through today. */
const PLATFORM_ACTOR = { type: "platform", id: "system" } as const;

/** One subject as a directory export from elsewhere describes it. */
export interface ImportSubjectRow {
	/** The exporting system's own id for this row, echoed back on a failure so a customer can match it to their file. */
	externalId?: string;
	identifiers?: { kind: IdentifierKind; value: string; verified?: boolean }[];
	profile?: SubjectProfile;
	attributes?: Record<string, unknown>;
	roles?: { scope: string; roleKey: string }[];
	/** A password hash, not a plaintext — refused when the `password` module does not recognize it as its own. */
	password?: string;
}

let IdentifierRowSchema = s.object({
	kind: s.enum_(["email", "username"] as const),
	value: s.string(),
	verified: s.optional(s.boolean()),
});

let RoleRowSchema = s.object({
	scope: s.string(),
	roleKey: s.string(),
});

let ProfileRowSchema = s.object({
	name: s.optional(s.nullable(s.string())),
	givenName: s.optional(s.nullable(s.string())),
	familyName: s.optional(s.nullable(s.string())),
	nickname: s.optional(s.nullable(s.string())),
	preferredUsername: s.optional(s.nullable(s.string())),
	picture: s.optional(s.nullable(s.string())),
	locale: s.optional(s.nullable(s.string())),
	zoneinfo: s.optional(s.nullable(s.string())),
});

let ImportSubjectRowSchema = s.object({
	externalId: s.optional(s.string()),
	identifiers: s.optional(s.array(IdentifierRowSchema)),
	profile: s.optional(ProfileRowSchema),
	attributes: s.optional(s.record(s.string(), s.any())),
	roles: s.optional(s.array(RoleRowSchema)),
	password: s.optional(s.string()),
});

/** What went wrong with one field of an import row, named the way this module's own writers refuse a field. */
export type ImportRowProblem =
	| {
			kind: "identifier";
			reason: "invalid" | "taken";
			identifierKind: IdentifierKind;
			value: string;
	  }
	| { kind: "identifier"; reason: "duplicate-username" }
	| { kind: "attribute"; key: string; reason: "unknown" }
	| {
			kind: "role";
			scope: string;
			roleKey: string;
			reason:
				| "not-found"
				| "subject-not-found"
				| "organization-not-found"
				| "not-member"
				| "last-owner";
	  }
	| { kind: "password"; reason: "unrecognized-hash" | "subject-not-found" }
	/** A line the batching job could not even parse as JSON, so it never reached a row check. */
	| { kind: "row"; reason: "invalid-json" };

/** What validating or applying one import row reports. */
export type ImportRowOutcome =
	| { ok: true; subjectId: string; externalId?: string }
	| { ok: false; externalId?: string; problems: ImportRowProblem[] };

/**
 * Runs every check a write would enforce, against one row, with nothing written: folds
 * and checks each identifier against the tenant's existing directory and against the
 * rest of the row, checks each declared attribute key is defined, checks each declared
 * role resolves at its scope, and checks a declared password hash is one the platform
 * recognizes. Every problem found is collected rather than stopping at the first, since
 * this is the dry run a customer runs to fix everything a file has wrong in one pass.
 *
 * @param db - The tenant's database.
 * @param row - The row to check.
 * @returns A preview subject id and the row's external id on a clean row, or every
 * problem the row would be refused for. The preview id is minted the same way
 * {@link createSubject}'s own id would be, but never written — applying the row mints an
 * independent one.
 */
export async function validateImportRow(
	db: Database,
	row: ImportSubjectRow,
): Promise<ImportRowOutcome> {
	let parsed = s.parse(ImportSubjectRowSchema, row);
	let problems: ImportRowProblem[] = [];

	let identifiers = parsed.identifiers ?? [];

	if (identifiers.filter((identifier) => identifier.kind === "username").length > 1) {
		problems.push({ kind: "identifier", reason: "duplicate-username" });
	}

	let seenFolded = new Set<string>();

	for (let identifier of identifiers) {
		let folded = foldIdentifier(identifier.kind, identifier.value);

		if (!folded.ok) {
			problems.push({
				kind: "identifier",
				reason: "invalid",
				identifierKind: identifier.kind,
				value: identifier.value,
			});
			continue;
		}

		let key = `${identifier.kind}:${folded.folded}`;

		if (seenFolded.has(key)) {
			problems.push({
				kind: "identifier",
				reason: "taken",
				identifierKind: identifier.kind,
				value: identifier.value,
			});
			continue;
		}

		seenFolded.add(key);

		let existing = await db.findOne(subjectIdentifiers, {
			where: and(eq("kind", identifier.kind), eq("folded", folded.folded)),
		});

		if (existing) {
			problems.push({
				kind: "identifier",
				reason: "taken",
				identifierKind: identifier.kind,
				value: identifier.value,
			});
		}
	}

	let attributes = parsed.attributes ?? {};

	for (let key of Object.keys(attributes)) {
		let definition = await db.find(attributeDefinitions, { key });
		if (!definition) problems.push({ kind: "attribute", key, reason: "unknown" });
	}

	for (let role of parsed.roles ?? []) {
		let resolved = await resolveRole(db, { scope: role.scope, roleKey: role.roleKey });
		if (!resolved) {
			problems.push({
				kind: "role",
				scope: role.scope,
				roleKey: role.roleKey,
				reason: "not-found",
			});
		}
	}

	if (parsed.password && !password.recognizes(parsed.password)) {
		problems.push({ kind: "password", reason: "unrecognized-hash" });
	}

	if (problems.length > 0) return { ok: false, externalId: parsed.externalId, problems };

	return {
		ok: true,
		subjectId: mintSubjectId(generateUUID()).toString(),
		externalId: parsed.externalId,
	};
}

/**
 * Writes one import row: creates the subject with its identifiers written verified
 * exactly where the row marked them so, imports its password hash when one came, and
 * assigns its declared roles. A step after the subject is created that fails — an
 * unrecognized hash, a role that does not resolve — is not rolled back: the subject and
 * whatever earlier step already succeeded stay written, and the outcome names the step
 * that failed. A file with a partial problem is exactly the case a customer fixes and
 * resubmits rather than starting the whole row over, so the row is left as far along as
 * it honestly got.
 *
 * @param db - The tenant's database.
 * @param row - The row to write.
 * @returns The new subject's id and the row's external id once every declared step
 * succeeds, or the problem that stopped the row and the external id to match it back to
 * the file.
 */
export async function applyImportRow(
	db: Database,
	row: ImportSubjectRow,
): Promise<ImportRowOutcome> {
	let parsed = s.parse(ImportSubjectRowSchema, row);
	let now = Date.now();

	let created = await createSubject(db, {
		identifiers: (parsed.identifiers ?? []).map((identifier) => ({
			kind: identifier.kind,
			value: identifier.value,
			verifiedAt: identifier.verified ? now : undefined,
		})),
		profile: parsed.profile,
		attributes: parsed.attributes,
	});

	if (!created.ok) {
		return {
			ok: false,
			externalId: parsed.externalId,
			problems: [problemFromCreateSubjectFailure(created)],
		};
	}

	if (parsed.password) {
		let imported = await importPasswordHash(db, {
			subjectId: created.subjectId,
			hash: parsed.password,
			mustChange: false,
		});

		if (!imported.ok) {
			return {
				ok: false,
				externalId: parsed.externalId,
				problems: [
					{
						kind: "password",
						reason: imported.reason === "not-found" ? "subject-not-found" : "unrecognized-hash",
					},
				],
			};
		}
	}

	for (let role of parsed.roles ?? []) {
		let assigned = await assignRole(db, {
			subjectId: created.subjectId,
			scope: role.scope,
			roleKey: role.roleKey,
			actor: PLATFORM_ACTOR,
			at: now,
		});

		if (!assigned.ok) {
			return {
				ok: false,
				externalId: parsed.externalId,
				problems: [problemFromAssignRoleFailure(role, assigned)],
			};
		}
	}

	return { ok: true, subjectId: created.subjectId, externalId: parsed.externalId };
}

/** Maps {@link createSubject}'s own refusal shape onto this module's problem shape. */
function problemFromCreateSubjectFailure(
	result: Exclude<CreateSubjectResult, { ok: true }>,
): ImportRowProblem {
	if (result.reason === "invalid-identifier") {
		return {
			kind: "identifier",
			reason: "invalid",
			identifierKind: result.kind,
			value: result.value,
		};
	}

	if (result.reason === "identifier-taken") {
		return {
			kind: "identifier",
			reason: "taken",
			identifierKind: result.kind,
			value: result.value,
		};
	}

	if (result.reason === "duplicate-username") {
		return { kind: "identifier", reason: "duplicate-username" };
	}

	return { kind: "attribute", key: result.key, reason: "unknown" };
}

/** Maps {@link assignRole}'s own refusal shape onto this module's problem shape. */
function problemFromAssignRoleFailure(
	role: { scope: string; roleKey: string },
	result: Exclude<AssignRoleResult, { ok: true }>,
): ImportRowProblem {
	if (result.reason === "role-not-found") {
		return { kind: "role", scope: role.scope, roleKey: role.roleKey, reason: "not-found" };
	}

	return { kind: "role", scope: role.scope, roleKey: role.roleKey, reason: result.reason };
}

export interface CompleteImportRunInput {
	processed: number;
	created: number;
	failed: number;
}

/**
 * Writes one summary audit row for a finished import run. The run's own id, its
 * source file and its report live in the control plane, so what lands here is the
 * totals alone — the one fact only this object can attest to.
 *
 * @param db - The tenant's database.
 * @param input - How many rows the run processed, how many subjects it created, and
 * how many rows failed.
 * @returns Success, once the row is written.
 */
export async function completeImportRun(
	db: Database,
	input: CompleteImportRunInput,
): Promise<{ ok: true }> {
	await writeAuditEvent(db, {
		action: "subjects.imported",
		actor: PLATFORM_ACTOR,
		targetType: "import",
		targetId: "subjects",
		outcome: "succeeded",
		detail: { processed: input.processed, created: input.created, failed: input.failed },
	});

	return { ok: true };
}
