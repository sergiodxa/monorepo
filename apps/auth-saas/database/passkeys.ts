/**
 * Passkeys and the ceremonies that enroll and spend them: the tables a tenant's
 * WebAuthn sign-in hangs off, and the operations over them. Kept as a module the
 * tenant object delegates to rather than written inline, the way `subjects.ts` is.
 *
 * `@sdxc/passkey`'s `RelyingParty` does the cryptography — verifying an attestation,
 * checking a signature, catching a counter regression. What lives here is wiring: it
 * stores the challenge a ceremony issues, spends it exactly once, and turns what the
 * package verifies into the rows a tenant's sign-in reads back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColumnBuilder, Database, TableRow } from "remix/data-table";

import { CounterError, RelyingParty } from "@sdxc/passkey/server";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { parse as parseUserAgent } from "@sdxc/user-agent";
import { generateUUID } from "@sdxc/uuid";
import { and, column as c, eq, lt, ne, table } from "remix/data-table";

import type { AuditAction } from "./audit-events";
import type { OpenSessionMetering, OpenSessionSuccess } from "./sessions";

import { writeAuditEvent } from "./audit-events";
import { openSession } from "./sessions";
import * as Subjects from "./subjects";

/** How long a browser keeps a passkey prompt open, matching the package's own default. */
const CEREMONY_TTL_MS = 300_000;

/** Mints a `pkc_` id for a ceremony row: a name for the challenge, never a capability. */
const ceremonyId = typeid("pkc");

/** A credential a subject has enrolled, and what it takes to trust its next assertion. */
export const passkeys = table({
	name: "passkeys",
	primaryKey: ["credential_id"],
	columns: {
		credential_id: c.text(),
		subject_id: c.text(),
		public_key: c.text(),
		algorithm: c.integer(),
		counter: c.integer(),
		transports: c.json() as ColumnBuilder<string[]>,
		aaguid: c.text().nullable(),
		label: c.text(),
		syncable: c.boolean(),
		backed_up: c.boolean(),
		suspended: c.boolean().default(false),
		created_at: c.integer(),
		last_used_at: c.integer().nullable(),
	},
});

/** A challenge issued for one ceremony, live until it is spent or it expires. */
export const passkeyChallenges = table({
	name: "passkey_challenges",
	primaryKey: ["ceremony_id"],
	columns: {
		ceremony_id: c.text(),
		kind: c.enum(["registration", "authentication"] as const),
		subject_id: c.text().nullable(),
		challenge: c.text(),
		expires_at: c.integer(),
	},
});

export type PasskeyRow = TableRow<typeof passkeys>;
export type PasskeyChallengeRow = TableRow<typeof passkeyChallenges>;

/** One passkey as a credential list renders it. */
export interface PasskeySummary {
	credentialId: string;
	label: string;
	transports: string[];
	syncable: boolean;
	backedUp: boolean;
	createdAt: number;
}

/**
 * Builds the relying party a call was not handed one for, from the id and origins the
 * caller resolved outside this object. Neither is derived here: a tenant object has no
 * D1 access to look up a custom domain, so the Worker resolves the tenant's platform
 * subdomain and any attached domain into `origins` before it calls in.
 */
function defaultRelyingParty(relyingPartyId: string, origins: string[]): RelyingParty {
	return new RelyingParty({
		id: relyingPartyId,
		name: relyingPartyId,
		origin: origins,
		userVerification: "required",
	});
}

/**
 * Turns a `User-Agent` into a label a subject recognizes in their credential list. A
 * phone or tablet reads as the device it names — its model where the string gives one,
 * its platform otherwise; anything else reads as its browser and operating system.
 * A header that never arrived, or one neither rule recognizes, falls back to a generic
 * name rather than a guess.
 *
 * A real device model would come from the credential's AAGUID, but that needs a lookup
 * dataset this platform does not have, so an unrecognized agent goes straight to the
 * same generic fallback an unknown AAGUID would.
 */
function labelFromUserAgent(userAgent: string | undefined): string {
	if (!userAgent) return "Passkey";

	let { device, os, browser } = parseUserAgent(userAgent);

	if (device.type === "mobile" || device.type === "tablet") {
		return device.model ?? os.name ?? "Passkey";
	}

	if (browser.name && os.name) return `${browser.name} on ${os.name}`;
	return browser.name ?? os.name ?? "Passkey";
}

export interface BeginPasskeyRegistrationInput {
	subjectId: string;
	relyingPartyId: string;
	origins: string[];
}

export type BeginPasskeyRegistrationResult =
	| { ok: true; ceremonyId: string; options: PublicKeyCredentialCreationOptionsJSON }
	| { ok: false; reason: "not-found" };

/**
 * Starts a registration ceremony for an existing subject: excludes the devices it
 * already holds a credential on, names the ceremony after its primary identifier, and
 * parks the challenge for the matching {@link enrolPasskey} call to spend.
 *
 * @param db - The tenant's database.
 * @param input - The subject enrolling a credential, and the relying party id and
 * origins the Worker resolved for this tenant.
 * @param rp - Relying party to issue the ceremony from; built from `input` when
 * omitted.
 * @returns The ceremony id to round-trip and the options to send to the browser, or
 * that no such subject exists.
 */
export async function beginPasskeyRegistration(
	db: Database,
	input: BeginPasskeyRegistrationInput,
	rp: RelyingParty = defaultRelyingParty(input.relyingPartyId, input.origins),
): Promise<BeginPasskeyRegistrationResult> {
	let described = await Subjects.describeSubject(db, {
		subjectId: input.subjectId,
		audience: { kind: "admin" },
	});
	if (!described.ok) return { ok: false, reason: "not-found" };

	let existing = await db.findMany(passkeys, { where: { subject_id: input.subjectId } });
	let exclude = existing.map((row) => ({ id: row.credential_id, transports: row.transports }));

	let primary = described.identifiers.find((identifier) => identifier.isPrimary);
	let userName = (primary ?? described.identifiers[0])?.value ?? input.subjectId;

	let ceremony = rp.register({
		user: { id: input.subjectId, name: userName },
		exclude,
		residentKey: "required",
	});

	let id = ceremonyId(generateUUID()).toString();

	await db.create(passkeyChallenges, {
		ceremony_id: id,
		kind: "registration",
		subject_id: input.subjectId,
		challenge: ceremony.challenge,
		expires_at: Date.now() + CEREMONY_TTL_MS,
	});

	return { ok: true, ceremonyId: id, options: ceremony.options };
}

export interface EnrolPasskeyInput {
	ceremonyId: string;
	response: RegistrationResponseJSON;
	label?: string;
	userAgent?: string;
	relyingPartyId: string;
	origins: string[];
}

export type EnrolPasskeyResult =
	| { ok: true; passkey: PasskeySummary }
	| { ok: false; reason: "invalid-ceremony" }
	| { ok: false; reason: "expired-ceremony" }
	| { ok: false; reason: "already-registered" }
	| { ok: false; reason: "verification-failed"; error: string };

/**
 * Spends a registration ceremony's challenge and, once the response verifies, stores
 * the credential. The challenge row is deleted the moment it is found to belong to
 * this ceremony and not yet expired, ahead of running any cryptography, so a replayed
 * response finds nothing left to verify against.
 *
 * @param db - The tenant's database.
 * @param input - The ceremony id issued by {@link beginPasskeyRegistration}, the
 * browser's response, an optional label, the enrolling request's `User-Agent`, and the
 * relying party id and origins the Worker resolved.
 * @param rp - Relying party to verify the response with; built from `input` when
 * omitted.
 * @returns The stored credential's public fields, or which check refused it.
 */
export async function enrolPasskey(
	db: Database,
	input: EnrolPasskeyInput,
	rp: RelyingParty = defaultRelyingParty(input.relyingPartyId, input.origins),
): Promise<EnrolPasskeyResult> {
	let row = await db.find(passkeyChallenges, { ceremony_id: input.ceremonyId });
	if (!row || row.kind !== "registration") return { ok: false, reason: "invalid-ceremony" };

	let expired = row.expires_at <= Date.now();
	await db.delete(passkeyChallenges, { ceremony_id: input.ceremonyId });
	if (expired) return { ok: false, reason: "expired-ceremony" };

	let verified = await rp.verifyRegistration(input.response, { challenge: row.challenge });
	if (isFailure(verified)) {
		return { ok: false, reason: "verification-failed", error: verified.error.name };
	}

	let credential = verified.data;

	let duplicate = await db.find(passkeys, { credential_id: credential.id });
	if (duplicate) return { ok: false, reason: "already-registered" };

	let label = input.label ?? labelFromUserAgent(input.userAgent);
	let now = Date.now();

	await db.create(passkeys, {
		credential_id: credential.id,
		subject_id: row.subject_id as string,
		public_key: credential.publicKey,
		algorithm: credential.algorithm,
		counter: credential.counter,
		transports: credential.transports,
		aaguid: credential.aaguid,
		label,
		syncable: credential.syncable,
		backed_up: credential.backedUp,
		suspended: false,
		created_at: now,
		last_used_at: null,
	});

	await writeAuditEvent(db, {
		action: "passkey.enrolled",
		actor: { type: "subject", id: row.subject_id as string },
		targetType: "subject",
		targetId: row.subject_id as string,
		outcome: "succeeded",
		detail: { credentialId: credential.id, label },
	});

	return {
		ok: true,
		passkey: {
			credentialId: credential.id,
			label,
			transports: credential.transports,
			syncable: credential.syncable,
			backedUp: credential.backedUp,
			createdAt: now,
		},
	};
}

export interface BeginPasskeyAuthenticationInput {
	relyingPartyId: string;
	origins: string[];
}

export interface BeginPasskeyAuthenticationResult {
	ceremonyId: string;
	options: PublicKeyCredentialRequestOptionsJSON;
}

/**
 * Starts a usernameless authentication ceremony: no `allow` list, so the browser
 * offers every discoverable credential it holds for this relying party.
 *
 * @param db - The tenant's database.
 * @param input - The relying party id and origins the Worker resolved for this tenant.
 * @param rp - Relying party to issue the ceremony from; built from `input` when
 * omitted.
 * @returns The ceremony id to round-trip and the options to send to the browser.
 */
export async function beginPasskeyAuthentication(
	db: Database,
	input: BeginPasskeyAuthenticationInput,
	rp: RelyingParty = defaultRelyingParty(input.relyingPartyId, input.origins),
): Promise<BeginPasskeyAuthenticationResult> {
	let ceremony = rp.authenticate();
	let id = ceremonyId(generateUUID()).toString();

	await db.create(passkeyChallenges, {
		ceremony_id: id,
		kind: "authentication",
		subject_id: null,
		challenge: ceremony.challenge,
		expires_at: Date.now() + CEREMONY_TTL_MS,
	});

	return { ceremonyId: id, options: ceremony.options };
}

export interface SignInWithPasskeyInput {
	ceremonyId: string;
	response: AuthenticationResponseJSON;
	relyingPartyId: string;
	origins: string[];
	/** Whether the browser should keep the session past its own lifetime. */
	remembered: boolean;
	ip?: string | null;
	userAgent?: string | null;
	country?: string | null;
	region?: string | null;
	city?: string | null;
}

export type SignInWithPasskeyResult =
	| ({
			ok: true;
			subjectId: string;
			credentialId: string;
			userVerified: boolean;
			backedUp: boolean;
	  } & OpenSessionSuccess)
	| { ok: false; reason: "invalid-ceremony" }
	| { ok: false; reason: "expired-ceremony" }
	| { ok: false; reason: "unknown-credential" }
	| { ok: false; reason: "credential-suspended" }
	| { ok: false; reason: "counter-regression" }
	| { ok: false; reason: "verification-failed"; error: string }
	| { ok: false; reason: "dau_cap_reached" };

/**
 * Spends an authentication ceremony's challenge, verifies the assertion against the
 * credential it names, records the counter and last-use time, and opens a session —
 * a credential checked in one call and a session opened in another is one operation
 * split in half. A counter that fails to advance past what is stored is a clone
 * signal rather than an ordinary failed attempt: the credential is suspended and the
 * reason names that outcome on its own, distinct from every other way an assertion
 * can fail.
 *
 * @param db - The tenant's database.
 * @param input - The ceremony id issued by {@link beginPasskeyAuthentication}, the
 * browser's response, the relying party id and origins the Worker resolved, whether to
 * remember the session past its own lifetime, and the request's origin.
 * @param metering - The daily active user meter to record this sign-in against, when
 * the caller has one; omitted, no meter is touched and no sign-in is ever refused for it.
 * @param rp - Relying party to verify the response with; built from `input` when
 * omitted.
 * @returns The subject, credential and opened session, or which check refused it.
 */
export async function signInWithPasskey(
	db: Database,
	input: SignInWithPasskeyInput,
	metering?: OpenSessionMetering,
	rp: RelyingParty = defaultRelyingParty(input.relyingPartyId, input.origins),
): Promise<SignInWithPasskeyResult> {
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
			detail: { method: "passkey" },
		});
	}

	let row = await db.find(passkeyChallenges, { ceremony_id: input.ceremonyId });
	if (!row || row.kind !== "authentication") return { ok: false, reason: "invalid-ceremony" };

	let expired = row.expires_at <= Date.now();
	await db.delete(passkeyChallenges, { ceremony_id: input.ceremonyId });
	if (expired) return { ok: false, reason: "expired-ceremony" };

	let credential = await db.find(passkeys, { credential_id: input.response.id });
	if (!credential) return { ok: false, reason: "unknown-credential" };

	if (credential.suspended) {
		await auditAuthentication("denied", credential.subject_id);
		return { ok: false, reason: "credential-suspended" };
	}

	let verified = await rp.verifyAuthentication(input.response, {
		challenge: row.challenge,
		passkey: {
			id: credential.credential_id,
			publicKey: credential.public_key,
			counter: credential.counter,
		},
	});

	if (isFailure(verified)) {
		if (verified.error instanceof CounterError) {
			await db.update(passkeys, { credential_id: credential.credential_id }, { suspended: true });
			await auditAuthentication("denied", credential.subject_id);
			return { ok: false, reason: "counter-regression" };
		}

		await auditAuthentication("failed", credential.subject_id);
		return { ok: false, reason: "verification-failed", error: verified.error.name };
	}

	let now = Date.now();

	await db.update(
		passkeys,
		{ credential_id: credential.credential_id },
		{ counter: verified.data.counter, last_used_at: now },
	);

	let session = await openSession(
		db,
		{
			subjectId: credential.subject_id,
			amr: ["webauthn"],
			remembered: input.remembered,
			ip: input.ip,
			userAgent: input.userAgent,
			country: input.country,
			region: input.region,
			city: input.city,
		},
		metering,
	);

	if (!session.ok) {
		await auditAuthentication("denied", credential.subject_id);
		return { ok: false, reason: session.reason };
	}

	await auditAuthentication("succeeded", credential.subject_id);

	return {
		subjectId: credential.subject_id,
		credentialId: credential.credential_id,
		userVerified: verified.data.userVerified,
		backedUp: verified.data.backedUp,
		...session,
	};
}

export type RenamePasskeyResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Renames a passkey, scoped to the subject it belongs to.
 *
 * @param db - The tenant's database.
 * @param input - The subject, the credential to rename, and its new label.
 * @returns Success, or that no such credential exists for this subject.
 */
export async function renamePasskey(
	db: Database,
	input: { subjectId: string; credentialId: string; label: string },
): Promise<RenamePasskeyResult> {
	let row = await db.find(passkeys, { credential_id: input.credentialId });
	if (!row || row.subject_id !== input.subjectId) return { ok: false, reason: "not-found" };

	await db.update(passkeys, { credential_id: input.credentialId }, { label: input.label });

	await writeAuditEvent(db, {
		action: "passkey.renamed",
		actor: { type: "subject", id: input.subjectId },
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { credentialId: input.credentialId, label: input.label },
	});

	return { ok: true };
}

export type RevokePasskeyResult =
	| { ok: true }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "last-credential" };

/**
 * Removes a passkey, scoped to the subject it belongs to, refusing to take the
 * subject's last way to sign in.
 *
 * @param db - The tenant's database.
 * @param input - The subject and the credential to revoke.
 * @param hasOtherCredential - Whether the subject holds a credential besides this
 * passkey — a password, a verified identifier, or another passkey. Computed here from
 * this subject's other passkeys and verified identifiers when omitted; a caller that
 * also knows about passwords passes the fuller answer.
 * @returns Success, or that no such credential exists, or that it is the subject's
 * last remaining credential.
 */
export async function revokePasskey(
	db: Database,
	input: { subjectId: string; credentialId: string },
	hasOtherCredential?: boolean,
): Promise<RevokePasskeyResult> {
	let row = await db.find(passkeys, { credential_id: input.credentialId });
	if (!row || row.subject_id !== input.subjectId) return { ok: false, reason: "not-found" };

	if (hasOtherCredential === undefined) {
		let otherPasskeys = await db.count(passkeys, {
			where: and(eq("subject_id", input.subjectId), ne("credential_id", input.credentialId)),
		});

		if (otherPasskeys === 0) {
			let described = await Subjects.describeSubject(db, {
				subjectId: input.subjectId,
				audience: { kind: "admin" },
			});

			hasOtherCredential =
				described.ok && described.identifiers.some((identifier) => identifier.verified);
		} else {
			hasOtherCredential = true;
		}
	}

	if (!hasOtherCredential) return { ok: false, reason: "last-credential" };

	await db.delete(passkeys, { credential_id: input.credentialId });

	await writeAuditEvent(db, {
		action: "passkey.revoked",
		actor: { type: "subject", id: input.subjectId },
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { credentialId: input.credentialId },
	});

	return { ok: true };
}

/**
 * Clears every expired ceremony, the way `subjects.ts`'s own retention sweep clears
 * unverified identifiers. Meant to run from the tenant object's existing daily alarm,
 * alongside that sweep, rather than from an alarm of its own.
 *
 * @param db - The tenant's database.
 * @param now - The clock reading the sweep runs against.
 * @returns How many challenge rows were cleared.
 */
export async function sweepExpiredPasskeyChallenges(
	db: Database,
	now: number = Date.now(),
): Promise<{ swept: number }> {
	let result = await db.deleteMany(passkeyChallenges, { where: lt("expires_at", now) });
	return { swept: result.affectedRows };
}
