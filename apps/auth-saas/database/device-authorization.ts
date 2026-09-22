/**
 * The device authorization grant's whole mechanism, both sides of it: the
 * `device_authorizations` table, the two codes a device mints and polls with, and
 * the pending row a person approves or denies from the phone or laptop they read the
 * code on — for a device with no browser worth using — a television app, a set-top
 * box, a command-line tool — to sign a person in from a screen it shows and a device
 * they already hold instead.
 *
 * The device code is machine-to-machine and as long as anything else this platform
 * mints; only its digest is stored, the same way a session token or an authorization
 * code never touches the database in the clear. The user code is read off a screen and
 * typed with a remote control, so it is drawn from twenty consonants by rejection
 * sampling rather than a modulo, which would bias some letters over others.
 *
 * Redemption reuses the authorization code's own atomic statement — an `UPDATE …
 * WHERE redeemed_at IS NULL … RETURNING *` — so two concurrent polls of an approved
 * row cannot both mint tokens, and minting itself reuses the token endpoint's own
 * shared steps rather than a second copy of them. Approval reuses that same
 * statement shape to guard against a second decision on one row, and reuses the
 * consent screen and its own scope-union so a device's approval and a browser's
 * are one surface and one standing grant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { Hex, randomBytes, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import {
	and,
	column as c,
	DataTableDatabaseError,
	eq,
	gt,
	inList,
	isNull,
	lt,
	notNull,
	or,
	table,
} from "remix/data-table";

import type { ConsentScreen } from "./consent";
import type { AuthScheme, TokenOutcome } from "./tokens";

import { clients } from "./clients";
import { evaluateConsent, recordConsentDecision } from "./consent";
import { sessions } from "./sessions";
import {
	AuthSchemeSchema,
	authenticateClient,
	issueRefreshToken,
	mintTokens,
	refreshTokenFamilyId,
	REFRESH_TOKEN_FAMILY_TTL_MS,
	revokeFamily,
} from "./tokens";

/** How long a device authorization stands before a person has to have picked up a phone. */
const DEVICE_AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

/** The polling interval every fresh device authorization starts at. */
const DEFAULT_INTERVAL_S = 5;

/** How much a too-soon poll raises the stored interval by, each time it happens. */
const SLOW_DOWN_INCREMENT_S = 5;

/** How long a redeemed row stays readable, so a replay is recognizable before it goes. */
const REDEEMED_DEVICE_AUTHORIZATION_RETENTION_MS = 24 * 60 * 60 * 1000;

/** How many expired or redeemed rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/** The twenty consonants RFC 8628 suggests for a user code: no vowel to spell a word, no digit to confuse on a remote or a phone. */
const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";

/** How many symbols a user code carries, split as `XXXX-XXXX` for display. */
const USER_CODE_LENGTH = 8;

/**
 * The largest byte value rejection sampling accepts for this alphabet: with 256
 * possible byte values and 20 symbols, 240 is the widest range divisible by 20, so
 * every accepted byte maps onto a symbol with equal probability. A byte at or past
 * this ceiling is redrawn rather than reduced by modulo, which would make the low
 * four symbols of the alphabet very slightly more likely than the rest.
 */
const USER_CODE_REJECTION_CEILING = 256 - (256 % USER_CODE_ALPHABET.length);

/** How many times a user code collision against the pending-codes index is retried before the mint fails. */
const MAX_USER_CODE_MINT_ATTEMPTS = 5;

/** How many pending rows a tenant may hold at once, bounding the table and making a burst of device sign-ups visible rather than quietly expensive. */
const MAX_PENDING_DEVICE_AUTHORIZATIONS = 500;

/** The feature slug this whole mechanism is sold under. */
export const DEVICE_GRANT_FEATURE = "device_grant";

/** The grant type a client's record must carry for `beginDeviceAuthorization` to answer it at all. */
export const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

/** One device's own pending, approved, denied or redeemed sign-in. */
export const deviceAuthorizations = table({
	name: "device_authorizations",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		device_code_hash: c.text(),
		user_code: c.text(),
		client_id: c.text(),
		scopes: c.json(),
		interval_s: c.integer(),
		last_polled_at: c.integer().nullable(),
		expires_at: c.integer(),
		approved_at: c.integer().nullable(),
		denied_at: c.integer().nullable(),
		redeemed_at: c.integer().nullable(),
		subject_id: c.text().nullable(),
		session_id: c.text().nullable(),
		auth_time: c.integer().nullable(),
		amr: c.json().nullable(),
		token_family_id: c.text().nullable(),
		created_at: c.integer(),
	},
});

export type DeviceAuthorizationRow = TableRow<typeof deviceAuthorizations>;

/** Mints an id for a new `device_authorizations` row. */
const deviceAuthorizationRowId = typeid("devr");

/** Mints the device code a device polls with, and the digest its row is found by. */
async function mintDeviceCode(): Promise<{ deviceCode: string; deviceCodeHash: string }> {
	let deviceCode = randomToken({ bytes: 32 });
	let hashed = await sha256(deviceCode);
	if (isFailure(hashed)) throw new Error("device code hashing failed");
	return { deviceCode, deviceCodeHash: Hex.encode(hashed.data) };
}

/**
 * Draws an eight-symbol user code from the twenty-consonant alphabet by rejection
 * sampling over random bytes, so every symbol is equally likely rather than biased
 * by a modulo. Answers both the folded form stored and compared — upper case, no
 * separator, since the alphabet carries no lower case to fold away — and the
 * hyphenated form a screen displays.
 */
function generateUserCode(): { folded: string; display: string } {
	let symbols = "";

	while (symbols.length < USER_CODE_LENGTH) {
		let candidates = randomBytes(USER_CODE_LENGTH - symbols.length);

		for (let byte of candidates) {
			if (byte >= USER_CODE_REJECTION_CEILING) continue;
			symbols += USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length];
			if (symbols.length === USER_CODE_LENGTH) break;
		}
	}

	return { folded: symbols, display: `${symbols.slice(0, 4)}-${symbols.slice(4)}` };
}

/**
 * Whether `error` is the unique-index conflict a colliding user code throws,
 * rather than some other failure. Matched on the underlying driver's own message
 * the same way a replayed TOTP claim is recognized, since Node's `node:sqlite` and
 * Bun's `bun:sqlite` disagree on the error code but agree on wording it as a
 * "constraint failed".
 */
function isUserCodeConflict(error: unknown): boolean {
	if (!(error instanceof DataTableDatabaseError)) return false;
	let cause = error.cause;
	if (!(cause instanceof Error)) return false;
	return /constraint failed/i.test(cause.message);
}

/** What minting a pending row needs, once the client and its scope ceiling already cleared. */
interface MintPendingRowInput {
	deviceCodeHash: string;
	clientId: string;
	scopes: string[];
	now: number;
}

/**
 * Writes a fresh pending row under a freshly drawn user code, retrying with a new
 * code on a collision against the pending-codes index — a code space of 25.6
 * billion against a pending set in the thousands, so a collision is a retry
 * rather than a design problem.
 */
async function mintPendingRow(
	db: Database,
	input: MintPendingRowInput,
): Promise<{ userCode: string }> {
	for (let attempt = 1; attempt <= MAX_USER_CODE_MINT_ATTEMPTS; attempt++) {
		let { folded, display } = generateUserCode();

		try {
			await db.create(deviceAuthorizations, {
				id: deviceAuthorizationRowId(generateUUID()).toString(),
				device_code_hash: input.deviceCodeHash,
				user_code: folded,
				client_id: input.clientId,
				scopes: input.scopes,
				interval_s: DEFAULT_INTERVAL_S,
				last_polled_at: null,
				expires_at: input.now + DEVICE_AUTHORIZATION_TTL_MS,
				approved_at: null,
				denied_at: null,
				redeemed_at: null,
				subject_id: null,
				session_id: null,
				auth_time: null,
				amr: null,
				token_family_id: null,
				created_at: input.now,
			});

			return { userCode: display };
		} catch (error) {
			if (attempt < MAX_USER_CODE_MINT_ATTEMPTS && isUserCodeConflict(error)) continue;
			throw error;
		}
	}

	throw new Error("unreachable: mintPendingRow always returns or throws");
}

export interface BeginDeviceAuthorizationInput {
	clientId: string;
	scope: string;
	now: number;
	/** The tenant's own issuer, whose origin `verification_uri` and its complete form are built from. */
	issuer: string;
}

let BeginDeviceAuthorizationSchema = s.object({
	clientId: s.string(),
	scope: s.string(),
	now: s.number(),
	issuer: s.string(),
});

export type BeginDeviceAuthorizationResult =
	| {
			ok: true;
			deviceCode: string;
			userCode: string;
			verificationUri: string;
			verificationUriComplete: string;
			expiresIn: number;
			interval: number;
	  }
	| {
			ok: false;
			reason: "invalid-client" | "unsupported-grant-type" | "invalid-scope" | "pending-ceiling";
	  };

/**
 * Mints a device and user code pair for a client that carries the device grant,
 * the RFC 8628 response a device polls the token endpoint with next.
 *
 * @param db - The tenant's database.
 * @param input - The client asking for the grant, the scope it requests, and the
 * clock and issuer to mint against.
 * @returns The minted codes and polling parameters, or which rule refused the
 * request.
 */
export async function beginDeviceAuthorization(
	db: Database,
	input: BeginDeviceAuthorizationInput,
): Promise<BeginDeviceAuthorizationResult> {
	let parsed = s.parse(BeginDeviceAuthorizationSchema, input);

	let client = await db.find(clients, { id: parsed.clientId });
	if (!client) return { ok: false, reason: "invalid-client" };

	let grantTypes = client.grant_types as string[];
	if (!grantTypes.includes(DEVICE_CODE_GRANT_TYPE)) {
		return { ok: false, reason: "unsupported-grant-type" };
	}

	let requestedScopes = parsed.scope.split(/\s+/).filter(Boolean);
	let ceiling = client.scopes as string[];
	if (requestedScopes.some((scope) => !ceiling.includes(scope))) {
		return { ok: false, reason: "invalid-scope" };
	}

	let pendingCount = await db.count(deviceAuthorizations, {
		where: and(isNull("approved_at"), isNull("denied_at"), isNull("redeemed_at")),
	});
	if (pendingCount >= MAX_PENDING_DEVICE_AUTHORIZATIONS) {
		return { ok: false, reason: "pending-ceiling" };
	}

	let { deviceCode, deviceCodeHash } = await mintDeviceCode();
	let { userCode } = await mintPendingRow(db, {
		deviceCodeHash,
		clientId: client.id,
		scopes: requestedScopes,
		now: parsed.now,
	});

	return {
		ok: true,
		deviceCode,
		userCode,
		verificationUri: `${parsed.issuer}/device`,
		verificationUriComplete: `${parsed.issuer}/device?user_code=${encodeURIComponent(userCode)}`,
		expiresIn: Math.floor(DEVICE_AUTHORIZATION_TTL_MS / 1000),
		interval: DEFAULT_INTERVAL_S,
	};
}

export interface RedeemDeviceCodeInput {
	deviceCode: string;
	clientId: string;
	clientSecret: string | null;
	authScheme: AuthScheme;
	now: number;
	/** The tenant's own issuer, stamped onto every token as `iss`. */
	issuer: string;
}

let RedeemDeviceCodeSchema = s.object({
	deviceCode: s.string(),
	clientId: s.string(),
	clientSecret: s.nullable(s.string()),
	authScheme: AuthSchemeSchema,
	now: s.number(),
	issuer: s.string(),
});

/**
 * Turns a device code into a token set once a person has approved it: authenticates
 * the client, enforces the polling interval, and redeems the row atomically so two
 * concurrent polls cannot both mint. The subject, session, `auth_time` and `amr` an
 * approval recorded are what the tokens carry, not whatever the live session holds
 * by the time redemption lands.
 *
 * @param db - The tenant's database.
 * @param input - The presented device code, the client's credentials, and the clock
 * and issuer to mint against.
 * @returns The minted token set, or the error this poll was refused for.
 */
export async function redeemDeviceCode(
	db: Database,
	input: RedeemDeviceCodeInput,
): Promise<TokenOutcome> {
	let parsed = s.parse(RedeemDeviceCodeSchema, input);

	let authenticated = await authenticateClient(db, {
		clientId: parsed.clientId,
		clientSecret: parsed.clientSecret,
		authScheme: parsed.authScheme,
	});
	if (!authenticated.ok) {
		return {
			kind: "error",
			status: authenticated.status,
			error: "invalid_client",
			description: authenticated.description,
		};
	}
	let client = authenticated.client;

	let hashed = await sha256(parsed.deviceCode);
	if (isFailure(hashed)) {
		return {
			kind: "error",
			status: 500,
			error: "server_error",
			description: "Failed to process the device code.",
		};
	}
	let deviceCodeHash = Hex.encode(hashed.data);

	let row = await db.findOne(deviceAuthorizations, {
		where: eq("device_code_hash", deviceCodeHash),
	});

	if (!row || row.client_id !== client.id) {
		return {
			kind: "error",
			status: 400,
			error: "invalid_grant",
			description: "This device code is unknown, or does not match the presented client.",
		};
	}

	if (row.redeemed_at !== null) {
		if (row.token_family_id !== null) await revokeFamily(db, row.token_family_id, parsed.now);

		return {
			kind: "error",
			status: 400,
			error: "invalid_grant",
			description: "This device code has already been redeemed.",
		};
	}

	if (row.denied_at !== null) {
		return {
			kind: "error",
			status: 400,
			error: "access_denied",
			description: "The person declined to approve this device.",
		};
	}

	if (row.expires_at <= parsed.now) {
		return {
			kind: "error",
			status: 400,
			error: "expired_token",
			description: "This device code has expired.",
		};
	}

	if (row.last_polled_at !== null && parsed.now < row.last_polled_at + row.interval_s * 1000) {
		// A control rather than advice: a device that ignores `slow_down` is answered
		// `slow_down` again on a longer clock next time, since the stored interval —
		// not merely the answer — is what rose.
		await db.update(
			deviceAuthorizations,
			{ id: row.id },
			{ last_polled_at: parsed.now, interval_s: row.interval_s + SLOW_DOWN_INCREMENT_S },
		);

		return {
			kind: "error",
			status: 400,
			error: "slow_down",
			description: "This device is polling faster than its interval allows.",
		};
	}

	if (row.approved_at === null) {
		await db.update(deviceAuthorizations, { id: row.id }, { last_polled_at: parsed.now });

		return {
			kind: "error",
			status: 400,
			error: "authorization_pending",
			description: "Nobody has approved this device yet.",
		};
	}

	// The redemption itself is the single statement the authorization code uses:
	// `UPDATE … WHERE redeemed_at IS NULL … RETURNING *`. Two concurrent polls both
	// read the row above as approved and unredeemed, but only one of these
	// statements finds a row still matching its own `WHERE` clause to update.
	let redemption = await db
		.query(deviceAuthorizations)
		.where(
			and(
				eq("device_code_hash", deviceCodeHash),
				notNull("approved_at"),
				isNull("denied_at"),
				isNull("redeemed_at"),
			),
		)
		.update({ redeemed_at: parsed.now }, { returning: "*" });

	let redeemedRow = "rows" in redemption ? (redemption.rows[0] ?? null) : null;

	if (!redeemedRow) {
		return {
			kind: "error",
			status: 400,
			error: "invalid_grant",
			description: "This device code has already been redeemed.",
		};
	}

	if (
		redeemedRow.subject_id === null ||
		redeemedRow.session_id === null ||
		redeemedRow.auth_time === null
	) {
		return {
			kind: "error",
			status: 500,
			error: "server_error",
			description: "This device authorization was approved without recording who approved it.",
		};
	}

	let grantedScopes = redeemedRow.scopes as string[];
	let sessionRow = await db.find(sessions, { id: redeemedRow.session_id });

	let minted = await mintTokens(db, {
		issuer: parsed.issuer,
		client,
		subjectId: redeemedRow.subject_id,
		sessionId: redeemedRow.session_id,
		amr: (redeemedRow.amr as string[] | null) ?? [],
		authTime: redeemedRow.auth_time,
		nonce: null,
		scopes: grantedScopes,
		now: parsed.now,
		activeOrganizationId: sessionRow?.active_organization_id ?? null,
	});
	if (minted.kind === "error") return minted;

	let refreshToken: string | null = null;

	if (grantedScopes.includes("offline_access")) {
		let familyId = refreshTokenFamilyId(generateUUID()).toString();

		let issued = await issueRefreshToken(db, {
			familyId,
			parentHash: null,
			clientId: client.id,
			subjectId: redeemedRow.subject_id,
			sessionId: redeemedRow.session_id,
			scopes: grantedScopes,
			now: parsed.now,
			absoluteExpiresAt: parsed.now + REFRESH_TOKEN_FAMILY_TTL_MS,
		});
		refreshToken = issued.token;

		// Named on the row itself so a replay of this same device code, however much
		// later, still finds the family a reuse response revokes.
		await db.update(deviceAuthorizations, { id: redeemedRow.id }, { token_family_id: familyId });
	}

	return {
		kind: "tokens",
		accessToken: minted.accessToken,
		idToken: minted.idToken,
		refreshToken,
		tokenType: "Bearer",
		expiresIn: minted.expiresIn,
		scope: grantedScopes.join(" "),
	};
}

/** Folds a presented user code the same way a minted one is stored: upper case, no hyphen. */
function foldUserCode(raw: string): string {
	return raw.trim().toUpperCase().replace(/-/g, "");
}

export interface BeginDeviceApprovalInput {
	userCode: string;
	/** The approving person's own live session, re-resolved here rather than trusted from the caller. */
	sessionId: string;
	now: number;
}

let BeginDeviceApprovalSchema = s.object({
	userCode: s.string(),
	sessionId: s.string(),
	now: s.number(),
});

export type BeginDeviceApprovalResult =
	| { ok: true; screen: ConsentScreen; deviceAuthorizationId: string }
	| { ok: false; reason: "unknown" | "expired" };

/**
 * Resolves the pending row a presented user code names, and the consent screen
 * it should be approved or denied through: the same shape and the same
 * `evaluateConsent` call an authorization request's own consent screen goes
 * through, forcing a screen every time regardless of any standing grant, since
 * an explicit look at what is being approved is this flow's only defence.
 *
 * @param db - The tenant's database.
 * @param input - The presented user code, the approving session, and the clock
 * to check expiry against.
 * @returns The screen to render and the row's own id, or which rule refused
 * the code.
 */
export async function beginDeviceApproval(
	db: Database,
	input: BeginDeviceApprovalInput,
): Promise<BeginDeviceApprovalResult> {
	let parsed = s.parse(BeginDeviceApprovalSchema, input);
	let folded = foldUserCode(parsed.userCode);

	let row = await db.findOne(deviceAuthorizations, {
		where: and(
			eq("user_code", folded),
			isNull("approved_at"),
			isNull("denied_at"),
			isNull("redeemed_at"),
		),
	});
	if (!row) return { ok: false, reason: "unknown" };
	if (row.expires_at <= parsed.now) return { ok: false, reason: "expired" };

	let session = await db.findOne(sessions, {
		where: and(
			eq("id", parsed.sessionId),
			isNull("revoked_at"),
			gt("expires_at", parsed.now),
			gt("idle_expires_at", parsed.now),
		),
	});
	// A session that stopped resolving between the controller's own check and
	// this call is refused the same as a code nobody recognizes, since nothing
	// more specific is owed for a race this rare.
	if (!session) return { ok: false, reason: "unknown" };

	let consent = await evaluateConsent(db, {
		subjectId: session.subject_id,
		clientId: row.client_id,
		requestedScopes: row.scopes as string[],
		// Shown every time, never skipped for a standing grant: the code's own
		// screen is the one place this flow lets a person see what they are
		// about to approve.
		isFirstParty: false,
		promptConsent: true,
		silent: false,
	});
	if (consent.decision !== "show") return { ok: false, reason: "unknown" };

	return { ok: true, screen: consent.screen, deviceAuthorizationId: row.id };
}

export interface DecideDeviceApprovalInput {
	deviceAuthorizationId: string;
	/** The deciding person's own live session, re-resolved here for the `subject_id`, `auth_time` and `amr` it names. */
	sessionId: string;
	approved: boolean;
	now: number;
}

let DecideDeviceApprovalSchema = s.object({
	deviceAuthorizationId: s.string(),
	sessionId: s.string(),
	approved: s.boolean(),
	now: s.number(),
});

export type DecideDeviceApprovalResult =
	| { ok: true; approved: boolean }
	| { ok: false; reason: "not-found" };

/**
 * Records the decision a person took on a device's own consent screen. Approval
 * writes the approving session's `subject_id`, `session_id`, `auth_time` and
 * `amr` onto the row, so a token minted on the next poll carries them exactly
 * as a browser sign-in would, and unions the requested scopes into the
 * subject's standing grant for the client the same way a browser's own consent
 * decision does. Denial only marks the row refused. Either way, a row already
 * decided, redeemed, or gone is refused rather than decided twice.
 *
 * @param db - The tenant's database.
 * @param input - The row being decided, the deciding session, whether it was
 * approved, and the clock to stamp the decision with.
 * @returns Which decision was recorded, or that the row no longer took one.
 */
export async function decideDeviceApproval(
	db: Database,
	input: DecideDeviceApprovalInput,
): Promise<DecideDeviceApprovalResult> {
	let parsed = s.parse(DecideDeviceApprovalSchema, input);

	let session = await db.findOne(sessions, {
		where: and(
			eq("id", parsed.sessionId),
			isNull("revoked_at"),
			gt("expires_at", parsed.now),
			gt("idle_expires_at", parsed.now),
		),
	});
	if (!session) return { ok: false, reason: "not-found" };

	let patch = parsed.approved
		? {
				approved_at: parsed.now,
				subject_id: session.subject_id,
				session_id: session.id,
				auth_time: session.auth_time,
				amr: session.amr,
			}
		: { denied_at: parsed.now };

	// The same atomic pattern `redeemDeviceCode` redeems with: the `WHERE`
	// clause only matches a row still undecided, so a second decision — or one
	// racing a poll that already redeemed the first — finds nothing to update.
	let decision = await db
		.query(deviceAuthorizations)
		.where(
			and(
				eq("id", parsed.deviceAuthorizationId),
				isNull("approved_at"),
				isNull("denied_at"),
				isNull("redeemed_at"),
			),
		)
		.update(patch, { returning: "*" });

	let decidedRow = "rows" in decision ? (decision.rows[0] ?? null) : null;
	if (!decidedRow) return { ok: false, reason: "not-found" };

	if (parsed.approved) {
		await recordConsentDecision(db, {
			subjectId: session.subject_id,
			clientId: decidedRow.client_id,
			approved: true,
			scopes: decidedRow.scopes as string[],
		});
	}

	return { ok: true, approved: parsed.approved };
}

export interface SweepDeviceAuthorizationsInput {
	now?: number;
	batchSize?: number;
}

/** How much of the sweep's work this call did, and whether another call is still owed one. */
export interface SweepDeviceAuthorizationsResult {
	deleted: number;
	more: boolean;
}

let SweepDeviceAuthorizationsSchema = s.object({
	now: s.optional(s.number()),
	batchSize: s.optional(s.number()),
});

/**
 * Deletes device authorizations in one bounded batch, for the scheduled handler
 * driving retention: an undecided, denied or never-redeemed row whose ten minutes
 * ran out, or a redeemed row old enough that a replay against it is no longer worth
 * keeping the row around to recognize.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a
 * caller sees `more: true` and runs the sweep again.
 */
export async function sweepDeviceAuthorizations(
	db: Database,
	input: SweepDeviceAuthorizationsInput = {},
): Promise<SweepDeviceAuthorizationsResult> {
	let parsed = s.parse(SweepDeviceAuthorizationsSchema, input);
	let now = parsed.now ?? Date.now();
	let batchSize = parsed.batchSize ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(deviceAuthorizations, {
		where: or(
			and(isNull("redeemed_at"), lt("expires_at", now)),
			and(
				notNull("redeemed_at"),
				lt("redeemed_at", now - REDEEMED_DEVICE_AUTHORIZATION_RETENTION_MS),
			),
		),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(deviceAuthorizations, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}
