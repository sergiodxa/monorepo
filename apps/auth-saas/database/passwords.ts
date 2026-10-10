/**
 * Password credentials: the `passwords`, `password_policy` and
 * `password_reset_tickets` tables, and the operations over them. A subject holds
 * several password rows and only the newest authenticates; the rest exist to be
 * derived against so a reuse is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PasswordPolicyError } from "@sdxc/password-policy";
import type { Database, TableRow } from "remix/data-table";

import { Hex, password, sha256 } from "@sdxc/crypto";
import { currentLog } from "@sdxc/logger";
import { checkPassword } from "@sdxc/password-policy";
import { checkPasswordHistory } from "@sdxc/password-policy/history";
import { isFailure, isSuccess } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";
import { and, column as c, eq, notInList, notNull, table } from "remix/data-table";

import type { AuditAction, AuditActor } from "./audit-events";
import type { AppliedDomainMembership, SuggestedOrganization } from "./organizations";
import type { EffectiveSessionPolicy, SessionsAfterCredentialChange } from "./session-policy";
import type { OpenSessionMetering, OpenSessionSuccess } from "./sessions";
import type { Actor, IdentifierKind } from "./subjects";

import { writeAuditEvent } from "./audit-events";
import {
	clearedBackoff,
	DEFAULT_FAILURE_THRESHOLD,
	nextFailureState,
} from "./authentication-backoff";
import { checkAndSpendMailEnvelope } from "./mail-rate-limit";
import { applyDomainMembership } from "./organizations";
import { SESSIONS_AFTER_CREDENTIAL_CHANGE_DEFAULT } from "./session-policy";
import { openSession, revokeSubjectSessions } from "./sessions";
import { foldIdentifier } from "./subject-identifiers";
import { subjectIdentifiers, subjects } from "./subjects";
import { isTrustedDevice, totpFactors } from "./totp";

/** The audit actor for a call with no operator identity threaded through today. */
const PLATFORM_ACTOR = { type: "platform", id: "system" } as const;

/** Maps this module's own `subject`/`admin` actor onto the audit log's actor shape. */
function auditActorFor(
	actor: Actor,
	subjectId: string,
): { type: "subject" | "platform"; id: string } {
	return actor.kind === "subject" ? { type: "subject", id: subjectId } : PLATFORM_ACTOR;
}

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
		failed_attempts: c.integer().default(0),
		retry_after: c.integer().nullable(),
		last_failure_at: c.integer().nullable(),
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

/**
 * The policy rejections {@link setPassword}, {@link changePassword} and reset completion
 * share: the refusal's `reason` and the values its message needs, as a plain object that
 * crosses the Durable Object boundary.
 */
export type PasswordPolicyFailure = { ok: false } & PasswordPolicyError.Issue;

/** The remote checks a password write runs besides the local rules. */
export interface PasswordWriteOptions {
	/**
	 * Whether to ask Have I Been Pwned about the candidate once every local rule passed; an
	 * unreachable API lets the password through.
	 *
	 * @default false
	 */
	breachCheck?: boolean;
}

/** Identifies this platform to the Pwned Passwords API, which asks every client to name itself. */
const BREACH_CHECK_USER_AGENT = "auth-saas";

/**
 * The one form of a password that is ever hashed or verified: its NFKC normalization, which is
 * also what every policy rule compares, so a password typed with full-width letters or a ligature
 * signs in exactly as it was set. Every stored hash is of this form.
 *
 * @param typed - The password as the person typed it.
 * @returns The string handed to `password.hash` and `password.verify`.
 */
function hashedForm(typed: string): string {
	return typed.normalize("NFKC");
}

/** What writing a new password hands back once policy and reuse both clear. */
interface WrittenPassword {
	ok: true;
	passwordId: string;
	expiresAt: number | null;
}

/**
 * Enforces policy, refuses a reuse, and writes a subject's new password in one operation.
 * Every rule and the reuse check run on {@link hashedForm}, the form that is hashed. A stored hash
 * that cannot be verified lets the write through, logged, so a damaged row never locks a
 * subject out of reset; a match against any other row still refuses.
 *
 * @param db - The tenant's database.
 * @param input - The subject the password belongs to and the candidate itself.
 * @param options - Whether the breached-password lookup runs.
 * @returns The new row's id and expiry, or which policy rule refused the candidate.
 */
async function writeNewPassword(
	db: Database,
	input: { subjectId: string; password: string },
	options: PasswordWriteOptions,
): Promise<WrittenPassword | PasswordPolicyFailure> {
	let policy = await getPolicy(db);
	let candidate = hashedForm(input.password);

	let identifierRows = await db.findMany(subjectIdentifiers, {
		where: { subject_id: input.subjectId },
	});

	let accepted = await checkPassword(candidate, {
		minLength: policy.min_length,
		deniedTerms: (policy.denied_terms as string[]) ?? [],
		identifiers: identifierRows.map((row) => row.folded),
		breached: options.breachCheck ? { userAgent: BREACH_CHECK_USER_AGENT } : false,
	});
	if (isFailure(accepted) && accepted.error.issue.reason !== "breach-check-unavailable") {
		return { ok: false, ...accepted.error.issue };
	}

	let retained = await db.findMany(passwords, {
		where: { subject_id: input.subjectId },
		orderBy: ["created_at", "desc"],
	});

	let history = await checkPasswordHistory(
		candidate,
		retained.map((row) => row.hash),
		{ maxHistory: retained.length },
	);
	if (isFailure(history)) {
		let { issue } = history.error;
		if (issue.reason !== "history-check-unavailable") return { ok: false, ...issue };

		currentLog()?.warn("password.history_check_unavailable", {
			subjectId: input.subjectId,
			passwordId: retained[issue.index]?.id,
		});
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

export type ImportPasswordHashResult =
	| { ok: true; passwordId: string }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unrecognized-hash" };

/**
 * Writes an already-hashed password directly to a subject's row, for a
 * directory arriving from elsewhere with a hash this platform's own format
 * already covers. No plaintext is ever seen on this path, so none of
 * {@link writeNewPassword}'s policy checks — length, common-password,
 * similar-to-identifier — apply; those are about a person choosing a
 * plaintext, and an imported hash is neither chosen here nor rehashable to
 * check against.
 *
 * The one check this path keeps is recognition: the hash must be one
 * `password.recognizes` accepts as this platform's own format, so a value
 * imported this way verifies at the subject's next sign-in exactly like any
 * other stored hash, and upgrades itself the same way if it trails current
 * policy.
 *
 * @param db - The tenant's database.
 * @param input - The subject the hash belongs to, the hash itself, and
 * whether the subject must change it at next sign-in.
 * @returns The new row's id, or why the import was refused.
 */
export async function importPasswordHash(
	db: Database,
	input: { subjectId: string; hash: string; mustChange?: boolean },
): Promise<ImportPasswordHashResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	if (!password.recognizes(input.hash)) return { ok: false, reason: "unrecognized-hash" };

	let id = passwordRowId(generateUUID()).toString();

	await db.create(passwords, {
		id,
		subject_id: input.subjectId,
		hash: input.hash,
		created_at: Date.now(),
		expires_at: null,
		must_change: input.mustChange ?? false,
	});

	await writeAuditEvent(db, {
		action: "password.changed",
		actor: PLATFORM_ACTOR,
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { via: "import" },
	});

	return { ok: true, passwordId: id };
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
 * @param options - Whether the breached-password lookup runs.
 * @returns The new row's id and expiry, or which policy rule refused the candidate.
 */
export async function setPassword(
	db: Database,
	input: SetPasswordInput,
	options: PasswordWriteOptions = {},
): Promise<SetPasswordResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	let written = await writeNewPassword(
		db,
		{ subjectId: input.subjectId, password: input.password },
		options,
	);
	if (!written.ok) return written;

	await writeAuditEvent(db, {
		action: "password.changed",
		actor: auditActorFor(input.actor, input.subjectId),
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { via: "set" },
	});

	return written;
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
 * the same policy and reuse check every path that writes a password runs. Revokes the
 * subject's other sessions per the tenant's own policy: `revoke-others` spares the
 * session performing the change, the way this has always worked; `revoke-all` ends it
 * too, because the person changing it is present to sign in again.
 *
 * @param db - The tenant's database.
 * @param input - The subject, its current password, the replacement, and the session
 * performing the change.
 * @param sessionsAfterCredentialChange - The tenant's own effective policy for what a
 * credential change does to a subject's other sessions; omitted, `revoke-others`, the
 * behavior this function has always had.
 * @param options - Whether the breached-password lookup runs.
 * @returns The new row's id and expiry, or why the change was refused.
 */
export async function changePassword(
	db: Database,
	input: ChangePasswordInput,
	sessionsAfterCredentialChange: SessionsAfterCredentialChange = SESSIONS_AFTER_CREDENTIAL_CHANGE_DEFAULT,
	options: PasswordWriteOptions = {},
): Promise<ChangePasswordResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	let newest = await db.findOne(passwords, {
		where: { subject_id: input.subjectId },
		orderBy: ["created_at", "desc"],
	});
	if (!newest) return { ok: false, reason: "no-password" };

	let verified = await password.verify(newest.hash, hashedForm(input.currentPassword));
	if (isFailure(verified) || !verified.data) return { ok: false, reason: "wrong-password" };

	let written = await writeNewPassword(
		db,
		{ subjectId: input.subjectId, password: input.newPassword },
		options,
	);
	if (!written.ok) return written;

	await revokeSubjectSessions(db, {
		subjectId: input.subjectId,
		reason: "password_changed",
		...(sessionsAfterCredentialChange === "revoke-others"
			? { exceptSessionId: input.keepSessionId }
			: {}),
	});

	await writeAuditEvent(db, {
		action: "password.changed",
		actor: { type: "subject", id: input.subjectId },
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { via: "change" },
	});

	return written;
}

export interface SignInWithPasswordInput {
	identifier: string;
	password: string;
	/** Whether the browser should keep the session past its own lifetime. */
	remembered: boolean;
	/** A trusted-device token this browser is carrying, if any, checked against the signed-in subject's own remembered devices. */
	trustedDeviceToken?: string | null;
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
			/** Set instead of demanding a code when the subject has no factor left to prove — an administrator reset — so the hosted screen offers enrolment rather than asking for one that no longer exists. */
			mustEnrolFactor: boolean;
			mustChangePassword: boolean;
			/** Present only when the call opted into domain membership resolution: the memberships it wrote. */
			organizationMemberships?: AppliedDomainMembership[];
			/** Present only when the call opted into domain membership resolution: the organizations it only suggests. */
			suggestedOrganizations?: SuggestedOrganization[];
	  } & OpenSessionSuccess)
	| {
			ok: false;
			reason: "invalid-credentials";
			/** Present only while a backoff window is active, echoing the epoch-ms timestamp it lifts at. */
			retryAfter?: number;
	  }
	| { ok: false; reason: "password_expired" }
	| { ok: false; reason: "dau_cap_reached" };

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
	await password.verify(await dummyHash(), hashedForm(candidate));
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
 * @param metering - The daily active user meter to record this sign-in against, when
 * the caller has one; omitted, no meter is touched and no sign-in is ever refused for it.
 * @param mfaPolicy - The tenant's own MFA policy; omitted, a subject with no factor is
 * never routed to enrol one before this call reports success, the same as every
 * existing caller that does not read the policy at all.
 * @param resolveOrganizationMemberships - Whether to run {@link applyDomainMembership}
 * against the signed-in subject once the session opens; omitted, no domain is ever
 * read and neither result field is ever set, the same as every existing caller.
 * @param failureThreshold - How many consecutive failures the tenant tolerates before
 * a backoff window opens; omitted, the same default every unconfigured tenant enforces.
 * @param sessionPolicy - The tenant's own effective session policy the opened session
 * is bound by; omitted, the platform defaults.
 * @returns The subject and what it still owes, or why sign-in was refused.
 */
export async function signInWithPassword(
	db: Database,
	input: SignInWithPasswordInput,
	metering?: OpenSessionMetering,
	mfaPolicy: "optional" | "required" = "optional",
	resolveOrganizationMemberships = false,
	failureThreshold: number = DEFAULT_FAILURE_THRESHOLD,
	sessionPolicy?: EffectiveSessionPolicy,
): Promise<SignInWithPasswordResult> {
	let context = { ip: input.ip ?? null, userAgent: input.userAgent ?? null };

	/** Writes the one authentication row this attempt earns, whoever it named. */
	function auditAuthentication(
		outcome: "failed" | "denied" | "succeeded",
		subjectId: string,
	): Promise<void> {
		let action: AuditAction =
			outcome === "succeeded"
				? "authentication.succeeded"
				: outcome === "denied"
					? "authentication.denied"
					: "authentication.failed";

		return writeAuditEvent(db, {
			action,
			actor: { type: "subject", id: subjectId },
			targetType: "subject",
			targetId: subjectId,
			outcome,
			context,
			detail: { method: "password" },
		});
	}

	let kind = identifierKindOf(input.identifier);
	let folded = foldIdentifier(kind, input.identifier);

	if (!folded.ok) {
		await verifyAgainstDummy(input.password);
		await auditAuthentication("failed", input.identifier);
		return { ok: false, reason: "invalid-credentials" };
	}

	let identifierRow = await db.findOne(subjectIdentifiers, {
		where: and(eq("kind", kind), eq("folded", folded.folded), notNull("verified_at")),
	});

	if (!identifierRow) {
		await verifyAgainstDummy(input.password);
		await auditAuthentication("failed", input.identifier);
		return { ok: false, reason: "invalid-credentials" };
	}

	let subject = await db.find(subjects, { id: identifierRow.subject_id });

	if (!subject) {
		await verifyAgainstDummy(input.password);
		await auditAuthentication("failed", identifierRow.subject_id);
		return { ok: false, reason: "invalid-credentials" };
	}

	if (subject.status === "blocked") {
		await verifyAgainstDummy(input.password);
		await auditAuthentication("denied", subject.id);
		return { ok: false, reason: "invalid-credentials" };
	}

	let newest = await db.findOne(passwords, {
		where: { subject_id: subject.id },
		orderBy: ["created_at", "desc"],
	});

	if (!newest) {
		await verifyAgainstDummy(input.password);
		await auditAuthentication("failed", subject.id);
		return { ok: false, reason: "invalid-credentials" };
	}

	let now = Date.now();

	if (newest.retry_after !== null && newest.retry_after > now) {
		await verifyAgainstDummy(input.password);
		await auditAuthentication("failed", subject.id);
		return { ok: false, reason: "invalid-credentials", retryAfter: newest.retry_after };
	}

	let verified = await password.verify(newest.hash, hashedForm(input.password));
	if (isFailure(verified) || !verified.data) {
		let failure = nextFailureState(newest, failureThreshold, now);
		await db.update(passwords, { id: newest.id }, failure);
		await auditAuthentication("failed", subject.id);
		return {
			ok: false,
			reason: "invalid-credentials",
			...(failure.retry_after !== null ? { retryAfter: failure.retry_after } : {}),
		};
	}

	let clearedState: Partial<PasswordRow> = clearedBackoff();

	if (password.needsRehash(newest.hash)) {
		let rehashed = await password.hash(hashedForm(input.password));
		if (isSuccess(rehashed)) clearedState.hash = rehashed.data;
	}

	await db.update(passwords, { id: newest.id }, clearedState);

	if (newest.expires_at !== null && newest.expires_at <= Date.now()) {
		await auditAuthentication("denied", subject.id);
		return { ok: false, reason: "password_expired" };
	}

	let session = await openSession(
		db,
		{
			subjectId: subject.id,
			amr: ["pwd"],
			remembered: input.remembered,
			ip: input.ip,
			userAgent: input.userAgent,
			country: input.country,
			region: input.region,
			city: input.city,
		},
		metering,
		sessionPolicy,
	);

	if (!session.ok) {
		await auditAuthentication("denied", subject.id);
		return { ok: false, reason: session.reason };
	}

	await auditAuthentication("succeeded", subject.id);

	let mustEnrolFactor = subject.mfa_reset_required === true;

	let factor = mustEnrolFactor ? null : await db.find(totpFactors, { subject_id: subject.id });
	let policyDemandsEnrolment = !mustEnrolFactor && mfaPolicy === "required" && factor === null;

	let trustedDevice =
		factor !== null && input.trustedDeviceToken
			? await isTrustedDevice(db, subject.id, input.trustedDeviceToken)
			: false;

	let secondFactorRequired =
		mustEnrolFactor || policyDemandsEnrolment || (factor !== null && !trustedDevice);

	let organizationMemberships: AppliedDomainMembership[] | undefined;
	let suggestedOrganizations: SuggestedOrganization[] | undefined;

	if (resolveOrganizationMemberships) {
		let resolved = await applyDomainMembership(db, { subjectId: subject.id });
		organizationMemberships = resolved.joined;
		suggestedOrganizations = resolved.suggested;
	}

	return {
		subjectId: subject.id,
		secondFactorRequired,
		mustEnrolFactor: mustEnrolFactor || policyDemandsEnrolment,
		mustChangePassword: newest.must_change,
		...(organizationMemberships ? { organizationMemberships } : {}),
		...(suggestedOrganizations ? { suggestedOrganizations } : {}),
		...session,
	};
}

export interface ClearAuthenticationBackoffInput {
	subjectId: string;
	actor: AuditActor;
	reason: string;
}

export type ClearAuthenticationBackoffResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Resets whatever backoff state a subject has accumulated — its password row's
 * own failure count and window, its TOTP factor's own, or both when it holds
 * both — the administrator's one undo for a lockout nobody but them can see
 * building, across every credential a subject might hold.
 *
 * @param db - The tenant's database.
 * @param input - The subject to clear, who is clearing it, and why.
 * @returns Success, or that the subject holds neither a password row nor a
 * TOTP factor to clear.
 */
export async function clearAuthenticationBackoff(
	db: Database,
	input: ClearAuthenticationBackoffInput,
): Promise<ClearAuthenticationBackoffResult> {
	let newest = await db.findOne(passwords, {
		where: { subject_id: input.subjectId },
		orderBy: ["created_at", "desc"],
	});

	let factor = await db.find(totpFactors, { subject_id: input.subjectId });

	if (!newest && !factor) return { ok: false, reason: "not-found" };

	if (newest) await db.update(passwords, { id: newest.id }, clearedBackoff());
	if (factor) await db.update(totpFactors, { subject_id: input.subjectId }, clearedBackoff());

	await writeAuditEvent(db, {
		action: "password.backoff_cleared",
		actor: input.actor,
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { reason: input.reason },
	});

	return { ok: true };
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
	let addressFolded: string | null = null;

	if (folded.ok) {
		let identifierRow = await db.findOne(subjectIdentifiers, {
			where: and(eq("kind", kind), eq("folded", folded.folded), notNull("verified_at")),
		});

		if (identifierRow) {
			subjectId = identifierRow.subject_id;

			if (identifierRow.kind === "email") {
				address = identifierRow.value;
				addressFolded = identifierRow.folded;
			} else {
				let primaryEmail = await db.findOne(subjectIdentifiers, {
					where: and(
						eq("subject_id", identifierRow.subject_id),
						eq("kind", "email"),
						eq("is_primary", true),
					),
				});
				address = primaryEmail?.value ?? null;
				addressFolded = primaryEmail?.folded ?? null;
			}
		}
	}

	/**
	 * A spent envelope nulls `address` exactly the way an unresolved identifier
	 * already does, rather than adding a refusal shape of its own — the request leg's
	 * response is built from `address` alone, so this is what keeps a rate-limited
	 * mailbox indistinguishable from one that never resolved.
	 */
	if (subjectId !== null && address !== null && addressFolded !== null) {
		let envelope = await checkAndSpendMailEnvelope(db, { address: addressFolded });

		if (!envelope.ok) {
			address = null;
		} else {
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
 * @param options - Whether the breached-password lookup runs.
 * @returns The subject and the new row's id, or why the reset was refused.
 */
export async function completePasswordReset(
	db: Database,
	input: CompletePasswordResetInput,
	options: PasswordWriteOptions = {},
): Promise<CompletePasswordResetResult> {
	let hashed = await sha256(input.ticket);
	if (isFailure(hashed)) return { ok: false, reason: "invalid-ticket" };

	let ticketHash = Hex.encode(hashed.data);

	let row = await db.findOne(passwordResetTickets, { where: { ticket_hash: ticketHash } });
	if (!row) return { ok: false, reason: "invalid-ticket" };

	await db.delete(passwordResetTickets, { id: row.id });

	if (row.expires_at <= Date.now()) return { ok: false, reason: "invalid-ticket" };

	let written = await writeNewPassword(
		db,
		{ subjectId: row.subject_id, password: input.newPassword },
		options,
	);
	if (!written.ok) return written;

	await revokeSubjectSessions(db, { subjectId: row.subject_id, reason: "password_reset" });

	await writeAuditEvent(db, {
		action: "password.changed",
		actor: { type: "subject", id: row.subject_id },
		targetType: "subject",
		targetId: row.subject_id,
		outcome: "succeeded",
		detail: { via: "reset" },
	});

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
	await revokeSubjectSessions(db, {
		subjectId: input.subjectId,
		reason: input.reason,
		actor: PLATFORM_ACTOR,
	});

	await writeAuditEvent(db, {
		action: "password.changed",
		actor: PLATFORM_ACTOR,
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { via: "forced", reason: input.reason },
	});

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

	await writeAuditEvent(db, {
		action: "password.removed",
		actor: PLATFORM_ACTOR,
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
	});

	return { ok: true };
}
