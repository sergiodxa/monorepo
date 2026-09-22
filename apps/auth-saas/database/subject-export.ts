/**
 * One page of a tenant's directory as an export walks it: every subject's
 * identifiers, profile, declared attributes and role assignments, alongside
 * the credentials metadata a migration needs — that a password exists and
 * when it changed, each passkey's label and enrolment date, whether a second
 * factor is enrolled, and the ids of the subject's own live API keys. Kept
 * standalone from `subjects.ts` the way `subject-import.ts` is, because a row
 * here reads across several of that module's own tables plus `passwords.ts`,
 * `passkeys.ts`, `totp.ts` and `api-keys.ts` rather than writing to any of
 * them.
 *
 * A password hash is carried in the assembled row only when the caller passes
 * `includeCredentials: true`. Deciding when that is allowed is a caller
 * concern this module has no part in — it only ever does what the boolean it
 * was handed says.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetCursors } from "@sdxc/pagination";
import type { Database } from "remix/data-table";

import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { and, eq, gt, isNull } from "remix/data-table";

import type { AttributeValue, IdentifierState, SubjectProfile, SubjectRow } from "./subjects";

import { apiKeys } from "./api-keys";
import { listPasskeys } from "./passkeys";
import { passwords } from "./passwords";
import { describeSubjectAccess, TENANT_SCOPE } from "./roles";
import { profileOf, subjectAttributes, subjectIdentifiers, subjects } from "./subjects";
import { totpFactors } from "./totp";

/** Subjects handed back in one export page — heavier per row than a listing page, since every row reads several other tables. */
const DEFAULT_EXPORT_PAGE_SIZE = 100;

/** That a subject holds a password, and when it was last changed — the hash itself only when the caller asked for it. */
export interface ExportPasswordMetadata {
	exists: boolean;
	/** The row's own `created_at`: a new row is written on every password change, so its creation is the change. */
	changedAt: number | null;
	/** Present only when the page was read with `includeCredentials: true`. */
	hash?: string;
}

/** One passkey as an export row carries it — never its public key or any other credential material. */
export interface ExportPasskeySummary {
	label: string;
	enrolledAt: number;
}

/** Everything an export row carries about a subject's own credentials. */
export interface ExportCredentials {
	password: ExportPasswordMetadata;
	passkeys: ExportPasskeySummary[];
	secondFactorEnrolled: boolean;
	/** Ids of the subject's own API keys that are neither revoked nor expired. */
	apiKeyIds: string[];
}

/** One subject as an export page assembles it. */
export interface ExportSubjectRow {
	profile: SubjectProfile & { id: string; status: SubjectRow["status"] };
	identifiers: IdentifierState[];
	attributes: Record<string, AttributeValue>;
	/** Role keys this subject holds at the tenant scope. */
	roles: string[];
	credentials: ExportCredentials;
}

export interface ExportSubjectPageInput {
	cursor?: string | null;
	limit?: number;
	includeCredentials: boolean;
}

export type ExportSubjectPageResult =
	| { ok: true; subjects: ExportSubjectRow[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ExportSubjectPageSchema = s.object({
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
	includeCredentials: s.boolean(),
});

/**
 * A page of the tenant's subjects, newest first, each fully assembled for
 * export — identifiers, profile, attributes, role assignments and credentials
 * metadata — paging the same keyset way `listSubjects` already pages a
 * directory listing, with both ordering columns in the projection so the
 * cursor a page hands back is minted from the row that actually came back.
 *
 * @param db - The tenant's database.
 * @param input - Where to page from, how many subjects to a page, and whether
 * to carry each subject's own password hash alongside its metadata.
 * @returns A page of export rows and the cursors around it, or that the given
 * cursor no longer matches this ordering.
 */
export async function exportSubjectPage(
	db: Database,
	input: ExportSubjectPageInput,
): Promise<ExportSubjectPageResult> {
	let parsed = s.parse(ExportSubjectPageSchema, input);

	let page = await Pagination.byKeyset(db.query(subjects), {
		orderBy: [
			["created_at", "desc"],
			["id", "desc"],
		],
		cursor: parsed.cursor ?? null,
		limit: parsed.limit ?? DEFAULT_EXPORT_PAGE_SIZE,
	});

	if (isFailure(page)) {
		if (page.error instanceof InvalidCursorError) return { ok: false, reason: "bad-cursor" };
		throw page.error;
	}

	let rows: ExportSubjectRow[] = [];
	for (let row of page.data.items)
		rows.push(await assembleExportRow(db, row, parsed.includeCredentials));

	return { ok: true, subjects: rows, cursors: page.data.cursors };
}

/** Assembles one subject's full export row from every table its credentials and access live in. */
async function assembleExportRow(
	db: Database,
	subject: SubjectRow,
	includeCredentials: boolean,
): Promise<ExportSubjectRow> {
	let [identifierRows, attributeRows, access, credentials] = await Promise.all([
		db.findMany(subjectIdentifiers, { where: { subject_id: subject.id } }),
		db.findMany(subjectAttributes, { where: { subject_id: subject.id } }),
		describeSubjectAccess(db, { subjectId: subject.id, scope: TENANT_SCOPE }),
		assembleExportCredentials(db, subject.id, includeCredentials),
	]);

	return {
		profile: { id: subject.id, status: subject.status, ...profileOf(subject) },
		identifiers: identifierRows.map((row) => ({
			kind: row.kind,
			value: row.value,
			verified: row.verified_at !== null,
			verifiedAt: row.verified_at,
			isPrimary: row.is_primary,
		})),
		attributes: Object.fromEntries(
			attributeRows.map((row) => [row.key, row.value as AttributeValue]),
		),
		roles: access.roles.map((role) => role.key),
		credentials,
	};
}

/** Assembles one subject's credentials metadata: a password's existence and its own newest row's age, every enrolled passkey, whether a second factor is active, and live API key ids. */
async function assembleExportCredentials(
	db: Database,
	subjectId: string,
	includeCredentials: boolean,
): Promise<ExportCredentials> {
	let now = Date.now();

	let [passwordRow, { passkeys: passkeyRows }, totpFactor, liveApiKeys] = await Promise.all([
		db.findOne(passwords, {
			where: { subject_id: subjectId },
			orderBy: ["created_at", "desc"],
		}),
		listPasskeys(db, { subjectId }),
		db.find(totpFactors, { subject_id: subjectId }),
		db.findMany(apiKeys, {
			where: and(eq("subject_id", subjectId), isNull("revoked_at"), gt("expires_at", now)),
		}),
	]);

	return {
		password: passwordRow
			? {
					exists: true,
					changedAt: passwordRow.created_at,
					...(includeCredentials ? { hash: passwordRow.hash } : {}),
				}
			: { exists: false, changedAt: null },
		passkeys: passkeyRows.map((passkey) => ({
			label: passkey.label,
			enrolledAt: passkey.createdAt,
		})),
		secondFactorEnrolled: totpFactor !== null,
		apiKeyIds: liveApiKeys.map((key) => key.id),
	};
}
