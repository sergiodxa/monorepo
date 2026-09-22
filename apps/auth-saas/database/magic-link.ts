/**
 * Magic link sign-in: the `magic_link_attempts` and `magic_link_bursts` tables, and
 * the operations over them. A request mints a token and a code together, both bound
 * to the browser that asked; completion spends either one in a single conditional
 * write, so two attempts racing to finish the same attempt cannot both win.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { Hex, randomBytes, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { and, column as c, eq, gt, isNull, notNull, table } from "remix/data-table";

import type { EffectiveSessionPolicy } from "./session-policy";
import type { OpenSessionMetering, OpenSessionSuccess } from "./sessions";

import { checkAndSpendMailEnvelope } from "./mail-rate-limit";
import { openSession } from "./sessions";
import { foldIdentifier } from "./subject-identifiers";
import { createSubject, subjectIdentifiers } from "./subjects";
import { totpFactors } from "./totp";

/** How long a minted token and code stand before neither can complete anything. */
const MAGIC_LINK_TTL_MS = 10 * 60 * 1000;

/** How many wrong code guesses one attempt tolerates before it is destroyed. */
const CODE_ATTEMPT_LIMIT = 5;

/**
 * Crockford's base32 alphabet: the 32 symbols a 36-character alphanumeric set
 * leaves once `I`, `L`, `O` and `U` are dropped, so no two symbols left in it read
 * as the same shape and a person copying one off a screen never has to guess which
 * letter or digit they are looking at.
 */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** How many symbols a typed code carries, displayed split as `XXXX-XXXX`. */
const CODE_LENGTH = 8;

/** How many requests one address may spend inside its current 15-minute burst window. */
const BURST_LIMIT = 3;
const BURST_WINDOW_MS = 15 * 60 * 1000;

/** One request's token and code, both hashed, bound to the browser that asked. */
export const magicLinkAttempts = table({
	name: "magic_link_attempts",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		address: c.text(),
		subject_id: c.text().nullable(),
		locale: c.text().nullable(),
		token_hash: c.text(),
		code_hash: c.text(),
		browser_nonce_hash: c.text(),
		attempts_remaining: c.integer().default(CODE_ATTEMPT_LIMIT),
		expires_at: c.integer(),
		consumed_at: c.integer().nullable(),
		created_at: c.integer(),
		/** Whether this row may ever complete — false for an address with no subject minted while just-in-time creation is off. */
		completable: c.boolean().default(true),
		/** The pending authorization to resume once this attempt completes, named by the request rather than by anything the token's own URL carries. */
		interaction_id: c.text().nullable(),
		/** The path to resume once this attempt completes, for a caller with no interaction of its own. */
		return_to: c.text().nullable(),
	},
});

/** One address's running count against its own 15-minute burst window. */
export const magicLinkBursts = table({
	name: "magic_link_bursts",
	primaryKey: ["address"],
	columns: {
		address: c.text(),
		window_start: c.integer(),
		count: c.integer(),
	},
});

export type MagicLinkAttemptRow = TableRow<typeof magicLinkAttempts>;

/** Mints an id for a `magic_link_attempts` row. */
const magicLinkAttemptRowId = typeid("mlnk");

/**
 * Checks and spends one request against an address's own burst budget: a window
 * whose 15 minutes have elapsed resets its count before the cap is compared, and a
 * spend that clears the cap is written in the same call that decided it may,
 * nested under the mail envelope every credential kind already spends against.
 */
async function checkAndSpendMagicLinkBurst(
	db: Database,
	input: { address: string; now: number },
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
	let row = await db.find(magicLinkBursts, { address: input.address });

	let windowStart = row?.window_start ?? input.now;
	let count = row?.count ?? 0;

	if (input.now - windowStart >= BURST_WINDOW_MS) {
		windowStart = input.now;
		count = 0;
	}

	if (count >= BURST_LIMIT) {
		return {
			ok: false,
			retryAfterSeconds: Math.ceil((windowStart + BURST_WINDOW_MS - input.now) / 1000),
		};
	}

	let spent = { window_start: windowStart, count: count + 1 };

	if (row) {
		await db.update(magicLinkBursts, { address: input.address }, spent);
	} else {
		await db.create(magicLinkBursts, { address: input.address, ...spent });
	}

	return { ok: true };
}

/**
 * Draws an eight-symbol code from the unambiguous base32 alphabet by a direct,
 * unbiased byte mapping: 256 divides evenly by the alphabet's 32 symbols, so every
 * byte value lands on a symbol with exactly equal probability and none is ever
 * redrawn the way the twenty-symbol device user code needs rejection sampling to
 * stay unbiased. Answers both the folded form stored and compared, and the
 * hyphenated form a message displays.
 */
function generateMagicLinkCode(): { folded: string; display: string } {
	let bytes = randomBytes(CODE_LENGTH);
	let symbols = "";

	for (let byte of bytes) symbols += CODE_ALPHABET[byte % CODE_ALPHABET.length];

	return { folded: symbols, display: `${symbols.slice(0, 4)}-${symbols.slice(4)}` };
}

/** Folds a typed code the way it was stored: upper case, its separator and any surrounding space dropped. */
function normalizeMagicLinkCode(candidate: string): string {
	return candidate
		.normalize("NFKC")
		.toUpperCase()
		.replace(/[^0-9A-Z]/g, "");
}

export interface BeginMagicLinkSignInInput {
	/** The address as typed. */
	address: string;
	locale?: string | null;
	/** The hash of the nonce the `__Host-` cookie this request's response carries. */
	browserNonceHash: string;
	/** The pending authorization to resume once this attempt completes, named by the request itself rather than by anything a later request's own URL carries. */
	interactionId?: string | null;
	/** The path to resume once this attempt completes, for a caller with no interaction of its own. */
	returnTo?: string | null;
	at?: number;
}

export type BeginMagicLinkSignInResult =
	| { message: "sign_in"; token: string; code: string; expiresAt: number }
	| { message: "no_account" }
	| { message: "none"; retryAfterSeconds: number };

/**
 * Resolves an address, spends its two budgets, supersedes any outstanding attempt
 * of its own, and mints a fresh token and code together — for an address that
 * matches a subject, one that does not but the tenant lets become one, and one
 * that does not while the tenant keeps that off alike, so the write this call
 * performs costs the same regardless of which of the three an outside observer's
 * timing measurement could otherwise tell apart. Only the last of those three
 * mints a row nothing can ever complete, `completable` false, since there is no
 * subject for a later completion to create; an address that spends either its
 * burst budget or the shared mail envelope instead answers before reaching any of
 * this, since a rate-limit refusal reveals a fact about the budget rather than
 * about the address.
 *
 * @param db - The tenant's database.
 * @param input - The address as typed, the locale to remember for delivery, the
 * bound browser's nonce hash, the resume destination to store against the
 * minted attempt, and the clock to measure against.
 * @param jitSubjectCreationAllowed - Whether this tenant lets an address with no
 * matching subject mint a completable attempt, the subject created only once that
 * attempt completes; omitted, the platform default of off.
 * @returns The token, code and expiry to deliver, that no account matches (an
 * uncompletable attempt was still minted, to keep this call's own cost the
 * same), or how many seconds until the tighter of the two budgets next has room.
 */
export async function beginMagicLinkSignIn(
	db: Database,
	input: BeginMagicLinkSignInInput,
	jitSubjectCreationAllowed = false,
): Promise<BeginMagicLinkSignInResult> {
	let now = input.at ?? Date.now();

	let folded = foldIdentifier("email", input.address);
	if (!folded.ok) return { message: "no_account" };

	let addressFolded = folded.folded;

	let burst = await checkAndSpendMagicLinkBurst(db, { address: addressFolded, now });
	if (!burst.ok) return { message: "none", retryAfterSeconds: burst.retryAfterSeconds };

	let envelope = await checkAndSpendMailEnvelope(db, { address: addressFolded, now });
	if (!envelope.ok) return { message: "none", retryAfterSeconds: envelope.retryAfterSeconds };

	let identifierRow = await db.findOne(subjectIdentifiers, {
		where: and(eq("kind", "email"), eq("folded", addressFolded), notNull("verified_at")),
	});

	let subjectId = identifierRow?.subject_id ?? null;
	let completable = subjectId !== null || jitSubjectCreationAllowed;

	await db.deleteMany(magicLinkAttempts, {
		where: and(eq("address", addressFolded), isNull("consumed_at")),
	});

	let token = randomToken({ bytes: 32 });
	let tokenHashed = await sha256(token);
	if (isFailure(tokenHashed)) throw new Error("magic link token hashing failed");
	let tokenHash = Hex.encode(tokenHashed.data);

	let code = generateMagicLinkCode();
	let codeHashed = await sha256(code.folded);
	if (isFailure(codeHashed)) throw new Error("magic link code hashing failed");
	let codeHash = Hex.encode(codeHashed.data);

	let expiresAt = now + MAGIC_LINK_TTL_MS;

	await db.create(magicLinkAttempts, {
		id: magicLinkAttemptRowId(generateUUID()).toString(),
		address: addressFolded,
		subject_id: subjectId,
		locale: input.locale ?? null,
		token_hash: tokenHash,
		code_hash: codeHash,
		browser_nonce_hash: input.browserNonceHash,
		attempts_remaining: CODE_ATTEMPT_LIMIT,
		expires_at: expiresAt,
		consumed_at: null,
		created_at: now,
		completable,
		interaction_id: input.interactionId ?? null,
		return_to: input.returnTo ?? null,
	});

	if (!completable) return { message: "no_account" };

	return { message: "sign_in", token, code: code.display, expiresAt };
}

export type MagicLinkCredential = { kind: "link"; token: string } | { kind: "code"; code: string };

export interface CompleteMagicLinkSignInInput {
	credential: MagicLinkCredential;
	/** The raw nonce the `__Host-` cookie carries, never its hash. */
	browserNonce: string;
	at?: number;
	userAgentHash?: string | null;
}

export type CompleteMagicLinkSignInResult =
	| ({
			outcome: "signed_in";
			subjectId: string;
			secondFactorRequired: boolean;
			/** The pending authorization to resume, as named on the request that minted this attempt. */
			interactionId: string | null;
			/** The path to resume, for a request with no interaction of its own. */
			returnTo: string | null;
	  } & OpenSessionSuccess)
	| { outcome: "invalid" }
	| { outcome: "wrong_browser" }
	| { outcome: "bad_code"; attemptsLeft: number }
	| { outcome: "dau_cap_reached"; day: number; subjects: number; cap: number };

/**
 * Spends a token or a code and opens a session in the same call. A link is looked
 * up by its own token hash first, read-only: a wrong browser nonce against a token
 * that still resolves answers `wrong_browser` without touching the row, and only a
 * matching nonce reaches the one conditional write that actually consumes it, so
 * two completions racing the same token can never both win. A code is looked up by
 * the bound browser's own nonce hash rather than compared against every
 * outstanding row, since it is always typed back into the same browser the link
 * was requested from; a wrong guess costs one of its five remaining attempts and a
 * fifth wrong guess destroys the row outright, the same way a token's own
 * exhaustion would leave nothing left to retry against. Consuming a row minted for
 * an address with no subject yet creates one now, verified, since completing this
 * flow is the proof — unless the row was minted uncompletable, which refuses here
 * with the same answer an expired or already-consumed one gets. A successful
 * completion hands back the resume destination the request stored on this row,
 * rather than trusting one a caller's own URL might carry, since the token
 * travels through a channel that can rewrite it before the person ever sees it.
 *
 * @param db - The tenant's database.
 * @param input - The credential presented, the bound browser's raw nonce, and the
 * clock to measure against.
 * @param metering - The daily active user meter to record this sign-in against,
 * when the caller has one; omitted, no meter is touched and no sign-in is ever
 * refused for it.
 * @param sessionPolicy - The tenant's own effective session policy the opened
 * session is bound by; omitted, the platform defaults.
 * @returns The subject, the session opened for it, and the resume destination
 * stored against the attempt; that the credential never resolved to a live,
 * completable attempt; that it resolved to one bound to a different browser; how
 * many attempts a wrong code leaves; or that the daily cap refused this subject a
 * session.
 */
export async function completeMagicLinkSignIn(
	db: Database,
	input: CompleteMagicLinkSignInInput,
	metering?: OpenSessionMetering,
	sessionPolicy?: EffectiveSessionPolicy,
): Promise<CompleteMagicLinkSignInResult> {
	let now = input.at ?? Date.now();

	let nonceHashed = await sha256(input.browserNonce);
	if (isFailure(nonceHashed)) return { outcome: "invalid" };
	let nonceHash = Hex.encode(nonceHashed.data);

	let consumedRow: MagicLinkAttemptRow | null;

	if (input.credential.kind === "link") {
		let tokenHashed = await sha256(input.credential.token);
		if (isFailure(tokenHashed)) return { outcome: "invalid" };
		let tokenHash = Hex.encode(tokenHashed.data);

		let row = await db.findOne(magicLinkAttempts, { where: { token_hash: tokenHash } });

		if (!row || row.consumed_at !== null || row.expires_at <= now) {
			return { outcome: "invalid" };
		}

		if (row.browser_nonce_hash !== nonceHash) {
			return { outcome: "wrong_browser" };
		}

		// The single conditional write: two completions of the same token racing
		// here can both have read the row above as live, but only one of these
		// statements still finds a row matching its own `WHERE` clause to update.
		let consumption = await db
			.query(magicLinkAttempts)
			.where(and(eq("token_hash", tokenHash), isNull("consumed_at"), gt("expires_at", now)))
			.update({ consumed_at: now }, { returning: "*" });

		consumedRow = "rows" in consumption ? (consumption.rows[0] ?? null) : null;
		if (!consumedRow) return { outcome: "invalid" };
	} else {
		let row = await db.findOne(magicLinkAttempts, {
			where: { browser_nonce_hash: nonceHash },
			orderBy: ["created_at", "desc"],
		});

		if (!row || row.consumed_at !== null || row.expires_at <= now) {
			return { outcome: "invalid" };
		}

		let presentedHashed = await sha256(normalizeMagicLinkCode(input.credential.code));
		if (isFailure(presentedHashed)) return { outcome: "invalid" };
		let presentedHash = Hex.encode(presentedHashed.data);

		if (presentedHash !== row.code_hash) {
			let remaining = row.attempts_remaining - 1;

			if (remaining <= 0) {
				await db.delete(magicLinkAttempts, { id: row.id });
				return { outcome: "bad_code", attemptsLeft: 0 };
			}

			await db.update(magicLinkAttempts, { id: row.id }, { attempts_remaining: remaining });
			return { outcome: "bad_code", attemptsLeft: remaining };
		}

		let consumption = await db
			.query(magicLinkAttempts)
			.where(and(eq("id", row.id), isNull("consumed_at"), gt("expires_at", now)))
			.update({ consumed_at: now }, { returning: "*" });

		consumedRow = "rows" in consumption ? (consumption.rows[0] ?? null) : null;
		if (!consumedRow) return { outcome: "invalid" };
	}

	// A row minted for an address with no subject while just-in-time creation was
	// off consumes the same as any other, so nothing about reaching this point
	// told the caller apart from a completable one; only here does it refuse,
	// with the same `invalid` an expired or already-consumed row answers.
	if (!consumedRow.completable) return { outcome: "invalid" };

	let subjectId = consumedRow.subject_id;

	if (subjectId === null) {
		let created = await createSubject(db, {
			identifiers: [{ kind: "email", value: consumedRow.address, verifiedAt: now }],
		});

		if (!created.ok) return { outcome: "invalid" };
		subjectId = created.subjectId;
	}

	let factor = await db.find(totpFactors, { subject_id: subjectId });
	let secondFactorRequired = factor !== null;

	let session = await openSession(
		db,
		{
			subjectId,
			amr: ["magic_link"],
			remembered: true,
			userAgent: input.userAgentHash ?? null,
		},
		metering,
		sessionPolicy,
	);

	if (!session.ok) {
		return {
			outcome: "dau_cap_reached",
			day: session.day,
			subjects: session.subjects,
			cap: session.cap,
		};
	}

	return {
		outcome: "signed_in",
		subjectId,
		secondFactorRequired,
		interactionId: consumedRow.interaction_id,
		returnTo: consumedRow.return_to,
		...session,
	};
}

export interface CancelMagicLinkAttemptInput {
	browserNonce: string;
	at?: number;
}

/**
 * Abandons the outstanding attempt a browser's own nonce names, so a person
 * starting over leaves nothing behind for a later completion to find.
 *
 * @param db - The tenant's database.
 * @param input - The bound browser's raw nonce.
 * @returns Success, whether or not a matching attempt was found.
 */
export async function cancelMagicLinkAttempt(
	db: Database,
	input: CancelMagicLinkAttemptInput,
): Promise<{ ok: true }> {
	let nonceHashed = await sha256(input.browserNonce);

	if (isSuccess(nonceHashed)) {
		let nonceHash = Hex.encode(nonceHashed.data);
		await db.deleteMany(magicLinkAttempts, { where: { browser_nonce_hash: nonceHash } });
	}

	return { ok: true };
}
