/**
 * Password credentials: the `passwords`, `password_policy` and
 * `password_reset_tickets` tables, and the operations over them. A subject holds
 * several password rows and only the newest authenticates; the rest exist to be
 * derived against so a reuse is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { Hex, password, sha256 } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { and, column as c, eq, notInList, notNull, table } from "remix/data-table";

import type { OpenSessionResult } from "./sessions";
import type { Actor, IdentifierKind, SubjectIdentifierRow } from "./subjects";

import { openSession, revokeSubjectSessions } from "./sessions";
import { foldIdentifier } from "./subject-identifiers";
import { subjectIdentifiers, subjects } from "./subjects";

/** Mints an id for a `passwords` row. */
const passwordRowId = typeid("pw");

/** Mints an id for a `password_reset_tickets` row. */
const resetTicketRowId = typeid("pwrt");

/** The `password_policy` table holds one row; this is its fixed id. */
const POLICY_ROW_ID = "default";

/** `password_policy` defaults for a tenant that has never set one. */
const DEFAULT_MIN_LENGTH = 8;
const DEFAULT_HISTORY_DEPTH = 1;

/** How long a password reset ticket signs for an address before it expires. */
const RESET_TICKET_TTL_MS = 30 * 60 * 1000;

/**
 * The top 100,000 breached and common passwords, shipped as truncated SHA-256
 * prefixes in a sorted binary asset, is real data this checkout has no way to
 * acquire or fetch. This is a placeholder: a few dozen of the most obviously common
 * passwords, in plain text, standing in for that corpus until it exists. Replace the
 * list (and, ideally, the lookup with the ADR's sorted-prefix structure) rather than
 * treating this as the real deny-list.
 */
const PLACEHOLDER_COMMON_PASSWORDS = [
	"password",
	"123456",
	"12345678",
	"123456789",
	"1234567890",
	"qwerty",
	"qwertyuiop",
	"letmein",
	"iloveyou",
	"admin",
	"welcome",
	"monkey",
	"dragon",
	"football",
	"baseball",
	"abc123",
	"111111",
	"123123",
	"password1",
	"1234567",
	"sunshine",
	"master",
	"shadow",
	"superman",
	"trustno1",
	"hello",
	"666666",
	"123321",
	"mustang",
	"batman",
	"starwars",
	"1q2w3e4r",
	"whatever",
	"princess",
	"login",
	"passw0rd",
	"admin123",
	"charlie",
	"freedom",
	"jordan23",
];

/** Decoded lazily on first use, so a tenant that never sets a password pays nothing. */
let commonPasswordSet: Set<string> | null = null;

/** Whether a candidate password is one of the placeholder list's well-known values. */
function isPlaceholderCommonPassword(candidate: string): boolean {
	if (commonPasswordSet === null) {
		commonPasswordSet = new Set(PLACEHOLDER_COMMON_PASSWORDS);
	}

	return commonPasswordSet.has(candidate.normalize("NFKC").toLowerCase());
}

/** A subject's password credential: only the newest row authenticates. */
export const passwords = table({
	name: "passwords",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		subject_id: c.text(),
		hash: c.text(),
		created_at: c.integer(),
		expires_at: c.integer().nullable(),
		must_change: c.boolean().default(false),
	},
});

/** The tenant's one password policy row. */
export const passwordPolicy = table({
	name: "password_policy",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		min_length: c.integer().default(DEFAULT_MIN_LENGTH),
		denied_terms: c.json(),
		expiry_interval_ms: c.integer().nullable(),
		history_depth: c.integer().default(DEFAULT_HISTORY_DEPTH),
	},
});

/** A single-use, time-boxed ticket proving a password reset request for a subject. */
export const passwordResetTickets = table({
	name: "password_reset_tickets",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		subject_id: c.text(),
		ticket_hash: c.text(),
		expires_at: c.integer(),
		created_at: c.integer(),
	},
});

export type PasswordRow = TableRow<typeof passwords>;
export type PasswordPolicyRow = TableRow<typeof passwordPolicy>;

/** The policy a tenant enforces on every password it accepts. */
export interface PasswordPolicy {
	minLength: number;
	deniedTerms: string[];
	expiryIntervalMs: number | null;
	historyDepth: number;
}

/** Reads the policy row, creating the default one if a tenant somehow has none yet. */
async function getPolicy(db: Database): Promise<PasswordPolicyRow> {
	let existing = await db.find(passwordPolicy, { id: POLICY_ROW_ID });
	if (existing) return existing;

	return db.create(
		passwordPolicy,
		{
			id: POLICY_ROW_ID,
			min_length: DEFAULT_MIN_LENGTH,
			denied_terms: [],
			expiry_interval_ms: null,
			history_depth: DEFAULT_HISTORY_DEPTH,
		},
		{ returnRow: true },
	);
}

/**
 * Reads the tenant's password policy: the minimum length, denied terms, expiry
 * interval and history depth the hosted pages state before anyone types.
 *
 * @param db - The tenant's database.
 * @returns The policy currently in force.
 */
export async function describePasswordPolicy(db: Database): Promise<PasswordPolicy> {
	let policy = await getPolicy(db);

	return {
		minLength: policy.min_length,
		deniedTerms: policy.denied_terms as string[],
		expiryIntervalMs: policy.expiry_interval_ms,
		historyDepth: policy.history_depth,
	};
}

/** The email local part, domain label and folded username a candidate is checked against. */
function identifierFragments(rows: SubjectIdentifierRow[]): string[] {
	let fragments: string[] = [];

	for (let row of rows) {
		if (row.kind === "email") {
			let at = row.folded.indexOf("@");
			if (at <= 0) continue;

			fragments.push(row.folded.slice(0, at));

			let domain = row.folded.slice(at + 1);
			let label = domain.split(".")[0];
			if (label) fragments.push(label);
		} else {
			fragments.push(row.folded);
		}
	}

	// A fragment shorter than this matches almost anything, so it would refuse
	// passwords for a reason the person typing one could not connect to their address.
	return fragments.filter((fragment) => fragment.length >= 3);
}

/** Whether a candidate password contains, or is contained by, one of a subject's own identifiers. */
function isSimilarToIdentifier(candidate: string, fragments: string[]): boolean {
	let normalized = candidate.normalize("NFKC").toLowerCase();

	for (let fragment of fragments) {
		if (normalized.includes(fragment)) return true;
		if (fragment.includes(normalized) && normalized.length >= 3) return true;
	}

	return false;
}

/** The policy rejections {@link setPassword}, {@link changePassword} and reset completion share. */
export type PasswordPolicyFailure =
	| { ok: false; reason: "too-short"; minLength: number }
	| { ok: false; reason: "breached-or-common" }
	| { ok: false; reason: "similar-to-identifier" }
	| { ok: false; reason: "denied-term"; term: string }
	| { ok: false; reason: "reused" };

/** What writing a new password hands back once policy and reuse both clear. */
interface WrittenPassword {
	ok: true;
	passwordId: string;
	expiresAt: number | null;
}

/**
 * Enforces policy, refuses a reuse, and writes a subject's new password in one
 * operation: the derivations, the insert and the history trim never interleave with
 * another write to the same rows.
 *
 * @param db - The tenant's database.
 * @param input - The subject the password belongs to and the candidate itself.
 * @returns The new row's id and expiry, or which policy rule refused the candidate.
 */
async function writeNewPassword(
	db: Database,
	input: { subjectId: string; password: string },
): Promise<WrittenPassword | PasswordPolicyFailure> {
	let policy = await getPolicy(db);
	let candidate = input.password.normalize("NFKC");

	if (candidate.length < policy.min_length) {
		return { ok: false, reason: "too-short", minLength: policy.min_length };
	}

	if (isPlaceholderCommonPassword(candidate)) {
		return { ok: false, reason: "breached-or-common" };
	}

	let identifierRows = await db.findMany(subjectIdentifiers, {
		where: { subject_id: input.subjectId },
	});

	if (isSimilarToIdentifier(candidate, identifierFragments(identifierRows))) {
		return { ok: false, reason: "similar-to-identifier" };
	}

	let deniedTerms = (policy.denied_terms as string[]) ?? [];
	let normalizedCandidate = candidate.toLowerCase();

	for (let term of deniedTerms) {
		let normalizedTerm = term.normalize("NFKC").toLowerCase();
		if (normalizedTerm.length > 0 && normalizedCandidate.includes(normalizedTerm)) {
			return { ok: false, reason: "denied-term", term };
		}
	}

	let retained = await db.findMany(passwords, {
		where: { subject_id: input.subjectId },
		orderBy: ["created_at", "desc"],
	});

	for (let row of retained) {
		let matched = await password.verify(row.hash, candidate);
		if (isSuccess(matched) && matched.data) return { ok: false, reason: "reused" };
	}

	let hashed = await password.hash(candidate);
	if (isFailure(hashed)) throw new Error("password hashing failed");

	let now = Date.now();
	let expiresAt = policy.expiry_interval_ms === null ? null : now + policy.expiry_interval_ms;
	let id = passwordRowId(generateUUID()).toString();

	await db.create(passwords, {
		id,
		subject_id: input.subjectId,
		hash: hashed.data,
		created_at: now,
		expires_at: expiresAt,
		must_change: false,
	});

	let keptIds = [
		id,
		...retained.slice(0, Math.max(policy.history_depth - 1, 0)).map((row) => row.id),
	];

	await db.deleteMany(passwords, {
		where: and(eq("subject_id", input.subjectId), notInList("id", keptIds)),
	});

	return { ok: true, passwordId: id, expiresAt };
}

export interface SetPasswordInput {
	subjectId: string;
	password: string;
	actor: Actor;
}

export type SetPasswordResult =
	| { ok: true; passwordId: string; expiresAt: number | null }
	| { ok: false; reason: "not-found" }
	| PasswordPolicyFailure;

/**
 * Sets a subject's password: enforces policy, refuses a reuse against every row the
 * subject still holds, writes the new row with its expiry, and trims history to the
 * tenant's depth.
 *
 * @param db - The tenant's database.
 * @param input - The subject, the candidate password, and who is asking.
 * @returns The new row's id and expiry, or which policy rule refused the candidate.
 */
export async function setPassword(
	db: Database,
	input: SetPasswordInput,
): Promise<SetPasswordResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	return writeNewPassword(db, { subjectId: input.subjectId, password: input.password });
}

export interface ChangePasswordInput {
	subjectId: string;
	currentPassword: string;
	newPassword: string;
	/** The session performing the change, spared from the revocation a change triggers. */
	keepSessionId: string;
}

export type ChangePasswordResult =
	| { ok: true; passwordId: string; expiresAt: number | null }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "no-password" }
	| { ok: false; reason: "wrong-password" }
	| PasswordPolicyFailure;

/**
 * Verifies a subject's current password and writes a new one in its place, running
 * the same policy and reuse check every path that writes a password runs. Revokes
 * every other session the subject holds: the person changing it is present, and a
 * session they are not holding may be an attacker's.
 *
 * @param db - The tenant's database.
 * @param input - The subject, its current password, the replacement, and the session
 * performing the change.
 * @returns The new row's id and expiry, or why the change was refused.
 */
export async function changePassword(
	db: Database,
	input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	let newest = await db.findOne(passwords, {
		where: { subject_id: input.subjectId },
		orderBy: ["created_at", "desc"],
	});
	if (!newest) return { ok: false, reason: "no-password" };

	let verified = await password.verify(newest.hash, input.currentPassword);
	if (isFailure(verified) || !verified.data) return { ok: false, reason: "wrong-password" };

	let written = await writeNewPassword(db, {
		subjectId: input.subjectId,
		password: input.newPassword,
	});
	if (!written.ok) return written;

	await revokeSubjectSessions(db, {
		subjectId: input.subjectId,
		reason: "password_changed",
		exceptSessionId: input.keepSessionId,
	});

	return written;
}

export interface SignInWithPasswordInput {
	identifier: string;
	password: string;
	/** Whether the browser should keep the session past its own lifetime. */
	remembered: boolean;
	ip?: string | null;
	userAgent?: string | null;
	country?: string | null;
	region?: string | null;
	city?: string | null;
}

/** A verified sign-in and the session it opened in the same call. */
export type SignInWithPasswordResult =
	| ({
			ok: true;
			subjectId: string;
			secondFactorRequired: boolean;
			mustChangePassword: boolean;
	  } & OpenSessionResult)
	| { ok: false; reason: "invalid-credentials" }
	| { ok: false; reason: "password_expired" };

/** A stored hash derived once and cached, so a negative path pays the same CPU a real verify would. */
let dummyHashPromise: Promise<string> | null = null;

async function dummyHash(): Promise<string> {
	if (dummyHashPromise === null) {
		dummyHashPromise = password.hash("no-such-account-placeholder-password-0000").then((result) => {
			if (isFailure(result)) throw new Error("failed to derive the dummy sign-in hash");
			return result.data;
		});
	}

	return dummyHashPromise;
}

/** Derives a candidate against the fixed dummy hash, spending the CPU a real verify would. */
async function verifyAgainstDummy(candidate: string): Promise<void> {
	await password.verify(await dummyHash(), candidate);
}

/** An identifier with an `@` is checked as an email; anything else, as a username. */
function identifierKindOf(value: string): IdentifierKind {
	return value.includes("@") ? "email" : "username";
}

/**
 * Verifies a password sign-in and opens a session in the same call — a credential
 * checked in one call and a session opened in another is one operation split in half.
 *
 * An unknown identifier, a subject with no password, and a blocked subject all
 * derive the candidate against a fixed dummy hash before answering, the same
 * derivation a wrong password pays, so the time an answer takes says nothing about
 * which of those it was.
 *
 * @param db - The tenant's database.
 * @param input - The identifier as typed, the candidate password, whether to remember
 * the session past its own lifetime, and the request's origin.
 * @returns The subject and what it still owes, or why sign-in was refused.
 */
export async function signInWithPassword(
	db: Database,
	input: SignInWithPasswordInput,
): Promise<SignInWithPasswordResult> {
	let kind = identifierKindOf(input.identifier);
	let folded = foldIdentifier(kind, input.identifier);

	if (!folded.ok) {
		await verifyAgainstDummy(input.password);
		return { ok: false, reason: "invalid-credentials" };
	}

	let identifierRow = await db.findOne(subjectIdentifiers, {
		where: and(eq("kind", kind), eq("folded", folded.folded), notNull("verified_at")),
	});

	if (!identifierRow) {
		await verifyAgainstDummy(input.password);
		return { ok: false, reason: "invalid-credentials" };
	}

	let subject = await db.find(subjects, { id: identifierRow.subject_id });

	if (!subject || subject.status === "blocked") {
		await verifyAgainstDummy(input.password);
		return { ok: false, reason: "invalid-credentials" };
	}

	let newest = await db.findOne(passwords, {
		where: { subject_id: subject.id },
		orderBy: ["created_at", "desc"],
	});

	if (!newest) {
		await verifyAgainstDummy(input.password);
		return { ok: false, reason: "invalid-credentials" };
	}

	let verified = await password.verify(newest.hash, input.password);
	if (isFailure(verified) || !verified.data) return { ok: false, reason: "invalid-credentials" };

	if (password.needsRehash(newest.hash)) {
		let rehashed = await password.hash(input.password);
		if (isSuccess(rehashed)) await db.update(passwords, { id: newest.id }, { hash: rehashed.data });
	}

	if (newest.expires_at !== null && newest.expires_at <= Date.now()) {
		return { ok: false, reason: "password_expired" };
	}

	let session = await openSession(db, {
		subjectId: subject.id,
		amr: ["pwd"],
		remembered: input.remembered,
		ip: input.ip,
		userAgent: input.userAgent,
		country: input.country,
		region: input.region,
		city: input.city,
	});

	return {
		ok: true,
		subjectId: subject.id,
		// No second-factor mechanism exists yet; this is always false until one does.
		secondFactorRequired: false,
		mustChangePassword: newest.must_change,
		...session,
	};
}

export interface BeginPasswordResetInput {
	identifier: string;
}

/**
 * A ticket and an address to deliver it to. The shape is identical whether or not
 * the identifier resolved: `address` is `null` both when there is no such subject
 * and when the subject has no verified address to send to, and `ticket` is always a
 * freshly minted value — one that was persisted and can complete a reset, or one
 * that was not and cannot. A caller cannot tell which from the return value alone.
 */
export interface BeginPasswordResetResult {
	ok: true;
	ticket: string;
	address: string | null;
}

/**
 * Mints a password reset ticket for the address a subject signs in with, valid for
 * 30 minutes and single-use. Stores only the ticket's hash.
 *
 * @param db - The tenant's database.
 * @param input - The identifier as typed.
 * @returns The plaintext ticket to deliver, and the address to deliver it to.
 */
export async function beginPasswordReset(
	db: Database,
	input: BeginPasswordResetInput,
): Promise<BeginPasswordResetResult> {
	let ticket = generateUUID();
	let kind = identifierKindOf(input.identifier);
	let folded = foldIdentifier(kind, input.identifier);

	let subjectId: string | null = null;
	let address: string | null = null;

	if (folded.ok) {
		let identifierRow = await db.findOne(subjectIdentifiers, {
			where: and(eq("kind", kind), eq("folded", folded.folded), notNull("verified_at")),
		});

		if (identifierRow) {
			subjectId = identifierRow.subject_id;

			if (identifierRow.kind === "email") {
				address = identifierRow.value;
			} else {
				let primaryEmail = await db.findOne(subjectIdentifiers, {
					where: and(
						eq("subject_id", identifierRow.subject_id),
						eq("kind", "email"),
						eq("is_primary", true),
					),
				});
				address = primaryEmail?.value ?? null;
			}
		}
	}

	if (subjectId !== null && address !== null) {
		let hashed = await sha256(ticket);

		if (isSuccess(hashed)) {
			let now = Date.now();

			await db.create(passwordResetTickets, {
				id: resetTicketRowId(generateUUID()).toString(),
				subject_id: subjectId,
				ticket_hash: Hex.encode(hashed.data),
				expires_at: now + RESET_TICKET_TTL_MS,
				created_at: now,
			});
		}
	}

	return { ok: true, ticket, address };
}

export interface CompletePasswordResetInput {
	ticket: string;
	newPassword: string;
}

export type CompletePasswordResetResult =
	| { ok: true; subjectId: string; passwordId: string }
	| { ok: false; reason: "invalid-ticket" }
	| PasswordPolicyFailure;

/**
 * Spends a password reset ticket, writes the new password it authorized, and revokes
 * every session the subject holds — a reset is what someone locked out does, and the
 * browser completing it may not be theirs.
 *
 * The ticket is deleted the moment its row is found, before its expiry or the new
 * password's policy is checked, so a ticket is spent by one attempt regardless of
 * whether that attempt's new password is accepted — a second attempt with the same
 * ticket always finds nothing to spend.
 *
 * Marking the resolved address verified is `subjects.ts`'s data to write and it
 * exposes no write path for it today; this returns the subject so a caller with one
 * can, but does not attempt it here.
 *
 * @param db - The tenant's database.
 * @param input - The ticket as delivered, and the new password it authorizes.
 * @returns The subject and the new row's id, or why the reset was refused.
 */
export async function completePasswordReset(
	db: Database,
	input: CompletePasswordResetInput,
): Promise<CompletePasswordResetResult> {
	let hashed = await sha256(input.ticket);
	if (isFailure(hashed)) return { ok: false, reason: "invalid-ticket" };

	let ticketHash = Hex.encode(hashed.data);

	let row = await db.findOne(passwordResetTickets, { where: { ticket_hash: ticketHash } });
	if (!row) return { ok: false, reason: "invalid-ticket" };

	await db.delete(passwordResetTickets, { id: row.id });

	if (row.expires_at <= Date.now()) return { ok: false, reason: "invalid-ticket" };

	let written = await writeNewPassword(db, {
		subjectId: row.subject_id,
		password: input.newPassword,
	});
	if (!written.ok) return written;

	await revokeSubjectSessions(db, { subjectId: row.subject_id, reason: "password_reset" });

	return { ok: true, subjectId: row.subject_id, passwordId: written.passwordId };
}

export interface ForcePasswordResetInput {
	subjectId: string;
	reason: string;
}

export type ForcePasswordResetResult =
	| { ok: true; passwordId: string; reason: string }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "no-password" };

/**
 * Marks a subject's current password as owing a change, for a targeted response to
 * a suspected compromise, and revokes every session the subject holds.
 *
 * @param db - The tenant's database.
 * @param input - The subject, and why the reset is being forced.
 * @returns The row now marked, and the reason recorded, or why nothing was marked.
 */
export async function forcePasswordReset(
	db: Database,
	input: ForcePasswordResetInput,
): Promise<ForcePasswordResetResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	let newest = await db.findOne(passwords, {
		where: { subject_id: input.subjectId },
		orderBy: ["created_at", "desc"],
	});
	if (!newest) return { ok: false, reason: "no-password" };

	await db.update(passwords, { id: newest.id }, { must_change: true });
	await revokeSubjectSessions(db, { subjectId: input.subjectId, reason: input.reason });

	return { ok: true, passwordId: newest.id, reason: input.reason };
}

export interface RemovePasswordInput {
	subjectId: string;
}

export type RemovePasswordResult =
	| { ok: true }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "no-password" }
	| { ok: false; reason: "last-credential" };

/**
 * Whether a subject would keep a way to sign in after every password row is gone,
 * counting only a verified identifier — the one other credential this module can
 * read without writing to a table it does not own. The fallback this module runs on
 * its own when a caller has not computed the fuller cross-credential answer.
 */
async function hasOtherReadableCredential(db: Database, subjectId: string): Promise<boolean> {
	let count = await db.count(subjectIdentifiers, {
		where: and(eq("subject_id", subjectId), notNull("verified_at")),
	});

	return count > 0;
}

/**
 * Removes every password row for a subject, refusing when it would leave the account
 * with no remaining credential.
 *
 * @param db - The tenant's database.
 * @param input - The subject to remove the password from.
 * @param hasOtherCredential - Whether the subject holds a credential besides its
 * password — a verified identifier or a passkey. Computed here from identifiers alone
 * when omitted; a caller that also knows about passkeys passes the fuller answer.
 * @returns Success, or why the removal was refused.
 */
export async function removePassword(
	db: Database,
	input: RemovePasswordInput,
	hasOtherCredential?: boolean,
): Promise<RemovePasswordResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	let count = await db.count(passwords, { where: { subject_id: input.subjectId } });
	if (count === 0) return { ok: false, reason: "no-password" };

	let remaining = hasOtherCredential ?? (await hasOtherReadableCredential(db, input.subjectId));
	if (!remaining) return { ok: false, reason: "last-credential" };

	await db.deleteMany(passwords, { where: { subject_id: input.subjectId } });

	return { ok: true };
}
