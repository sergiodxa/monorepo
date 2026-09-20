/**
 * TOTP second-factor enrolment and its recovery codes: the tenant's own record of
 * an authenticator enrolment awaiting proof, the one active factor a subject
 * holds, the ten backup codes issued alongside it, and the browsers that have
 * proven the factor recently enough to skip it again. Kept as a module the
 * tenant object delegates to rather than written inline, the way `subjects.ts`
 * and `passkeys.ts` already are.
 *
 * The shared secret only ever exists in the clear inside this module, and only
 * for as long as one call needs it open: `beginTotpEnrolment` seals it the
 * moment `totp.generateSecret` mints it, and every later call opens the sealed
 * column, uses the plaintext, and lets it go out of scope with the call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { Base32, Hex, open, randomBytes, randomToken, seal, sha256, totp } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import {
	and,
	column as c,
	DataTableDatabaseError,
	eq,
	gt,
	isNull,
	lt,
	notNull,
	table,
} from "remix/data-table";

import type { AuditActor } from "./audit-events";
import type { SecondFactorState } from "./subjects";

import { writeAuditEvent } from "./audit-events";
import { extendSessionFactor, revokeSubjectSessions, sessions } from "./sessions";
import { subjectIdentifiers, subjects } from "./subjects";

/**
 * How long an enrolment stands before its sealed secret is swept away unused.
 * Ten minutes covers switching to an authenticator app, scanning or typing the
 * setup key, and coming back, without leaving an unproven secret sitting in the
 * enrolments table indefinitely.
 */
const ENROLMENT_TTL_MS = 10 * 60 * 1000;

/**
 * How long a `totp_claims` row is kept once written. Claims exist only to block
 * a code being replayed inside the drift window RFC 6238 verification accepts —
 * 90 seconds either side of the current step at most — so anything older than a
 * few minutes is pure cruft the sweep can drop without narrowing what the
 * window itself already protects.
 */
const CLAIM_RETENTION_MS = 5 * 60 * 1000;

/** How long a browser is excused the factor after `completeSecondFactor` remembers it. */
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** How many recovery codes activation and regeneration each mint. */
const RECOVERY_CODE_COUNT = 10;

/** Bytes of randomness per recovery code: 80 bits, comfortably beyond what a guessing budget under rate limiting could search. */
const RECOVERY_CODE_BYTES = 10;

/** Characters per group when a recovery code is formatted for display. */
const RECOVERY_CODE_GROUP_SIZE = 4;

/** Mints a `totpenr` id for an enrolment awaiting proof. */
const enrolmentId = typeid("totpenr");

/** Mints a `trdev` id for a remembered browser. */
const trustedDeviceId = typeid("trdev");

/** A secret sealed and waiting for the code that proves it was received. */
export const totpEnrolments = table({
	name: "totp_enrolments",
	primaryKey: ["enrolment_id"],
	columns: {
		enrolment_id: c.text(),
		subject_id: c.text(),
		sealed_secret: c.text(),
		expires_at: c.integer(),
	},
});

/** The one active TOTP factor a subject holds, replaced rather than added to on re-enrolment. */
export const totpFactors = table({
	name: "totp_factors",
	primaryKey: ["subject_id"],
	columns: {
		subject_id: c.text(),
		sealed_secret: c.text(),
		label: c.text(),
		activated_at: c.integer(),
		last_used_at: c.integer().nullable(),
	},
});

/** The replay guard: one row per code a verification has already accepted for a subject. */
export const totpClaims = table({
	name: "totp_claims",
	primaryKey: ["subject_id", "code_hash"],
	columns: {
		subject_id: c.text(),
		code_hash: c.text(),
		at: c.integer(),
	},
});

/**
 * The replay guard a step-up claims against, scoped to one interaction rather than
 * the subject at large: the same code proven for a different, concurrent step-up is
 * never mistaken for a replay of this one, since only a second submission against
 * this exact interaction conflicts on the unique index.
 */
export const totpStepUpClaims = table({
	name: "totp_stepup_claims",
	primaryKey: ["interaction_id", "code_hash"],
	columns: {
		interaction_id: c.text(),
		subject_id: c.text(),
		code_hash: c.text(),
		at: c.integer(),
	},
});

/** A single-use backup code, found by the digest the way a session token is. */
export const recoveryCodes = table({
	name: "recovery_codes",
	primaryKey: ["subject_id", "code_hash"],
	columns: {
		subject_id: c.text(),
		code_hash: c.text(),
		created_at: c.integer(),
		used_at: c.integer().nullable(),
	},
});

/** A browser that has proven the factor recently enough to be excused it again. */
export const trustedDevices = table({
	name: "trusted_devices",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		subject_id: c.text(),
		token_hash: c.text(),
		created_at: c.integer(),
		expires_at: c.integer(),
		ip: c.text().nullable(),
		user_agent: c.text().nullable(),
	},
});

export type TotpFactorRow = TableRow<typeof totpFactors>;

/**
 * Clears every trusted device a subject holds, called wherever the factor a
 * remembered browser was excused from proving stops being the one it would
 * face next: activating a factor (the first one, or a replacement) and the
 * administrator reset both change what a device would need to have proven.
 */
async function clearTrustedDevices(db: Database, subjectId: string): Promise<void> {
	await db.deleteMany(trustedDevices, { where: { subject_id: subjectId } });
}

/** Strips separators and folds case, so display formatting never affects matching. */
function foldRecoveryCode(input: string): string {
	return input.replaceAll(/[\s-]/g, "").toUpperCase();
}

/** Groups a raw, unformatted recovery code into the hyphenated form shown once. */
function formatRecoveryCode(raw: string): string {
	let groups: string[] = [];
	for (let index = 0; index < raw.length; index += RECOVERY_CODE_GROUP_SIZE) {
		groups.push(raw.slice(index, index + RECOVERY_CODE_GROUP_SIZE));
	}
	return groups.join("-");
}

/** SHA-256 of a value, hex-encoded — the digest a recovery code, a claim or a trusted-device token is found by. */
async function digest(value: string): Promise<string> {
	let hashed = await sha256(value);
	if (isFailure(hashed)) throw new Error("digest hashing failed");
	return Hex.encode(hashed.data);
}

/** Hashes an already-folded recovery code, the digest every lookup compares against. */
async function hashRecoveryCode(folded: string): Promise<string> {
	return digest(folded);
}

/**
 * Whether `error` is the unique-index conflict a replayed claim throws, rather
 * than some other failure. Matched on the underlying driver's own message
 * rather than an error code, since Node's `node:sqlite` and Bun's `bun:sqlite`
 * disagree on the code (`ERR_SQLITE_ERROR` against `SQLITE_CONSTRAINT_*`) but
 * agree on wording it as a "constraint failed".
 */
function isReplayConflict(error: unknown): boolean {
	if (!(error instanceof DataTableDatabaseError)) return false;
	let cause = error.cause;
	if (!(cause instanceof Error)) return false;
	return /constraint failed/i.test(cause.message);
}

/**
 * Claims a submission's digest against the subject-scoped replay guard before
 * anything about the submission is checked: the unique index on
 * `(subject_id, code_hash)` makes a second claim of the same digest a conflict,
 * refused here rather than discovered by comparing timestamps after the fact.
 * Claiming ahead of verifying keeps the mutual exclusion in one statement, with
 * no read-modify-write spanning the `await` that would otherwise derive whether
 * the submission is even valid.
 */
async function claimTotpCode(
	db: Database,
	subjectId: string,
	codeHash: string,
	now: number,
): Promise<boolean> {
	try {
		await db.create(totpClaims, { subject_id: subjectId, code_hash: codeHash, at: now });
		return true;
	} catch (error) {
		if (isReplayConflict(error)) return false;
		throw error;
	}
}

/**
 * Claims a submission's digest against one step-up interaction rather than the
 * subject at large, so the same code proven for a different, concurrent step-up
 * is never refused as a replay here — only a second submission against this
 * exact interaction is.
 */
async function claimStepUpCode(
	db: Database,
	interactionId: string,
	subjectId: string,
	codeHash: string,
	now: number,
): Promise<boolean> {
	try {
		await db.create(totpStepUpClaims, {
			interaction_id: interactionId,
			subject_id: subjectId,
			code_hash: codeHash,
			at: now,
		});
		return true;
	} catch (error) {
		if (isReplayConflict(error)) return false;
		throw error;
	}
}

/**
 * Replaces a subject's whole recovery-code set: deletes every row it holds and
 * writes ten fresh ones in the same call, so nobody is left holding a half-old
 * set nobody knows the state of.
 */
async function mintRecoveryCodes(db: Database, subjectId: string): Promise<string[]> {
	await db.deleteMany(recoveryCodes, { where: { subject_id: subjectId } });

	let now = Date.now();
	let codes: string[] = [];

	for (let index = 0; index < RECOVERY_CODE_COUNT; index++) {
		let raw = Base32.encode(randomBytes(RECOVERY_CODE_BYTES));
		let hash = await hashRecoveryCode(raw);

		await db.create(recoveryCodes, {
			subject_id: subjectId,
			code_hash: hash,
			created_at: now,
			used_at: null,
		});

		codes.push(formatRecoveryCode(raw));
	}

	return codes;
}

/**
 * Spends one unused recovery code matching the submission, folding and hashing it
 * the same way minting did. Stamping `used_at` in the same lookup is what makes a
 * code single-use: a second attempt with the same code finds no unused row left.
 */
async function spendRecoveryCode(
	db: Database,
	subjectId: string,
	submission: string,
): Promise<boolean> {
	let hash = await hashRecoveryCode(foldRecoveryCode(submission));

	let row = await db.findOne(recoveryCodes, {
		where: and(eq("subject_id", subjectId), eq("code_hash", hash), isNull("used_at")),
	});
	if (!row) return false;

	await db.update(
		recoveryCodes,
		{ subject_id: subjectId, code_hash: hash },
		{ used_at: Date.now() },
	);
	return true;
}

/**
 * Whether `submission` proves ownership of a subject's active factor: a current
 * TOTP code checked first, since that is the proof an authenticator app hands
 * back on every ordinary use, and a recovery code as the fallback for a subject
 * that no longer has the app.
 */
async function proveFactorOwnership(
	db: Database,
	sealKey: CryptoKey,
	subjectId: string,
	factor: TotpFactorRow,
	submission: string,
): Promise<boolean> {
	let opened = await open(sealKey, factor.sealed_secret);

	if (isSuccess(opened)) {
		let verified = await totp.verify(opened.data, submission);
		if (isSuccess(verified) && verified.data) return true;
	}

	return spendRecoveryCode(db, subjectId, submission);
}

/** The value shown as the account label inside an authenticator app: a subject's own primary identifier, or its id when it has claimed none. */
async function identifyingValueFor(db: Database, subjectId: string): Promise<string> {
	let identifiers = await db.findMany(subjectIdentifiers, { where: { subject_id: subjectId } });
	let primary = identifiers.find((row) => row.is_primary);
	return (primary ?? identifiers[0])?.value ?? subjectId;
}

/** The address a notice about this subject's second factor goes to: its primary verified email, or any other verified one, or none. */
async function resolveNotifyAddress(db: Database, subjectId: string): Promise<string | null> {
	let primary = await db.findOne(subjectIdentifiers, {
		where: and(
			eq("subject_id", subjectId),
			eq("kind", "email"),
			eq("is_primary", true),
			notNull("verified_at"),
		),
	});
	if (primary) return primary.value;

	let anyVerified = await db.findOne(subjectIdentifiers, {
		where: and(eq("subject_id", subjectId), eq("kind", "email"), notNull("verified_at")),
	});

	return anyVerified?.value ?? null;
}

export interface BeginTotpEnrolmentInput {
	subjectId: string;
	issuer: string;
}

export type BeginTotpEnrolmentResult =
	| { ok: true; enrolmentId: string; uri: string; setupKey: string }
	| { ok: false; reason: "not-found" };

/**
 * Mints a secret, seals it into `totp_enrolments`, and answers the `otpauth://`
 * URI and the base32 setup key once — the secret crosses the boundary here
 * because handing it to an authenticator app is the point of the call, and
 * nothing afterwards ever returns it again.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key, imported once and reused.
 * @param input - The subject enrolling, and the tenant's own issuer for the URI.
 * @returns The enrolment id to spend with {@link activateTotpFactor}, the URI to
 * render as a QR code, and the setup key to offer as a manual fallback, or that
 * no such subject exists.
 */
export async function beginTotpEnrolment(
	db: Database,
	sealKey: CryptoKey,
	input: BeginTotpEnrolmentInput,
): Promise<BeginTotpEnrolmentResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	let secret = totp.generateSecret();
	let sealed = await seal(sealKey, secret);
	if (isFailure(sealed)) throw new Error("failed to seal the TOTP secret");

	let id = enrolmentId(generateUUID()).toString();
	let now = Date.now();

	await db.create(totpEnrolments, {
		enrolment_id: id,
		subject_id: input.subjectId,
		sealed_secret: sealed.data,
		expires_at: now + ENROLMENT_TTL_MS,
	});

	let account = await identifyingValueFor(db, input.subjectId);
	let uri = totp.uri(secret, { issuer: input.issuer, account });

	return { ok: true, enrolmentId: id, uri, setupKey: secret };
}

export interface ActivateTotpFactorInput {
	enrolmentId: string;
	code: string;
	label?: string;
}

export type ActivateTotpFactorResult =
	| { ok: true; subjectId: string; label: string; activatedAt: number; recoveryCodes: string[] }
	| { ok: false; reason: "invalid-enrolment" }
	| { ok: false; reason: "invalid-code" };

/**
 * Spends an enrolment's sealed secret and, only once a submitted code verifies
 * against it, activates the factor and mints the ten recovery codes alongside
 * it. The enrolment row is deleted the moment it is found, ahead of opening or
 * verifying anything, so a second attempt against the same enrolment always
 * finds nothing left to spend regardless of whether this one succeeds.
 *
 * A wrong code here is a failed setup, not a lockout: nothing about this call
 * claims the submission against a replay guard, since no factor exists yet for
 * a replay to threaten. Activating a new factor replaces any prior one a
 * subject held: a second authenticator app is treated as a second scan of the
 * same QR code rather than a second factor alongside the first, so a subject
 * holds at most one at a time. Every trusted device the subject held is
 * cleared alongside it, since a browser excused from proving the old factor
 * has proven nothing about the one that now stands in its place.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The enrolment id from {@link beginTotpEnrolment}, the code read
 * off the app, and an optional label for the credential list.
 * @returns The activated factor's label and activation time with its fresh
 * recovery codes, or why activation was refused.
 */
export async function activateTotpFactor(
	db: Database,
	sealKey: CryptoKey,
	input: ActivateTotpFactorInput,
): Promise<ActivateTotpFactorResult> {
	let row = await db.find(totpEnrolments, { enrolment_id: input.enrolmentId });
	if (row) await db.delete(totpEnrolments, { enrolment_id: input.enrolmentId });
	if (!row || row.expires_at <= Date.now()) return { ok: false, reason: "invalid-enrolment" };

	let opened = await open(sealKey, row.sealed_secret);
	if (isFailure(opened)) return { ok: false, reason: "invalid-enrolment" };

	let verified = await totp.verify(opened.data, input.code);
	if (isFailure(verified) || !verified.data) return { ok: false, reason: "invalid-code" };

	let now = Date.now();
	let label = input.label ?? "Authenticator app";

	let existing = await db.find(totpFactors, { subject_id: row.subject_id });

	if (existing) {
		await db.update(
			totpFactors,
			{ subject_id: row.subject_id },
			{ sealed_secret: row.sealed_secret, label, activated_at: now, last_used_at: null },
		);
	} else {
		await db.create(totpFactors, {
			subject_id: row.subject_id,
			sealed_secret: row.sealed_secret,
			label,
			activated_at: now,
			last_used_at: null,
		});
	}

	let codes = await mintRecoveryCodes(db, row.subject_id);
	await clearTrustedDevices(db, row.subject_id);

	await writeAuditEvent(db, {
		action: "totp.enrolled",
		actor: { type: "subject", id: row.subject_id },
		targetType: "subject",
		targetId: row.subject_id,
		outcome: "succeeded",
		detail: { label },
	});

	return { ok: true, subjectId: row.subject_id, label, activatedAt: now, recoveryCodes: codes };
}

export type RegenerateRecoveryCodesResult =
	| { ok: true; recoveryCodes: string[] }
	| { ok: false; reason: "no-factor" };

/**
 * Replaces a subject's whole recovery-code set, refusing a subject with no
 * active factor — the codes exist to back one up, not to exist on their own.
 *
 * @param db - The tenant's database.
 * @param input - The subject regenerating its codes.
 * @returns The fresh set once, matching {@link activateTotpFactor}'s own answer
 * shape, or that the subject holds no factor to regenerate codes for.
 */
export async function regenerateRecoveryCodes(
	db: Database,
	input: { subjectId: string },
): Promise<RegenerateRecoveryCodesResult> {
	let factor = await db.find(totpFactors, { subject_id: input.subjectId });
	if (!factor) return { ok: false, reason: "no-factor" };

	let codes = await mintRecoveryCodes(db, input.subjectId);

	await writeAuditEvent(db, {
		action: "recovery_codes.regenerated",
		actor: { type: "subject", id: input.subjectId },
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
	});

	return { ok: true, recoveryCodes: codes };
}

export interface RemoveTotpFactorInput {
	subjectId: string;
	submission: string;
}

export type RemoveTotpFactorResult =
	| { ok: true }
	| { ok: false; reason: "no-factor" }
	| { ok: false; reason: "policy-requires-factor" }
	| { ok: false; reason: "invalid-submission" };

/**
 * Removes a subject's factor and every recovery code, requiring proof of a
 * current TOTP code or an unused recovery code first, and refusing outright
 * under a tenant policy of `required` — removal would leave the subject with no
 * factor, which the policy does not allow. A trusted device's own remembered
 * window keeps running past this call: a factor being enrolled again, or an
 * administrator reset, are what end it.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The subject removing its factor, and the code or recovery
 * code proving it.
 * @param policy - The tenant's own MFA policy, read by the caller from
 * `settings` — this module has no table of its own to read it from.
 * @returns Success, or why the removal was refused.
 */
export async function removeTotpFactor(
	db: Database,
	sealKey: CryptoKey,
	input: RemoveTotpFactorInput,
	policy: "optional" | "required",
): Promise<RemoveTotpFactorResult> {
	let factor = await db.find(totpFactors, { subject_id: input.subjectId });
	if (!factor) return { ok: false, reason: "no-factor" };

	if (policy === "required") return { ok: false, reason: "policy-requires-factor" };

	let proven = await proveFactorOwnership(db, sealKey, input.subjectId, factor, input.submission);
	if (!proven) return { ok: false, reason: "invalid-submission" };

	await db.delete(totpFactors, { subject_id: input.subjectId });
	await db.deleteMany(recoveryCodes, { where: { subject_id: input.subjectId } });

	await writeAuditEvent(db, {
		action: "totp.removed",
		actor: { type: "subject", id: input.subjectId },
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
	});

	return { ok: true };
}

/** Whether a subject holds a live, unexpired trusted-device token for this browser. */
export async function isTrustedDevice(
	db: Database,
	subjectId: string,
	token: string,
	now: number = Date.now(),
): Promise<boolean> {
	let hash = await digest(token);

	let row = await db.findOne(trustedDevices, {
		where: and(eq("subject_id", subjectId), eq("token_hash", hash), gt("expires_at", now)),
	});

	return row !== null;
}

export interface CompleteSecondFactorInput {
	sessionId: string;
	submission: string;
	trustDevice: boolean;
	agent: { ip: string | null; userAgent: string | null };
}

export type CompleteSecondFactorResult =
	| { ok: true; recoveryCodesRemaining: number; trustedDeviceToken: string | null }
	| { ok: false; reason: "session-not-found" }
	| { ok: false; reason: "no-factor" }
	| { ok: false; reason: "invalid-submission" }
	| { ok: false; reason: "replayed-submission" };

/**
 * Completes the second factor a sign-in demanded: claims the submission against
 * the subject-scoped replay guard, accepts a current code or a recovery code,
 * extends the session's `amr` with `otp`, and, when asked, mints a trusted-device
 * token remembering this browser for 30 days. A replay and a wrong submission
 * both refuse cleanly, distinguishable so a screen can say which happened.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The session the factor is owed on, the code or recovery code
 * submitted, whether to remember this browser, and the request's origin.
 * @returns The remaining recovery-code count and a trusted-device token when one
 * was minted, or why the factor was not completed.
 */
export async function completeSecondFactor(
	db: Database,
	sealKey: CryptoKey,
	input: CompleteSecondFactorInput,
): Promise<CompleteSecondFactorResult> {
	let now = Date.now();

	let session = await db.findOne(sessions, {
		where: and(eq("id", input.sessionId), isNull("revoked_at")),
	});
	if (!session) return { ok: false, reason: "session-not-found" };

	let factor = await db.find(totpFactors, { subject_id: session.subject_id });
	if (!factor) return { ok: false, reason: "no-factor" };

	let codeHash = await digest(input.submission);
	let claimed = await claimTotpCode(db, session.subject_id, codeHash, now);

	if (!claimed) {
		await writeAuditEvent(db, {
			action: "authentication.denied",
			actor: { type: "subject", id: session.subject_id },
			targetType: "subject",
			targetId: session.subject_id,
			outcome: "denied",
			context: input.agent,
			detail: { method: "totp", step: "second_factor", reason: "replay" },
		});
		return { ok: false, reason: "replayed-submission" };
	}

	let proven = await proveFactorOwnership(
		db,
		sealKey,
		session.subject_id,
		factor,
		input.submission,
	);

	if (!proven) {
		await writeAuditEvent(db, {
			action: "authentication.failed",
			actor: { type: "subject", id: session.subject_id },
			targetType: "subject",
			targetId: session.subject_id,
			outcome: "failed",
			context: input.agent,
			detail: { method: "totp", step: "second_factor" },
		});
		return { ok: false, reason: "invalid-submission" };
	}

	await db.update(totpFactors, { subject_id: session.subject_id }, { last_used_at: now });
	await extendSessionFactor(db, { sessionId: session.id, method: "otp" });

	let trustedDeviceToken: string | null = null;

	if (input.trustDevice) {
		trustedDeviceToken = randomToken({ bytes: 32 });

		await db.create(trustedDevices, {
			id: trustedDeviceId(generateUUID()).toString(),
			subject_id: session.subject_id,
			token_hash: await digest(trustedDeviceToken),
			created_at: now,
			expires_at: now + TRUSTED_DEVICE_TTL_MS,
			ip: input.agent.ip,
			user_agent: input.agent.userAgent,
		});
	}

	let recoveryCodesRemaining = await db.count(recoveryCodes, {
		where: and(eq("subject_id", session.subject_id), isNull("used_at")),
	});

	await writeAuditEvent(db, {
		action: "authentication.succeeded",
		actor: { type: "subject", id: session.subject_id },
		targetType: "subject",
		targetId: session.subject_id,
		outcome: "succeeded",
		context: input.agent,
		detail: { method: "totp", step: "second_factor", trustedDevice: input.trustDevice },
	});

	// A last-recovery-code-spent notice would mail the subject here once a caller
	// with `@sdxc/mail` access can reach this call; nothing sends one yet.

	return { ok: true, recoveryCodesRemaining, trustedDeviceToken };
}

export type CompleteSecondFactorViaEnrolmentResult =
	| { ok: true }
	| { ok: false; reason: "session-not-found" };

/**
 * Completes a sign-in's second-factor demand for a subject who just enrolled the
 * fresh factor an administrator reset had cleared: `activateTotpFactor` already
 * proved the code that activated it, so this only extends the session's `amr`
 * and clears `mfa_reset_required`, with no second proof to claim.
 *
 * @param db - The tenant's database.
 * @param input - The session the demand moves past, and the subject whose
 * `mfa_reset_required` flag this clears.
 * @returns Success once both are written, or that the session no longer resolves.
 */
export async function completeSecondFactorViaEnrolment(
	db: Database,
	input: { sessionId: string; subjectId: string },
): Promise<CompleteSecondFactorViaEnrolmentResult> {
	let extended = await extendSessionFactor(db, { sessionId: input.sessionId, method: "otp" });
	if (!extended.ok) return { ok: false, reason: "session-not-found" };

	await db.update(
		subjects,
		{ id: input.subjectId },
		{ mfa_reset_required: false, updated_at: Date.now() },
	);

	return { ok: true };
}

/** What the step-up screen needs to choose between asking for a code and offering enrolment. */
export interface StepUpScreen {
	hasFactor: boolean;
}

/**
 * Assembles the step-up screen: whether the subject holds a factor to ask a code
 * against, or should be offered enrolment instead.
 *
 * @param db - The tenant's database.
 * @param subjectId - The subject the step-up is demanded of.
 * @returns The screen `authorization.ts`'s `step-up` outcome carries.
 */
export async function describeStepUpScreen(db: Database, subjectId: string): Promise<StepUpScreen> {
	let factor = await db.find(totpFactors, { subject_id: subjectId });
	return { hasFactor: factor !== null };
}

export interface CompleteStepUpInput {
	interactionId: string;
	sessionId: string;
	submission: string;
	now?: number;
}

export type CompleteStepUpResult =
	| { ok: true }
	| { ok: false; reason: "session-not-found" }
	| { ok: false; reason: "no-factor" }
	| { ok: false; reason: "invalid-submission" }
	| { ok: false; reason: "replayed-submission" };

/**
 * Proves a step-up's own demand: claims the submission against this interaction
 * rather than the subject at large, accepts a current code or a recovery code,
 * and, once proven, moves the session's `auth_time` to this instant, mints its
 * `acr` as `mfa`, and extends `amr` with `otp` — the fact a caller resumes the
 * parked interaction against once this answers success.
 *
 * A step-up accepting a passkey assertion as its third proof is in the ADR this
 * mechanism follows, but is not wired here: the RPC this answers takes a single
 * text `submission`, and `passkeys.ts` exposes no bare "verify this assertion for
 * this subject" primitive separate from `signInWithPasskey`'s whole sign-in flow.
 * Building one is a real WebAuthn ceremony of its own — its own challenge storage
 * and relying-party wiring — not a thin reuse, so it is left for a pass that
 * decides that surface deliberately rather than growing it here as a side effect.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The interaction the proof is scoped to, the session it moves,
 * and the code or recovery code submitted.
 * @returns Success once the session is moved, or why the step-up was refused.
 */
export async function completeStepUp(
	db: Database,
	sealKey: CryptoKey,
	input: CompleteStepUpInput,
): Promise<CompleteStepUpResult> {
	let now = input.now ?? Date.now();

	let session = await db.findOne(sessions, {
		where: and(eq("id", input.sessionId), isNull("revoked_at")),
	});
	if (!session) return { ok: false, reason: "session-not-found" };

	let factor = await db.find(totpFactors, { subject_id: session.subject_id });
	if (!factor) return { ok: false, reason: "no-factor" };

	let codeHash = await digest(input.submission);
	let claimed = await claimStepUpCode(db, input.interactionId, session.subject_id, codeHash, now);
	if (!claimed) return { ok: false, reason: "replayed-submission" };

	let proven = await proveFactorOwnership(
		db,
		sealKey,
		session.subject_id,
		factor,
		input.submission,
	);
	if (!proven) return { ok: false, reason: "invalid-submission" };

	await db.update(totpFactors, { subject_id: session.subject_id }, { last_used_at: now });
	await extendSessionFactor(db, {
		sessionId: session.id,
		method: "otp",
		acr: "mfa",
		authTime: now,
	});

	await writeAuditEvent(db, {
		action: "authentication.succeeded",
		actor: { type: "subject", id: session.subject_id },
		targetType: "subject",
		targetId: session.subject_id,
		outcome: "succeeded",
		detail: { method: "totp", step: "step_up", interactionId: input.interactionId },
	});

	return { ok: true };
}

export type CompleteStepUpViaEnrolmentResult =
	| { ok: true }
	| { ok: false; reason: "session-not-found" };

/**
 * Moves a step-up straight through for a subject who just enrolled a fresh
 * factor to answer it: `activateTotpFactor` already proved the code that
 * activated the factor, so this only moves the session the same way
 * {@link completeStepUp} does, with no second proof to claim.
 *
 * @param db - The tenant's database.
 * @param input - The session the step-up moves, and the clock it moves it to.
 * @returns Success once the session is moved, or that the session no longer resolves.
 */
export async function completeStepUpViaEnrolment(
	db: Database,
	input: { sessionId: string; now?: number },
): Promise<CompleteStepUpViaEnrolmentResult> {
	let now = input.now ?? Date.now();

	let extended = await extendSessionFactor(db, {
		sessionId: input.sessionId,
		method: "otp",
		acr: "mfa",
		authTime: now,
	});
	if (!extended.ok) return { ok: false, reason: "session-not-found" };

	return { ok: true };
}

export interface ResetSecondFactorInput {
	subjectId: string;
	actor: AuditActor;
	reason: string;
}

export type ResetSecondFactorResult =
	| { ok: true; notifyAddress: string | null }
	| { ok: false; reason: "not-found" };

/**
 * The administrator path: removes the factor, every recovery code and every
 * trusted device, revokes every session, and marks the subject as owing a
 * fresh enrolment at its next sign-in. Mailing the subject is a Worker-side
 * concern this call does not perform — a tenant object has no `@sdxc/mail`
 * access — so it answers the address a caller should notify instead, unconditionally,
 * with no rate-limit check standing between a compromised account and its owner
 * hearing about it.
 *
 * @param db - The tenant's database.
 * @param input - The subject being reset, who is resetting it, and why.
 * @returns The address to notify (or `null` when the subject has none verified),
 * or that no such subject exists.
 */
export async function resetSecondFactor(
	db: Database,
	input: ResetSecondFactorInput,
): Promise<ResetSecondFactorResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	await db.delete(totpFactors, { subject_id: input.subjectId });
	await db.deleteMany(recoveryCodes, { where: { subject_id: input.subjectId } });
	await clearTrustedDevices(db, input.subjectId);

	await revokeSubjectSessions(db, {
		subjectId: input.subjectId,
		reason: input.reason,
		actor: input.actor,
	});

	await db.update(
		subjects,
		{ id: input.subjectId },
		{ mfa_reset_required: true, updated_at: Date.now() },
	);

	let notifyAddress = await resolveNotifyAddress(db, input.subjectId);

	await writeAuditEvent(db, {
		action: "second_factor.reset",
		actor: input.actor,
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { reason: input.reason },
	});

	return { ok: true, notifyAddress };
}

export type RevokeTrustedDeviceResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Deletes one remembered browser, scoped to the subject it must belong to, so
 * the authorization lives where the data does — the same guard
 * {@link removeTotpFactor}'s neighbors use for a session or a passkey.
 *
 * @param db - The tenant's database.
 * @param input - The subject and the device to revoke.
 * @returns Success, or that no such device exists for this subject.
 */
export async function revokeTrustedDevice(
	db: Database,
	input: { subjectId: string; deviceId: string },
): Promise<RevokeTrustedDeviceResult> {
	let row = await db.find(trustedDevices, { id: input.deviceId });
	if (!row || row.subject_id !== input.subjectId) return { ok: false, reason: "not-found" };

	await db.delete(trustedDevices, { id: input.deviceId });

	await writeAuditEvent(db, {
		action: "trusted_device.revoked",
		actor: { type: "subject", id: input.subjectId },
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { deviceId: input.deviceId },
	});

	return { ok: true };
}

/**
 * Assembles the second-factor state `describeSubject` folds in: the active
 * factor's label and last use (both `null` with none), how many recovery codes
 * are still unused, and every trusted device without its token hash.
 *
 * @param db - The tenant's database.
 * @param subjectId - The subject to describe.
 * @returns The state to pass into `subjects.ts`'s `describeSubject`.
 */
export async function describeSecondFactor(
	db: Database,
	subjectId: string,
): Promise<SecondFactorState> {
	let factor = await db.find(totpFactors, { subject_id: subjectId });

	let recoveryCodesRemaining = await db.count(recoveryCodes, {
		where: and(eq("subject_id", subjectId), isNull("used_at")),
	});

	let devices = await db.findMany(trustedDevices, { where: { subject_id: subjectId } });

	return {
		totpFactor: factor
			? { label: factor.label, lastUsedAt: factor.last_used_at }
			: { label: null, lastUsedAt: null },
		recoveryCodesRemaining,
		trustedDevices: devices.map((row) => ({
			id: row.id,
			createdAt: row.created_at,
			expiresAt: row.expires_at,
			ip: row.ip,
			userAgent: row.user_agent,
		})),
	};
}

/**
 * Clears expired enrolments, stale replay claims and expired trusted devices in
 * one call, meant to run from the tenant object's existing daily alarm
 * alongside its other sweeps rather than one of its own.
 *
 * @param db - The tenant's database.
 * @param now - The clock reading the sweep runs against.
 * @returns How many rows were cleared across the three tables.
 */
export async function sweepTotpState(
	db: Database,
	now: number = Date.now(),
): Promise<{ swept: number }> {
	let enrolments = await db.deleteMany(totpEnrolments, { where: lt("expires_at", now) });
	let claims = await db.deleteMany(totpClaims, { where: lt("at", now - CLAIM_RETENTION_MS) });
	let stepUpClaims = await db.deleteMany(totpStepUpClaims, {
		where: lt("at", now - CLAIM_RETENTION_MS),
	});
	let devices = await db.deleteMany(trustedDevices, { where: lt("expires_at", now) });

	return {
		swept:
			enrolments.affectedRows +
			claims.affectedRows +
			stepUpClaims.affectedRows +
			devices.affectedRows,
	};
}
