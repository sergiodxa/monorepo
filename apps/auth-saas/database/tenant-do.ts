/**
 * The per-tenant Durable Object. One object holds one tenant's identity state — its
 * settings, and later its subjects, clients, sessions and signing keys — in the SQLite
 * database Cloudflare gives the object, reachable by no query that could reach another
 * tenant's.
 *
 * It exposes typed RPC methods only, no `fetch` handler. A caller reaches this object for
 * a whole operation it validates and performs itself, never a query it would have to
 * assemble the rest of somewhere else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable } from "remix/data-table";

import { importKey } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure } from "@sdxc/result";
import { DurableObject } from "cloudflare:workers";
import { column as c, Database, table } from "remix/data-table";

import type {
	AuditActor,
	DrainAuditEventsInput,
	DrainAuditEventsResult,
	EnforceAuditRetentionResult,
	ReadAuditPageInput,
	ReadAuditPageResult,
} from "./audit-events";
import type {
	AuthorizationOutcome,
	BeginAuthorizationInput,
	ResumeAuthorizationInput,
} from "./authorization";
import type {
	DeleteClientResult,
	DisableClientResult,
	ListClientsInput,
	ListClientsResult,
	RegisterClientInput,
	RegisterClientResult,
	RevokeClientSecretInput,
	RevokeClientSecretResult,
	RotateClientSecretInput,
	RotateClientSecretResult,
	UpdateClientInput,
	UpdateClientResult,
} from "./clients";
import type {
	BeginConnectionSignInInput,
	BeginConnectionSignInResult,
	CompleteConnectionSignInInput,
	CompleteConnectionSignInResult,
	ResumeConnectionSignInInput,
} from "./connection-sign-in";
import type {
	DescribeConnectionsInput,
	DescribeConnectionsResult,
	RemoveConnectionResult,
	SaveConnectionInput,
	SaveConnectionResult,
	SetConnectionEnabledResult,
} from "./connections";
import type {
	EvaluateConsentInput,
	EvaluateConsentResult,
	ListGrantsInput,
	ListGrantsResult,
	RecordConsentDecisionInput,
	RecordConsentDecisionResult,
	RevokeGrantResult,
} from "./consent";
import type { ApplyEntitlementsInput, ApplyEntitlementsResult } from "./entitlements";
import type {
	PublishMetadataResult,
	ResolveUserInfoInput,
	ResolveUserInfoResult,
} from "./metadata";
import type { CloseMeteringDayInput, DailyUsage, DauCache, ReadUsageInput } from "./metering";
import type {
	BeginPasskeyAuthenticationInput,
	BeginPasskeyAuthenticationResult,
	BeginPasskeyRegistrationInput,
	BeginPasskeyRegistrationResult,
	EnrolPasskeyInput,
	EnrolPasskeyResult,
	RenamePasskeyResult,
	RevokePasskeyResult,
	SignInWithPasskeyInput,
	SignInWithPasskeyResult,
} from "./passkeys";
import type {
	BeginPasswordResetInput,
	BeginPasswordResetResult,
	ChangePasswordInput,
	ChangePasswordResult,
	CompletePasswordResetInput,
	CompletePasswordResetResult,
	ForcePasswordResetInput,
	ForcePasswordResetResult,
	PasswordPolicy,
	RemovePasswordResult,
	SetPasswordInput,
	SetPasswordResult,
	SignInWithPasswordInput,
	SignInWithPasswordResult,
} from "./passwords";
import type {
	DescribeSamlServiceProviderResult,
	RefreshConnectionMetadataResult,
	SaveEnterpriseConnectionInput,
	SaveEnterpriseConnectionResult,
	SetEnterpriseConnectionEnabledResult,
} from "./saml-connections";
import type {
	BeginSamlSignInInput,
	BeginSamlSignInResult,
	SignInWithSamlResponseInput,
	SignInWithSamlResponseResult,
} from "./saml-sign-in";
import type {
	ListSubjectSessionsInput,
	ListSubjectSessionsResult,
	ResolveSessionInput,
	ResolveSessionResult,
	RevokeSessionResult,
	RevokeSubjectSessionsInput,
	RevokeSubjectSessionsResult,
} from "./sessions";
import type {
	AdvanceSigningKeysInput,
	PublishedKeySet,
	PublishKeySetInput,
	SetCustomClaimsInput,
	SetCustomClaimsResult,
} from "./signing-keys";
import type {
	Actor,
	AddIdentifierInput,
	AddIdentifierResult,
	BlockSubjectResult,
	CreateSubjectInput,
	CreateSubjectResult,
	DefineAttributeInput,
	DeleteSubjectResult,
	DescribeSubjectResult,
	RemoveAttributeResult,
	RemoveIdentifierResult,
	SetPrimaryIdentifierResult,
	SubjectProfile,
	UnblockSubjectResult,
	UpdateSubjectResult,
	VerifyIdentifierResult,
} from "./subjects";
import type { ExchangeCodeInput, RefreshTokensInput, TokenOutcome } from "./tokens";
import type {
	ActivateTotpFactorInput,
	ActivateTotpFactorResult,
	BeginTotpEnrolmentResult,
	CompleteSecondFactorInput,
	CompleteSecondFactorResult,
	CompleteSecondFactorViaEnrolmentResult,
	CompleteStepUpResult,
	CompleteStepUpViaEnrolmentResult,
	RegenerateRecoveryCodesResult,
	RemoveTotpFactorInput,
	RemoveTotpFactorResult,
	ResetSecondFactorResult,
	RevokeTrustedDeviceResult,
} from "./totp";

import {
	auditEvents,
	drainAuditEvents,
	enforceAuditRetention,
	readAuditPage,
} from "./audit-events";
import * as Authorization from "./authorization";
import * as Clients from "./clients";
import * as ConnectionSignIn from "./connection-sign-in";
import * as Connections from "./connections";
import * as Consent from "./consent";
import { hasAnotherCredential } from "./credentials";
import { applyEntitlements, entitlementEnforcement } from "./entitlements";
import { mailSendEnvelopes } from "./mail-rate-limit";
import * as Metadata from "./metadata";
import { closeMeteringDay, createDauCache, dauDay, dauSeen, readUsage } from "./metering";
import * as Passkeys from "./passkeys";
import * as Passwords from "./passwords";
import * as SamlConnections from "./saml-connections";
import * as SamlSignIn from "./saml-sign-in";
import * as Sessions from "./sessions";
import * as SigningKeys from "./signing-keys";
import * as Subjects from "./subjects";
import { runMigrations } from "./tenant-migrations";
import * as Tokens from "./tokens";
import * as Totp from "./totp";

/** One row: the tenant id this object is addressed by, its issuer, its MFA policy, and its creation time. */
const settings = table({
	name: "settings",
	primaryKey: ["tenant_id"],
	columns: {
		tenant_id: c.text(),
		issuer: c.text(),
		mfa_policy: c.enum(["optional", "required"] as const).default("optional"),
		created_at: c.integer(),
	},
});

/**
 * What `provision` hands back: the schema now applied, the issuer it recorded, and the
 * key set now published for this tenant.
 */
export interface ProvisionResult {
	applied: string[];
	issuer: string;
	keys: PublishedKeySet;
}

/**
 * What this object's own SQLite counters filled in for the one RPC call that just ran,
 * read from its cursors rather than tracked any other way — the only place these
 * counters are readable, since they live inside the object.
 */
export interface CostEnvelope {
	rowsRead: number;
	rowsWritten: number;
	durationMs: number;
}

/** An RPC method's own result, with what that call cost this object folded in. */
export type WithCost<T> = T & { cost: CostEnvelope };

/** What `countingSqlStorage` totals across every statement one RPC call issues. */
interface CostCounters {
	rowsRead: number;
	rowsWritten: number;
}

/**
 * Wraps the object's raw `SqlStorage` handle, forwarding every call unchanged and adding
 * each statement's own cursor counts into `counters`. A cursor only ever reports the one
 * statement that produced it, so this is the only way to total a whole RPC call's storage
 * activity without changing the adapter that turns `remix/data-table` operations into the
 * statements this handle actually runs.
 *
 * @param sql - The object's real storage handle.
 * @param counters - Where every statement's own counts accumulate.
 * @returns A `SqlStorage` handle indistinguishable from the real one to its caller.
 */
function countingSqlStorage(sql: SqlStorage, counters: CostCounters): SqlStorage {
	return {
		exec<T extends Record<string, SqlStorageValue>>(
			query: string,
			...bindings: any[]
		): SqlStorageCursor<T> {
			let cursor = sql.exec<T>(query, ...bindings);
			counters.rowsRead += cursor.rowsRead;
			counters.rowsWritten += cursor.rowsWritten;
			return cursor;
		},
		get databaseSize(): number {
			return sql.databaseSize;
		},
		Cursor: sql.Cursor,
		Statement: sql.Statement,
	};
}

/**
 * How often the retention alarm sweeps unverified identifiers. Daily is frequent enough
 * that a swept row never sits long past the retention window, and infrequent enough
 * that an idle tenant's object wakes for almost nothing else.
 */
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** The daily active user cap a tenant enforces before any enforcement record has ever been written. */
const DEFAULT_DAU_CAP = 100;

/** The audit retention window, in days, a tenant enforces before any enforcement record has ever been written — the Free tier's own window, so an unprovisioned tenant is never more permissive than the tier that ships to everyone. */
const DEFAULT_AUDIT_RETENTION_DAYS = 7;

/** What `reportStorageFootprint` hands back: every table's own row count, and the database's total size. */
export interface StorageFootprint {
	rows: Record<string, number>;
	databaseSize: number;
}

/**
 * One tenant's identity state, isolated in this object's own SQLite database.
 */
export default class Tenant extends DurableObject<Cloudflare.Env> {
	#db: Database;

	/** The migrations applied during construction, read by `provision` once it settles. */
	#migrated: Promise<{ applied: string[] }>;

	/**
	 * This isolate's own record of which subjects today's daily active user meter has
	 * already counted. Never persisted: an object evicted and rebuilt starts it empty
	 * again, which costs one insert attempt per subject the meter re-meets rather than
	 * any loss of accuracy.
	 */
	#dauCache: DauCache = createDauCache();

	/** Every statement's own row counts, accumulated by `countingSqlStorage` and read and reset around each RPC call by `#withCost`. */
	#counters: CostCounters = { rowsRead: 0, rowsWritten: 0 };

	/**
	 * The AES-GCM key TOTP secrets are sealed and opened with, imported once from
	 * the tenant's own secret binding and reused. A constructor cannot `await`,
	 * so this starts `null` and {@link #sealKey} imports it lazily on first use,
	 * the same way {@link #dauEnforcement} reads its own state lazily rather than
	 * at construction.
	 */
	#sealKeyPromise: Promise<CryptoKey> | null = null;

	/**
	 * Opens this tenant's database and applies whatever schema has not run yet, queuing
	 * every method behind it so none observes a half-applied schema.
	 *
	 * @param ctx - The object's storage, alarms and concurrency gate.
	 * @param env - The Worker's bindings.
	 */
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);

		let driver = createSQLStorageDatabaseAdapter(
			countingSqlStorage(ctx.storage.sql, this.#counters),
		);
		this.#db = new Database(driver);
		this.#migrated = ctx.blockConcurrencyWhile(async () => {
			let migrated = await runMigrations(driver);

			if ((await ctx.storage.getAlarm()) === null) {
				await ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
			}

			return migrated;
		});
	}

	/**
	 * Runs `fn`, folding this object's own row counters and elapsed time into whatever it
	 * resolves with as a `cost` envelope. Counters reset first, so a call this object makes
	 * to itself while `fn` runs — there are none today — would still total correctly rather
	 * than double-counting whatever the previous call left behind.
	 *
	 * @param fn - The one RPC call's own work, its result otherwise unchanged.
	 * @returns Whatever `fn` resolved with, plus the `cost` this call measured.
	 */
	async #withCost<T>(fn: () => Promise<T>): Promise<WithCost<T>> {
		this.#counters.rowsRead = 0;
		this.#counters.rowsWritten = 0;

		let startedAt = performance.now();
		let result = await fn();
		let durationMs = performance.now() - startedAt;

		return Object.assign(result as object, {
			cost: {
				rowsRead: this.#counters.rowsRead,
				rowsWritten: this.#counters.rowsWritten,
				durationMs,
			},
		}) as WithCost<T>;
	}

	/**
	 * Provisions this tenant: waits on the schema the constructor already started
	 * migrating, records the tenant's id and issuer in `settings`, and generates the
	 * tenant's first signing key if it has none yet. A first boot and a catch-up boot
	 * behind several releases take the same path, because both wait on the one migration
	 * run the constructor starts; calling this again on an already-provisioned tenant
	 * generates no redundant key.
	 *
	 * @param input - The tenant id this object is addressed by, and the issuer it mints
	 * tokens under.
	 * @returns The migration ids applied on this boot, the issuer now recorded, and the
	 * key set now published for this tenant.
	 */
	async provision(input: { tenantId: string; issuer: string }): Promise<ProvisionResult> {
		let { applied } = await this.#migrated;

		let existing = await this.#db.find(settings, { tenant_id: input.tenantId });

		if (existing) {
			await this.#db.update(settings, { tenant_id: input.tenantId }, { issuer: input.issuer });
		} else {
			await this.#db.create(settings, {
				tenant_id: input.tenantId,
				issuer: input.issuer,
				created_at: Date.now(),
			});
		}

		await SigningKeys.ensureSigningKey(this.#db);
		let keys = await SigningKeys.publishKeySet(this.#db);

		return { applied, issuer: input.issuer, keys };
	}

	/**
	 * Destroys everything this object holds, for the control plane's purge job. Nothing
	 * calls this yet; the job that will is out of scope here.
	 */
	async erase(): Promise<WithCost<{ ok: true }>> {
		return this.#withCost(async () => {
			await this.ctx.storage.deleteAll();
			return { ok: true } as const;
		});
	}

	/** This tenant's own issuer, as `provision` recorded it, for stamping onto an error redirect. */
	async #issuer(): Promise<string> {
		let rows = await this.#db.findMany(settings);
		return rows[0]?.issuer ?? "";
	}

	/**
	 * The daily active user cap and whether it is hard, read from this tenant's own
	 * enforcement record. `hard` is re-derived from the enforced plan being Free rather
	 * than carried as a second stored flag, so the two can never disagree. A tenant
	 * whose record has never been written enforces the Free cap.
	 */
	async #dauEnforcement(): Promise<{ cap: number; hard: boolean }> {
		let record = await this.#db.findOne(entitlementEnforcement, { where: { id: "current" } });
		if (!record) return { cap: DEFAULT_DAU_CAP, hard: true };

		return { cap: record.dau_cap ?? DEFAULT_DAU_CAP, hard: record.plan === "free" };
	}

	/**
	 * This tenant's own audit retention window, read from its own enforcement
	 * record rather than fetched again from the Worker side — the record already
	 * lands here on every plan change, the same mechanism {@link #dauEnforcement}
	 * reads its own cap from. A tenant whose record has never been written
	 * enforces the Free tier's window.
	 */
	async #auditRetentionDays(): Promise<number> {
		let record = await this.#db.findOne(entitlementEnforcement, { where: { id: "current" } });
		return record?.audit_retention_days ?? DEFAULT_AUDIT_RETENTION_DAYS;
	}

	/**
	 * The AES-GCM key TOTP secrets are sealed and opened with, importing it from
	 * this tenant's `TOTP_SEAL_KEY` secret binding on first use and caching the
	 * result for the object's lifetime — importing is async and the key is
	 * non-extractable, so there is nothing to gain from importing it twice.
	 */
	async #sealKey(): Promise<CryptoKey> {
		this.#sealKeyPromise ??= importKey(this.env.TOTP_SEAL_KEY).then((result) => {
			if (isFailure(result)) throw new Error("the TOTP seal key binding is not a usable AES key");
			return result.data;
		});

		return this.#sealKeyPromise;
	}

	/** This tenant's own MFA policy, read from `settings`. A tenant that has never provisioned enforces `optional`. */
	async #mfaPolicy(): Promise<"optional" | "required"> {
		let rows = await this.#db.findMany(settings);
		return rows[0]?.mfa_policy ?? "optional";
	}

	/**
	 * Creates a subject with its claimed identifiers, profile and attributes.
	 *
	 * @param input - The identifiers to claim, the standard profile claims, and any
	 * declared attributes to set.
	 * @returns The new subject's id and each identifier's starting state, or which
	 * identifier or attribute key the call was refused for.
	 */
	async createSubject(input: CreateSubjectInput): Promise<WithCost<CreateSubjectResult>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.createSubject(this.#db, input));
	}

	/**
	 * Writes a subject's profile columns and the attributes its actor may set.
	 *
	 * @param input - The subject, its profile and attribute changes, and who is asking.
	 * @returns Success, or which attribute key the actor may not write, or that no such
	 * subject exists.
	 */
	async updateSubject(input: {
		subjectId: string;
		profile?: SubjectProfile;
		attributes?: Record<string, unknown>;
		actor: Actor;
	}): Promise<WithCost<UpdateSubjectResult>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.updateSubject(this.#db, input));
	}

	/**
	 * Claims a new identifier for an existing subject, minting a verification ticket for
	 * an email address.
	 *
	 * @param input - The subject, the identifier's kind and value, and who is asking.
	 * @returns The identifier's starting state — with a ticket to deliver for an email —
	 * or which rule the call was refused for.
	 */
	async addIdentifier(input: AddIdentifierInput): Promise<WithCost<AddIdentifierResult>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.addIdentifier(this.#db, input));
	}

	/**
	 * Spends a verification ticket, proving the identifier it was minted for.
	 *
	 * @param input - The ticket as it was delivered to the address.
	 * @returns The subject the address belongs to and whether it became primary, or why
	 * the ticket does not work.
	 */
	async verifyIdentifier(input: { ticket: string }): Promise<WithCost<VerifyIdentifierResult>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.verifyIdentifier(this.#db, input));
	}

	/**
	 * Moves the subject's primary identifier to a verified address.
	 *
	 * @param input - The subject, the identifier's value as entered, and who is asking.
	 * @returns Success, or that the identifier was not found or is not verified.
	 */
	async setPrimaryIdentifier(input: {
		subjectId: string;
		value: string;
		actor: Actor;
	}): Promise<WithCost<SetPrimaryIdentifierResult>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.setPrimaryIdentifier(this.#db, input));
	}

	/**
	 * Removes an identifier, refusing to take a subject's last verified email address.
	 *
	 * @param input - The subject, the identifier's value as entered, and who is asking.
	 * @returns The address promoted to primary (or none) and who to notify, or why the
	 * removal was refused.
	 */
	async removeIdentifier(input: {
		subjectId: string;
		value: string;
		actor: Actor;
	}): Promise<WithCost<RemoveIdentifierResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let row = await this.#db.findOne(Subjects.subjectIdentifiers, {
				where: { subject_id: input.subjectId, value: input.value },
			});
			if (!row) return Subjects.removeIdentifier(this.#db, input);

			let hasOtherCredential = await hasAnotherCredential(this.#db, input.subjectId, {
				kind: "identifier",
				id: row.id,
			});

			return Subjects.removeIdentifier(this.#db, input, hasOtherCredential);
		});
	}

	/**
	 * Blocks a subject.
	 *
	 * @param input - The subject to block and the reason recorded for the call.
	 * @returns Success, or that no such subject exists.
	 */
	async blockSubject(input: {
		subjectId: string;
		reason: string;
	}): Promise<WithCost<BlockSubjectResult>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.blockSubject(this.#db, input));
	}

	/**
	 * Unblocks a subject.
	 *
	 * @param input - The subject to unblock.
	 * @returns Success, or that no such subject exists.
	 */
	async unblockSubject(input: { subjectId: string }): Promise<WithCost<UnblockSubjectResult>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.unblockSubject(this.#db, input));
	}

	/**
	 * Deletes a subject, its identifiers and its attributes, and retires its id.
	 *
	 * @param input - The subject to delete.
	 * @returns Success, or that no such subject exists.
	 */
	async deleteSubject(input: { subjectId: string }): Promise<WithCost<DeleteSubjectResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			await this.#db.deleteMany(Passwords.passwords, { where: { subject_id: input.subjectId } });
			await this.#db.deleteMany(Passkeys.passkeys, { where: { subject_id: input.subjectId } });
			await this.#db.deleteMany(Consent.grants, { where: { subject_id: input.subjectId } });
			await this.#db.deleteMany(Totp.totpEnrolments, { where: { subject_id: input.subjectId } });
			await this.#db.deleteMany(Totp.totpFactors, { where: { subject_id: input.subjectId } });
			await this.#db.deleteMany(Totp.recoveryCodes, { where: { subject_id: input.subjectId } });
			await this.#db.deleteMany(Totp.trustedDevices, { where: { subject_id: input.subjectId } });

			return Subjects.deleteSubject(this.#db, input);
		});
	}

	/**
	 * Declares or redeclares a tenant's custom attribute key.
	 *
	 * @param input - The key, its type, and its visibility.
	 * @returns Success; defining an existing key updates it in place.
	 */
	async defineAttribute(input: DefineAttributeInput): Promise<WithCost<{ ok: true }>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.defineAttribute(this.#db, input));
	}

	/**
	 * Removes an attribute's definition, leaving subjects' stored values in place.
	 *
	 * @param input - The key to remove.
	 * @returns Success, or that no such key was defined.
	 */
	async removeAttribute(input: { key: string }): Promise<WithCost<RemoveAttributeResult>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.removeAttribute(this.#db, input));
	}

	/**
	 * Assembles everything one account screen renders for a subject, including
	 * its TOTP factor, recovery codes and trusted devices.
	 *
	 * @param input - The subject to describe and who is looking.
	 * @returns The assembled view, or that no such subject exists.
	 */
	async describeSubject(input: {
		subjectId: string;
		audience: Actor;
	}): Promise<WithCost<DescribeSubjectResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let secondFactor = await Totp.describeSecondFactor(this.#db, input.subjectId);
			return Subjects.describeSubject(this.#db, input, secondFactor);
		});
	}

	/**
	 * Sets this tenant's MFA policy: `optional` lets a subject sign in and leave
	 * without a factor, `required` refuses to let one be removed.
	 *
	 * @param input - The policy to enforce from now on.
	 * @returns Success, once the setting is written.
	 */
	async setMfaPolicy(input: { policy: "optional" | "required" }): Promise<WithCost<{ ok: true }>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let rows = await this.#db.findMany(settings);
			let row = rows[0];
			if (row)
				await this.#db.update(settings, { tenant_id: row.tenant_id }, { mfa_policy: input.policy });
			return { ok: true } as const;
		});
	}

	/**
	 * Mints a secret, seals it, and starts a ten-minute enrolment window.
	 *
	 * @param input - The subject enrolling a TOTP factor.
	 * @returns The enrolment id, the `otpauth://` URI and the setup key to show
	 * once, or that no such subject exists.
	 */
	async beginTotpEnrolment(input: {
		subjectId: string;
	}): Promise<WithCost<BeginTotpEnrolmentResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let [issuer, sealKey] = await Promise.all([this.#issuer(), this.#sealKey()]);
			return Totp.beginTotpEnrolment(this.#db, sealKey, { subjectId: input.subjectId, issuer });
		});
	}

	/**
	 * Spends an enrolment's sealed secret, verifies the submitted code, and only
	 * then activates the factor and mints its recovery codes.
	 *
	 * @param input - The enrolment id, the code read off the app, and an
	 * optional label.
	 * @returns The activated factor and its fresh recovery codes, or why
	 * activation was refused.
	 */
	async activateTotpFactor(
		input: ActivateTotpFactorInput,
	): Promise<WithCost<ActivateTotpFactorResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let sealKey = await this.#sealKey();
			return Totp.activateTotpFactor(this.#db, sealKey, input);
		});
	}

	/**
	 * Replaces a subject's whole recovery-code set.
	 *
	 * @param input - The subject regenerating its codes.
	 * @returns The fresh set, or that the subject holds no factor to back up.
	 */
	async regenerateRecoveryCodes(input: {
		subjectId: string;
	}): Promise<WithCost<RegenerateRecoveryCodesResult>> {
		await this.#migrated;
		return this.#withCost(() => Totp.regenerateRecoveryCodes(this.#db, input));
	}

	/**
	 * Removes a subject's TOTP factor, proving a current code or a recovery
	 * code first and refusing outright under a `required` tenant policy.
	 *
	 * @param input - The subject removing its factor, and the proof submitted.
	 * @returns Success, or why the removal was refused.
	 */
	async removeTotpFactor(input: RemoveTotpFactorInput): Promise<WithCost<RemoveTotpFactorResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let [policy, sealKey] = await Promise.all([this.#mfaPolicy(), this.#sealKey()]);
			return Totp.removeTotpFactor(this.#db, sealKey, input, policy);
		});
	}

	/**
	 * The administrator path: strips a subject's whole second-factor state,
	 * revokes its sessions, and marks it as owing a fresh enrolment.
	 *
	 * @param input - The subject being reset, who is resetting it, and why.
	 * @returns The address to notify, or that no such subject exists.
	 */
	async resetSecondFactor(input: {
		subjectId: string;
		actor: AuditActor;
		reason: string;
	}): Promise<WithCost<ResetSecondFactorResult>> {
		await this.#migrated;
		return this.#withCost(() => Totp.resetSecondFactor(this.#db, input));
	}

	/**
	 * Revokes one remembered browser, scoped to the subject it must belong to.
	 *
	 * @param input - The subject and the device to revoke.
	 * @returns Success, or that no such device exists for this subject.
	 */
	async revokeTrustedDevice(input: {
		subjectId: string;
		deviceId: string;
	}): Promise<WithCost<RevokeTrustedDeviceResult>> {
		await this.#migrated;
		return this.#withCost(() => Totp.revokeTrustedDevice(this.#db, input));
	}

	/**
	 * Completes the second factor a password or passkey sign-in demanded: a code
	 * or a recovery code, extending the signed-in session's `amr` and, when asked,
	 * remembering this browser for 30 days.
	 *
	 * @param input - The session the factor is owed on, the submission, whether
	 * to remember this browser, and the request's origin.
	 * @returns The remaining recovery-code count and a trusted-device token when
	 * one was minted, or why the factor was not completed.
	 */
	async completeSecondFactor(
		input: CompleteSecondFactorInput,
	): Promise<WithCost<CompleteSecondFactorResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let sealKey = await this.#sealKey();
			return Totp.completeSecondFactor(this.#db, sealKey, input);
		});
	}

	/**
	 * Completes a sign-in's second-factor demand for a subject who just enrolled
	 * the fresh factor an administrator reset had cleared.
	 *
	 * @param input - The session the demand moves past, and the subject enrolling.
	 * @returns Success, or that the session no longer resolves.
	 */
	async completeSecondFactorViaEnrolment(input: {
		sessionId: string;
		subjectId: string;
	}): Promise<WithCost<CompleteSecondFactorViaEnrolmentResult>> {
		await this.#migrated;
		return this.#withCost(() => Totp.completeSecondFactorViaEnrolment(this.#db, input));
	}

	/**
	 * Proves a step-up's own demand and, once proven, resumes the interaction it
	 * was demanded for — one call answers with the redirect a controller sends
	 * the browser to next.
	 *
	 * @param input - The interaction the proof is scoped to, the session it
	 * moves, and the code or recovery code submitted.
	 * @returns The authorization outcome the resumed interaction reaches once
	 * the step-up is proven, or why the step-up was refused.
	 */
	async completeStepUp(input: {
		interactionId: string;
		sessionId: string;
		submission: string;
		now?: number;
	}): Promise<
		WithCost<Exclude<CompleteStepUpResult, { ok: true }> | ({ ok: true } & AuthorizationOutcome)>
	> {
		await this.#migrated;

		return this.#withCost(async () => {
			let sealKey = await this.#sealKey();
			let now = input.now ?? Date.now();

			let proven = await Totp.completeStepUp(this.#db, sealKey, { ...input, now });
			if (!proven.ok) return proven;

			let issuer = await this.#issuer();
			let outcome = await Authorization.resumeAuthorization(this.#db, {
				interactionId: input.interactionId,
				sessionId: input.sessionId,
				now,
				issuer,
			});

			return { ok: true, ...outcome };
		});
	}

	/**
	 * Moves a step-up straight through for a subject who just enrolled a fresh
	 * factor to answer it, then resumes the interaction the same way
	 * {@link completeStepUp} does.
	 *
	 * @param input - The interaction and session the step-up moves past.
	 * @returns The authorization outcome the resumed interaction reaches, or
	 * that the session no longer resolves.
	 */
	async completeStepUpViaEnrolment(input: {
		interactionId: string;
		sessionId: string;
		now?: number;
	}): Promise<
		WithCost<
			| Exclude<CompleteStepUpViaEnrolmentResult, { ok: true }>
			| ({ ok: true } & AuthorizationOutcome)
		>
	> {
		await this.#migrated;

		return this.#withCost(async () => {
			let now = input.now ?? Date.now();

			let moved = await Totp.completeStepUpViaEnrolment(this.#db, {
				sessionId: input.sessionId,
				now,
			});
			if (!moved.ok) return moved;

			let issuer = await this.#issuer();
			let outcome = await Authorization.resumeAuthorization(this.#db, {
				interactionId: input.interactionId,
				sessionId: input.sessionId,
				now,
				issuer,
			});

			return { ok: true, ...outcome };
		});
	}

	/**
	 * Reads the tenant's password policy.
	 *
	 * @returns The minimum length, denied terms, expiry interval and history depth
	 * currently in force.
	 */
	async describePasswordPolicy(): Promise<WithCost<PasswordPolicy>> {
		await this.#migrated;
		return this.#withCost(() => Passwords.describePasswordPolicy(this.#db));
	}

	/**
	 * Sets a subject's password, enforcing policy and refusing a reuse.
	 *
	 * @param input - The subject, the candidate password, and who is asking.
	 * @returns The new row's id and expiry, or which policy rule refused the candidate.
	 */
	async setPassword(input: SetPasswordInput): Promise<WithCost<SetPasswordResult>> {
		await this.#migrated;
		return this.#withCost(() => Passwords.setPassword(this.#db, input));
	}

	/**
	 * Verifies a subject's current password and replaces it.
	 *
	 * @param input - The subject, its current password, and the replacement.
	 * @returns The new row's id and expiry, or why the change was refused.
	 */
	async changePassword(input: ChangePasswordInput): Promise<WithCost<ChangePasswordResult>> {
		await this.#migrated;
		return this.#withCost(() => Passwords.changePassword(this.#db, input));
	}

	/**
	 * Verifies a password sign-in and reports what is owed, without opening a session.
	 *
	 * @param input - The identifier as typed, and the candidate password.
	 * @returns The subject and what it still owes, or why sign-in was refused.
	 */
	async signInWithPassword(
		input: SignInWithPasswordInput,
	): Promise<WithCost<SignInWithPasswordResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let [{ cap, hard }, mfaPolicy] = await Promise.all([
				this.#dauEnforcement(),
				this.#mfaPolicy(),
			]);
			return Passwords.signInWithPassword(
				this.#db,
				input,
				{ cache: this.#dauCache, cap, hard },
				mfaPolicy,
			);
		});
	}

	/**
	 * Mints a password reset ticket for the address a subject signs in with.
	 *
	 * @param input - The identifier as typed.
	 * @returns The plaintext ticket to deliver, and the address to deliver it to.
	 */
	async beginPasswordReset(
		input: BeginPasswordResetInput,
	): Promise<WithCost<BeginPasswordResetResult>> {
		await this.#migrated;
		return this.#withCost(() => Passwords.beginPasswordReset(this.#db, input));
	}

	/**
	 * Spends a password reset ticket and writes the new password it authorized.
	 *
	 * @param input - The ticket as delivered, and the new password it authorizes.
	 * @returns The subject and the new row's id, or why the reset was refused.
	 */
	async completePasswordReset(
		input: CompletePasswordResetInput,
	): Promise<WithCost<CompletePasswordResetResult>> {
		await this.#migrated;
		return this.#withCost(() => Passwords.completePasswordReset(this.#db, input));
	}

	/**
	 * Marks a subject's current password as owing a change.
	 *
	 * @param input - The subject, and why the reset is being forced.
	 * @returns The row now marked, and the reason recorded, or why nothing was marked.
	 */
	async forcePasswordReset(
		input: ForcePasswordResetInput,
	): Promise<WithCost<ForcePasswordResetResult>> {
		await this.#migrated;
		return this.#withCost(() => Passwords.forcePasswordReset(this.#db, input));
	}

	/**
	 * Removes a subject's password, refusing to take its last remaining credential.
	 *
	 * @param input - The subject to remove the password from.
	 * @returns Success, or why the removal was refused.
	 */
	async removePassword(input: { subjectId: string }): Promise<WithCost<RemovePasswordResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let hasOtherCredential = await hasAnotherCredential(this.#db, input.subjectId, {
				kind: "password",
			});

			return Passwords.removePassword(this.#db, input, hasOtherCredential);
		});
	}

	/**
	 * Starts a passkey registration ceremony for an existing subject.
	 *
	 * @param input - The subject enrolling a credential, and the relying party id and
	 * origins the Worker resolved for this tenant.
	 * @returns The ceremony id to round-trip and the options to send to the browser, or
	 * that no such subject exists.
	 */
	async beginPasskeyRegistration(
		input: BeginPasskeyRegistrationInput,
	): Promise<WithCost<BeginPasskeyRegistrationResult>> {
		await this.#migrated;
		return this.#withCost(() => Passkeys.beginPasskeyRegistration(this.#db, input));
	}

	/**
	 * Spends a registration ceremony's challenge and stores the credential it verifies.
	 *
	 * @param input - The ceremony id, the browser's response, an optional label, the
	 * enrolling request's `User-Agent`, and the relying party id and origins the Worker
	 * resolved.
	 * @returns The stored credential's public fields, or which check refused it.
	 */
	async enrolPasskey(input: EnrolPasskeyInput): Promise<WithCost<EnrolPasskeyResult>> {
		await this.#migrated;
		return this.#withCost(() => Passkeys.enrolPasskey(this.#db, input));
	}

	/**
	 * Starts a usernameless passkey authentication ceremony.
	 *
	 * @param input - The relying party id and origins the Worker resolved for this
	 * tenant.
	 * @returns The ceremony id to round-trip and the options to send to the browser.
	 */
	async beginPasskeyAuthentication(
		input: BeginPasskeyAuthenticationInput,
	): Promise<WithCost<BeginPasskeyAuthenticationResult>> {
		await this.#migrated;
		return this.#withCost(() => Passkeys.beginPasskeyAuthentication(this.#db, input));
	}

	/**
	 * Verifies a passkey assertion and reports the credential it proved, without
	 * opening a session.
	 *
	 * @param input - The ceremony id, the browser's response, and the relying party id
	 * and origins the Worker resolved.
	 * @returns The subject and credential the assertion proved, or which check refused
	 * it.
	 */
	async signInWithPasskey(
		input: SignInWithPasskeyInput,
	): Promise<WithCost<SignInWithPasskeyResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let { cap, hard } = await this.#dauEnforcement();
			return Passkeys.signInWithPasskey(this.#db, input, { cache: this.#dauCache, cap, hard });
		});
	}

	/**
	 * Renames a passkey, scoped to the subject it belongs to.
	 *
	 * @param input - The subject, the credential to rename, and its new label.
	 * @returns Success, or that no such credential exists for this subject.
	 */
	async renamePasskey(input: {
		subjectId: string;
		credentialId: string;
		label: string;
	}): Promise<WithCost<RenamePasskeyResult>> {
		await this.#migrated;
		return this.#withCost(() => Passkeys.renamePasskey(this.#db, input));
	}

	/**
	 * Removes a passkey, scoped to the subject it belongs to, refusing to take its last
	 * remaining credential.
	 *
	 * @param input - The subject and the credential to revoke.
	 * @returns Success, or that no such credential exists, or that it is the subject's
	 * last remaining credential.
	 */
	async revokePasskey(input: {
		subjectId: string;
		credentialId: string;
	}): Promise<WithCost<RevokePasskeyResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let hasOtherCredential = await hasAnotherCredential(this.#db, input.subjectId, {
				kind: "passkey",
				credentialId: input.credentialId,
			});

			return Passkeys.revokePasskey(this.#db, input, hasOtherCredential);
		});
	}

	/**
	 * The daily retention sweep: releases unverified identifiers whose ticket is gone or
	 * expired and whose row has sat unproven for a week, clears expired passkey
	 * ceremonies, clears expired TOTP enrolments, stale replay claims and expired
	 * trusted devices, deletes sessions past their absolute expiry, deletes client secrets
	 * past their rotation window, deletes pending interactions past their ten-minute
	 * window, deletes authorization codes left unredeemed past their sixty seconds or
	 * redeemed long enough ago that a replay is no longer worth recognizing, deletes
	 * refresh tokens whose family is past its ninety-day ceiling, deletes connection
	 * sign-in transactions past their ten-minute window and handoff tickets past
	 * their thirty seconds, then arms tomorrow's run.
	 *
	 * Never rejects, the way a Durable Object alarm should not: a rejected alarm is
	 * retried by the platform, which would repeat a sweep that already ran.
	 */
	override async alarm(): Promise<void> {
		try {
			await this.#migrated;
			await Subjects.sweepUnverifiedIdentifiers(this.#db);
			await Passkeys.sweepExpiredPasskeyChallenges(this.#db);
			await Totp.sweepTotpState(this.#db);

			/**
			 * One alarm a day against a batch-bounded sweep: keep sweeping while a batch
			 * came back full, capped so a pathological backlog cannot hold the alarm open
			 * indefinitely — the remainder waits for tomorrow's run instead.
			 */
			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await Sessions.sweepExpiredSessions(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await Clients.sweepExpiredClientSecrets(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await Authorization.sweepExpiredAuthorizationRequests(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await Authorization.sweepExpiredAuthorizationCodes(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await Tokens.sweepExpiredRefreshTokens(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await ConnectionSignIn.sweepExpiredConnectionTransactions(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await ConnectionSignIn.sweepExpiredConnectionHandoffs(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await SamlSignIn.sweepExpiredSamlTransactions(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await SamlConnections.sweepExpiredAssertionIds(this.#db);
				if (!more) break;
			}
		} catch (error) {
			console.error("retention sweep failed", error);
		} finally {
			await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS).catch(() => undefined);
		}
	}

	/**
	 * Resolves a bearer token to the session it authenticates.
	 *
	 * @param input - The token as the cookie carried it, and the resolving request's
	 * origin.
	 * @returns The session's subject, methods and clocks when it is live, or which
	 * refusal applies.
	 */
	async resolveSession(input: ResolveSessionInput): Promise<WithCost<ResolveSessionResult>> {
		await this.#migrated;
		return this.#withCost(() => Sessions.resolveSession(this.#db, input));
	}

	/**
	 * Lists a page of a subject's live sessions, newest first.
	 *
	 * @param input - The subject whose sessions to list, the caller's own session id,
	 * and where to page from.
	 * @returns A page of session summaries, or that the given cursor no longer matches.
	 */
	async listSubjectSessions(
		input: ListSubjectSessionsInput,
	): Promise<WithCost<ListSubjectSessionsResult>> {
		await this.#migrated;
		return this.#withCost(() => Sessions.listSubjectSessions(this.#db, input));
	}

	/**
	 * Revokes one session, scoped to the subject it must belong to.
	 *
	 * @param input - The subject, the session to revoke, and why.
	 * @returns Success, or that no such session exists for this subject.
	 */
	async revokeSession(input: {
		subjectId: string;
		sessionId: string;
		reason: string;
	}): Promise<WithCost<RevokeSessionResult>> {
		await this.#migrated;
		return this.#withCost(() => Sessions.revokeSession(this.#db, input));
	}

	/**
	 * Revokes every live session a subject holds, optionally sparing one.
	 *
	 * @param input - The subject, why, and a session id to leave standing.
	 * @returns How many sessions were revoked.
	 */
	async revokeSubjectSessions(
		input: RevokeSubjectSessionsInput,
	): Promise<WithCost<RevokeSubjectSessionsResult>> {
		await this.#migrated;
		return this.#withCost(() => Sessions.revokeSubjectSessions(this.#db, input));
	}

	/**
	 * Validates and writes a new client record, minting its first secret when it is
	 * confidential.
	 *
	 * @param input - The whole record to register.
	 * @returns The new record and the one-time plaintext secret, or which rule refused
	 * the record.
	 */
	async registerClient(input: RegisterClientInput): Promise<WithCost<RegisterClientResult>> {
		await this.#migrated;
		return this.#withCost(() => Clients.registerClient(this.#db, input));
	}

	/**
	 * Replaces a client's editable fields as one set, refusing a change to `kind`.
	 *
	 * @param input - The client to update and its whole new editable record.
	 * @returns The updated record, or which rule refused the update.
	 */
	async updateClient(input: UpdateClientInput): Promise<WithCost<UpdateClientResult>> {
		await this.#migrated;
		return this.#withCost(() => Clients.updateClient(this.#db, input));
	}

	/**
	 * Mints a successor secret and opens the overlap on the incumbent in one call.
	 *
	 * @param input - The client to rotate, and how many days the incumbent's window
	 * lasts.
	 * @returns The new secret and when the incumbent now expires, or why rotation was
	 * refused.
	 */
	async rotateClientSecret(
		input: RotateClientSecretInput,
	): Promise<WithCost<RotateClientSecretResult>> {
		await this.#migrated;
		return this.#withCost(() => Clients.rotateClientSecret(this.#db, input));
	}

	/**
	 * Closes one secret's window immediately, refusing to take a confidential client's
	 * last live secret.
	 *
	 * @param input - The client the secret belongs to, and the secret to revoke.
	 * @returns Success, or why the revocation was refused.
	 */
	async revokeClientSecret(
		input: RevokeClientSecretInput,
	): Promise<WithCost<RevokeClientSecretResult>> {
		await this.#migrated;
		return this.#withCost(() => Clients.revokeClientSecret(this.#db, input));
	}

	/**
	 * Marks a client disabled, stopping it from authorizing.
	 *
	 * @param input - The client to disable.
	 * @returns Success, or that no such client exists.
	 */
	async disableClient(input: { clientId: string }): Promise<WithCost<DisableClientResult>> {
		await this.#migrated;
		return this.#withCost(() => Clients.disableClient(this.#db, input));
	}

	/**
	 * Deletes a client and its secrets.
	 *
	 * @param input - The client to delete.
	 * @returns Success, or that no such client exists.
	 */
	async deleteClient(input: { clientId: string }): Promise<WithCost<DeleteClientResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			await this.#db.deleteMany(Consent.grants, { where: { client_id: input.clientId } });

			return Clients.deleteClient(this.#db, input);
		});
	}

	/**
	 * Lists a page of the tenant's clients, newest first.
	 *
	 * @param input - Where to page from.
	 * @returns A page of client summaries, or that the given cursor no longer matches.
	 */
	async listClients(input: ListClientsInput = {}): Promise<WithCost<ListClientsResult>> {
		await this.#migrated;
		return this.#withCost(() => Clients.listClients(this.#db, input));
	}

	/**
	 * Validates and writes a social identity provider connection's whole
	 * configuration: resolves a catalog entry or a from-scratch shape, validates
	 * every mapping's target, seals the client secret when one is given, and
	 * claims the slug.
	 *
	 * `input.callbackOrigin` names the tenant's own platform subdomain, not
	 * whatever host currently serves as `iss` — a custom domain attached later
	 * changes the issuer this object records in `settings`, while the callback a
	 * provider was told about must stay put for the tenant's life. The caller
	 * (which already knows the control plane's own slug and platform domain)
	 * supplies it; this object has no way to tell the two hosts apart once an
	 * issuer has moved, since `settings` only ever remembers the current one.
	 *
	 * @param input - The whole connection to save, including the platform
	 * subdomain origin the callback URL is built against.
	 * @returns The connection's public record and the callback URL to register
	 * with the provider, or which rule refused the save.
	 */
	async saveConnection(input: SaveConnectionInput): Promise<WithCost<SaveConnectionResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let sealKey = await this.#sealKey();
			return Connections.saveConnection(this.#db, sealKey, input);
		});
	}

	/**
	 * Turns a connection on or off, refusing to enable one with no client secret
	 * sealed yet.
	 *
	 * @param input - The connection's slug, and whether it should now be enabled.
	 * @returns The connection's public record, or why the change was refused.
	 */
	async setConnectionEnabled(input: {
		slug: string;
		enabled: boolean;
	}): Promise<WithCost<SetConnectionEnabledResult>> {
		await this.#migrated;
		return this.#withCost(() => Connections.setConnectionEnabled(this.#db, input));
	}

	/**
	 * Removes a connection and its mappings.
	 *
	 * @param input - The connection's slug, and whether a referencing identity
	 * may be unlinked rather than block the removal.
	 * @returns Success, or that no such connection exists.
	 */
	async removeConnection(input: {
		slug: string;
		unlinkIdentities: boolean;
	}): Promise<WithCost<RemoveConnectionResult>> {
		await this.#migrated;
		return this.#withCost(() => Connections.removeConnection(this.#db, input));
	}

	/**
	 * Writes an enterprise connection's whole configuration, generating the
	 * service provider's key pair and certificate the first time so the
	 * identifiers an identity provider is configured with are fixed from then on.
	 *
	 * @param input - The connection to save; the platform-subdomain origin its
	 * identifiers are built against is filled in here rather than asked of a caller.
	 * @returns What an identity provider is configured from, or which rule refused
	 * the save.
	 */
	async saveEnterpriseConnection(
		input: Omit<SaveEnterpriseConnectionInput, "callbackOrigin">,
	): Promise<WithCost<SaveEnterpriseConnectionResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let [sealKey, issuer] = await Promise.all([this.#sealKey(), this.#issuer()]);
			return SamlConnections.saveEnterpriseConnection(this.#db, sealKey, {
				...input,
				callbackOrigin: issuer,
			});
		});
	}

	/**
	 * Turns an enterprise connection on or off, enabling one only once it holds a
	 * sign-on endpoint and a certificate inside its own window.
	 *
	 * @param input - The connection's slug, and whether it should now be enabled.
	 * @returns The connection's public record, or which rule refused the change.
	 */
	async setEnterpriseConnectionEnabled(input: {
		slug: string;
		enabled: boolean;
	}): Promise<WithCost<SetEnterpriseConnectionEnabledResult>> {
		await this.#migrated;
		return this.#withCost(() => SamlConnections.setEnterpriseConnectionEnabled(this.#db, input));
	}

	/**
	 * Re-reads an identity provider's metadata into a connection, replacing its
	 * endpoints and adding certificates, so a rotation needs no coordination.
	 *
	 * @param input - The connection's slug and the metadata document as fetched.
	 * @returns How many certificates the document carried and how many were retired.
	 */
	async refreshConnectionMetadata(input: {
		slug: string;
		metadataXml: string;
	}): Promise<WithCost<RefreshConnectionMetadataResult>> {
		await this.#migrated;
		return this.#withCost(() => SamlConnections.refreshConnectionMetadata(this.#db, input));
	}

	/**
	 * The metadata document an identity provider is handed for one connection.
	 *
	 * @param input - The connection's slug.
	 * @returns The document and the identifiers it describes, or that no such
	 * SAML connection exists.
	 */
	async describeSamlServiceProvider(input: {
		slug: string;
	}): Promise<WithCost<DescribeSamlServiceProviderResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let issuer = await this.#issuer();
			return SamlConnections.describeSamlServiceProvider(this.#db, {
				slug: input.slug,
				callbackOrigin: issuer,
			});
		});
	}

	/**
	 * Starts a sign-in against an enterprise connection, answering the redirect a
	 * controller sends the browser to next.
	 *
	 * @param input - The connection, and the pending authorization request and
	 * hostname the sign-in answers back to.
	 * @returns The provider's sign-on URL, or which rule refused the start.
	 */
	async beginSamlSignIn(
		input: Omit<BeginSamlSignInInput, "callbackOrigin">,
	): Promise<WithCost<BeginSamlSignInResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let [sealKey, issuer] = await Promise.all([this.#sealKey(), this.#issuer()]);
			return SamlSignIn.beginSamlSignIn(this.#db, sealKey, {
				...input,
				callbackOrigin: issuer,
			});
		});
	}

	/**
	 * Verifies a posted SAML response and opens a session from it, counting the
	 * sign-in against this tenant's daily active user meter the same way every
	 * other credential path does. The whole check runs here, where the
	 * certificates, the private key and the replay table already are.
	 *
	 * @param input - The connection, the decoded response the browser posted,
	 * the relay state naming the transaction, and the request's `User-Agent`.
	 * @returns The subject signed in and the ticket that hands the session back,
	 * or why the assertion was refused.
	 */
	async signInWithSamlResponse(
		input: Omit<SignInWithSamlResponseInput, "callbackOrigin">,
	): Promise<WithCost<SignInWithSamlResponseResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let [sealKey, issuer, { cap, hard }] = await Promise.all([
				this.#sealKey(),
				this.#issuer(),
				this.#dauEnforcement(),
			]);

			return SamlSignIn.signInWithSamlResponse(
				this.#db,
				sealKey,
				{ ...input, callbackOrigin: issuer },
				{ cache: this.#dauCache, cap, hard },
			);
		});
	}

	/**
	 * Every enabled connection's public record, the read a sign-in page renders
	 * its provider buttons from.
	 *
	 * @returns Every enabled connection, oldest first.
	 */
	async describeConnections(
		input: DescribeConnectionsInput = {},
	): Promise<WithCost<DescribeConnectionsResult>> {
		await this.#migrated;
		return this.#withCost(() => Connections.describeConnections(this.#db, input));
	}

	/**
	 * Starts a sign-in against a connection's provider, answering the redirect a
	 * controller sends the browser to next.
	 *
	 * @param input - The connection, the pending authorization request and
	 * hostname the callback answers back to, and any extra scopes or `prompt`.
	 * @returns The provider's authorization URL, or that no such enabled
	 * connection exists, or that its kind has no sign-in flow yet.
	 */
	async beginConnectionSignIn(
		input: BeginConnectionSignInInput,
	): Promise<WithCost<BeginConnectionSignInResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let sealKey = await this.#sealKey();
			return ConnectionSignIn.beginConnectionSignIn(this.#db, sealKey, input);
		});
	}

	/**
	 * Spends a connection's callback and opens a session for the subject it
	 * resolves to, counting the sign-in against this tenant's daily active user
	 * meter the same way every other credential path does.
	 *
	 * @param input - The connection, the callback URL exactly as the browser
	 * reached it, and the request's `User-Agent`.
	 * @returns The resolved subject, the hostname to hand the browser back to, and
	 * the handoff ticket to redirect there with, or which check refused the
	 * callback.
	 */
	async completeConnectionSignIn(
		input: CompleteConnectionSignInInput,
	): Promise<WithCost<CompleteConnectionSignInResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let [sealKey, { cap, hard }] = await Promise.all([this.#sealKey(), this.#dauEnforcement()]);

			return ConnectionSignIn.completeConnectionSignIn(this.#db, sealKey, input, {
				cache: this.#dauCache,
				cap,
				hard,
			});
		});
	}

	/**
	 * Spends a completed sign-in's handoff ticket and resumes the pending
	 * authorization request it was answering — one call answers with the redirect
	 * a controller sends the browser to next, the same composition
	 * {@link completeStepUp} runs for its own proof.
	 *
	 * @param input - The ticket as the redirect carried it, the hostname the
	 * resume request landed on, and the request's `User-Agent`.
	 * @returns The session token to set as the browser's cookie alongside the
	 * authorization outcome the resumed interaction reaches, or that the ticket is
	 * unknown, already spent, expired, or named a different hostname.
	 */
	async resumeConnectionSignIn(
		input: ResumeConnectionSignInInput,
	): Promise<
		WithCost<
			| { ok: false; reason: "invalid-ticket" }
			| ({ ok: true; sessionToken: string } & AuthorizationOutcome)
		>
	> {
		await this.#migrated;

		return this.#withCost(async () => {
			let spent = await ConnectionSignIn.resumeConnectionSignIn(this.#db, input);
			if (!spent.ok) return spent;

			let issuer = await this.#issuer();
			let outcome = await Authorization.resumeAuthorization(this.#db, {
				interactionId: spent.authorizationRequestId ?? "",
				sessionId: spent.sessionId,
				now: Date.now(),
				issuer,
			});

			return { ok: true, sessionToken: spent.sessionToken, ...outcome };
		});
	}

	/**
	 * Decides what a consent screen should show for one authorization request.
	 *
	 * @param input - The subject and client an authorization request named, the scopes
	 * it asked for, whether the client is first-party, and whether consent or silence
	 * was demanded.
	 * @returns The decision, with the assembled screen only when one is shown.
	 */
	async evaluateConsent(input: EvaluateConsentInput): Promise<WithCost<EvaluateConsentResult>> {
		await this.#migrated;
		return this.#withCost(() => Consent.evaluateConsent(this.#db, input));
	}

	/**
	 * Records the decision a person took on a consent screen.
	 *
	 * @param input - The subject and client the decision concerns, whether it was an
	 * approval, and the scopes it covers.
	 * @returns The full resulting scope set on approval, or that nothing was recorded.
	 */
	async recordConsentDecision(
		input: RecordConsentDecisionInput,
	): Promise<WithCost<RecordConsentDecisionResult>> {
		await this.#migrated;
		return this.#withCost(() => Consent.recordConsentDecision(this.#db, input));
	}

	/**
	 * Revokes a subject's standing grant for one client.
	 *
	 * @param input - The subject and client whose grant to revoke.
	 * @returns That the grant was revoked, or that no such grant existed.
	 */
	async revokeGrant(input: {
		subjectId: string;
		clientId: string;
	}): Promise<WithCost<RevokeGrantResult>> {
		await this.#migrated;
		return this.#withCost(() => Consent.revokeGrant(this.#db, input));
	}

	/**
	 * Lists a page of a subject's own grants, most recently agreed to first.
	 *
	 * @param input - The subject whose grants to list, and where to page from.
	 * @returns A page of grant summaries, or that the given cursor no longer matches.
	 */
	async listGrants(input: ListGrantsInput): Promise<WithCost<ListGrantsResult>> {
		await this.#migrated;
		return this.#withCost(() => Consent.listGrants(this.#db, input));
	}

	/**
	 * Validates an `/authorize` request, resolves whichever of the caller's candidate
	 * sessions applies, evaluates consent and mints a code, all as one operation.
	 *
	 * @param input - The request's raw query parameters, the caller's candidate session
	 * ids, and the clock to validate and decide against.
	 * @returns The outcome this request reaches on its own: a rendered or redirected
	 * error, a redirected code, or a parked interaction for a sign-in or consent page.
	 */
	async beginAuthorization(
		input: Omit<BeginAuthorizationInput, "issuer">,
	): Promise<WithCost<AuthorizationOutcome>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let issuer = await this.#issuer();
			return Authorization.beginAuthorization(this.#db, { ...input, issuer });
		});
	}

	/**
	 * Continues a parked interaction with the session its caller asserts just
	 * authenticated.
	 *
	 * @param input - The interaction to resume, the session that authenticated it, and
	 * the clock to decide against.
	 * @returns The outcome this resumption reaches on its own, the same as
	 * {@link beginAuthorization} answers with.
	 */
	async resumeAuthorization(
		input: Omit<ResumeAuthorizationInput, "issuer">,
	): Promise<WithCost<AuthorizationOutcome>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let issuer = await this.#issuer();
			return Authorization.resumeAuthorization(this.#db, { ...input, issuer });
		});
	}

	/**
	 * Performs every signing-key rotation transition due at the given time.
	 *
	 * @param input - The clock to advance the rotation against.
	 * @returns The key set now published for this tenant.
	 */
	async advanceSigningKeys(
		input: AdvanceSigningKeysInput = {},
	): Promise<WithCost<PublishedKeySet>> {
		await this.#migrated;
		return this.#withCost(() => SigningKeys.advanceSigningKeys(this.#db, input));
	}

	/**
	 * Re-renders the tenant's currently published key set, for refilling a KV entry that
	 * is missing or being repaired.
	 *
	 * @param input - The clock a row's publish window is measured against.
	 * @returns The key set currently published for this tenant.
	 */
	async publishKeySet(input: PublishKeySetInput = {}): Promise<WithCost<PublishedKeySet>> {
		await this.#migrated;
		return this.#withCost(() => SigningKeys.publishKeySet(this.#db, input));
	}

	/**
	 * Replaces the tenant's whole set of declared custom claims in one write.
	 *
	 * @param input - The full set of claims the tenant now declares.
	 * @returns Success, or which rule refused the call.
	 */
	async setCustomClaims(input: SetCustomClaimsInput): Promise<WithCost<SetCustomClaimsResult>> {
		await this.#migrated;
		return this.#withCost(() => SigningKeys.setCustomClaims(this.#db, input));
	}

	/**
	 * Turns an authorization code into a token set: authenticates the client,
	 * redeems the code, verifies its bindings and PKCE challenge, mints and
	 * signs, and starts a refresh token family when the grant covers
	 * `offline_access`.
	 *
	 * @param input - The presented code and verifier, the redirect the client
	 * used, the client's credentials, and the clock to mint against.
	 * @returns The minted token set, or the error this exchange was refused for.
	 */
	async exchangeCode(input: Omit<ExchangeCodeInput, "issuer">): Promise<WithCost<TokenOutcome>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let issuer = await this.#issuer();
			return Tokens.exchangeCode(this.#db, { ...input, issuer });
		});
	}

	/**
	 * Rotates a refresh token into a fresh token set, refusing a second
	 * presentation of the same token by revoking its whole family and ending the
	 * session behind it.
	 *
	 * @param input - The presented refresh token, an optional narrower scope,
	 * the client's credentials, and the clock to mint against.
	 * @returns The minted token set, or the error this rotation was refused for.
	 */
	async refreshTokens(input: Omit<RefreshTokensInput, "issuer">): Promise<WithCost<TokenOutcome>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let issuer = await this.#issuer();
			return Tokens.refreshTokens(this.#db, { ...input, issuer });
		});
	}

	/**
	 * Renders the OpenID configuration, the OAuth authorization server metadata, and the
	 * JWKS document in one call.
	 *
	 * @param input - The clock the key set's publish window is measured against.
	 * @returns Both metadata documents, the published key set, a version a caller can
	 * compare against what it has cached, and how long the documents may be cached for.
	 */
	async publishMetadata(input: { now: number }): Promise<WithCost<PublishMetadataResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let issuer = await this.#issuer();
			return Metadata.publishMetadata(this.#db, { ...input, issuer });
		});
	}

	/**
	 * Assembles the claims a subject's granted scopes carry for `/userinfo`.
	 *
	 * @param input - The subject id a verified access token named, and the scopes its
	 * grant covers.
	 * @returns The subject's claims, or that the subject id no longer resolves.
	 */
	async resolveUserInfo(input: ResolveUserInfoInput): Promise<WithCost<ResolveUserInfoResult>> {
		await this.#migrated;
		return this.#withCost(() => Metadata.resolveUserInfo(this.#db, input));
	}

	/**
	 * Writes this tenant's enforcement record — the DAU cap and audit retention
	 * window its plan now allows — as one whole operation, called from the
	 * control plane's projection write.
	 *
	 * @param input - The plan, its features, the DAU cap and audit retention
	 * window it now enforces, and when this took effect.
	 * @returns The plan now enforced, and how many audit rows the new
	 * retention window pruned.
	 */
	async applyEntitlements(
		input: ApplyEntitlementsInput,
	): Promise<WithCost<ApplyEntitlementsResult>> {
		await this.#migrated;
		return this.#withCost(() => applyEntitlements(this.#db, input));
	}

	/**
	 * Closes one day of the daily active user meter, for the control plane's own
	 * scheduled job to fold into `tenant_usage_day`. Safe to call twice: an
	 * already-closed day answers the figures already stored.
	 *
	 * @param input - The day to close.
	 * @returns The closed day's subject, session and token counts.
	 */
	async closeMeteringDay(input: CloseMeteringDayInput): Promise<WithCost<DailyUsage>> {
		await this.#migrated;
		return this.#withCost(() => closeMeteringDay(this.#db, input));
	}

	/**
	 * Reads the day rows a tenant's usage chart is built from.
	 *
	 * @param input - The inclusive day range to read.
	 * @returns Each day in range that has a row, oldest first.
	 */
	async readUsage(input: ReadUsageInput): Promise<WithCost<DailyUsage[]>> {
		await this.#migrated;
		return this.#withCost(() => readUsage(this.#db, input));
	}

	/**
	 * A page of this tenant's audit log over a time window, for the dashboard and
	 * the management API to share as a single call per page.
	 *
	 * @param input - The inclusive time window to read, optional filters, and
	 * where to page from.
	 * @returns A page of rows and the cursors around them, or that the given
	 * cursor no longer matches this ordering.
	 */
	async readAuditPage(input: ReadAuditPageInput): Promise<WithCost<ReadAuditPageResult>> {
		await this.#migrated;
		return this.#withCost(() => readAuditPage(this.#db, input));
	}

	/**
	 * Deletes audit rows older than this tenant's own retention window, at most
	 * `limit` per call, for the scheduled sweep to call repeatedly.
	 *
	 * @param input - How many rows one call may remove, and the clock to
	 * measure the window against.
	 * @returns How many rows this call deleted, and the oldest row still on hand.
	 */
	async enforceAuditRetention(
		input: { now?: number; limit?: number } = {},
	): Promise<WithCost<EnforceAuditRetentionResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let retentionDays = await this.#auditRetentionDays();
			return enforceAuditRetention(this.#db, { retentionDays, now: input.now, limit: input.limit });
		});
	}

	/**
	 * Rows after a durable position, for the streaming and export add-on this
	 * contributes to. Nothing calls this yet.
	 *
	 * @param input - The position already drained, and how many rows one call
	 * may return.
	 * @returns Rows after that position, and the position to resume from next.
	 */
	async drainAuditEvents(input: DrainAuditEventsInput): Promise<WithCost<DrainAuditEventsResult>> {
		await this.#migrated;
		return this.#withCost(() => drainAuditEvents(this.#db, input));
	}

	/**
	 * Row counts per table this object owns, plus the database's total size — the whole
	 * of what the daily storage sweep needs to model this tenant's storage footprint in
	 * one call.
	 *
	 * @returns Every table's own row count, keyed by table name, and the database's
	 * size in bytes.
	 */
	async reportStorageFootprint(): Promise<WithCost<StorageFootprint>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let tables: Record<string, AnyTable> = {
				settings,
				subjects: Subjects.subjects,
				subject_identifiers: Subjects.subjectIdentifiers,
				subject_attributes: Subjects.subjectAttributes,
				attribute_definitions: Subjects.attributeDefinitions,
				passwords: Passwords.passwords,
				password_policy: Passwords.passwordPolicy,
				password_reset_tickets: Passwords.passwordResetTickets,
				passkeys: Passkeys.passkeys,
				passkey_challenges: Passkeys.passkeyChallenges,
				sessions: Sessions.sessions,
				signing_keys: SigningKeys.signingKeys,
				custom_claims: SigningKeys.customClaims,
				clients: Clients.clients,
				client_secrets: Clients.clientSecrets,
				connections: Connections.connections,
				connection_mappings: Connections.connectionMappings,
				connection_transactions: Connections.connectionTransactions,
				connection_identities: ConnectionSignIn.connectionIdentities,
				connection_handoffs: ConnectionSignIn.connectionHandoffs,
				connection_saml: SamlConnections.connectionSaml,
				connection_certificates: SamlConnections.connectionCertificates,
				saml_assertion_ids: SamlConnections.samlAssertionIds,
				saml_transactions: SamlSignIn.samlTransactions,
				scopes: Consent.scopes,
				grants: Consent.grants,
				authorization_requests: Authorization.authorizationRequests,
				authorization_codes: Authorization.authorizationCodes,
				refresh_tokens: Tokens.refreshTokenRows,
				mail_send_envelopes: mailSendEnvelopes,
				entitlement_enforcement: entitlementEnforcement,
				dau_seen: dauSeen,
				dau_day: dauDay,
				audit_events: auditEvents,
				totp_enrolments: Totp.totpEnrolments,
				totp_factors: Totp.totpFactors,
				totp_claims: Totp.totpClaims,
				totp_stepup_claims: Totp.totpStepUpClaims,
				recovery_codes: Totp.recoveryCodes,
				trusted_devices: Totp.trustedDevices,
			};

			let rows: Record<string, number> = {};
			for (let [name, ref] of Object.entries(tables)) {
				rows[name] = await this.#db.count(ref);
			}

			return { rows, databaseSize: this.ctx.storage.sql.databaseSize };
		});
	}
}
