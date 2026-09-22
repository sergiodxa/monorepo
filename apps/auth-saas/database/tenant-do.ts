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

import type { AnyTable, TableRow } from "remix/data-table";

import { importKey } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure } from "@sdxc/result";
import { DurableObject } from "cloudflare:workers";
import { column as c, Database, isNull, table } from "remix/data-table";

import type {
	ApiKeyVerificationCache,
	AuthenticateApiKeyInput,
	AuthenticateApiKeyResult,
	CreateApiKeyInput,
	CreateApiKeyResult,
	ListApiKeysInput,
	ListApiKeysResult,
	ReadApiKeyResult,
	RevokeApiKeyInput,
	RevokeApiKeyResult,
	RotateApiKeyInput,
	RotateApiKeyResult,
	SetApiKeyPrefixInput,
	SetApiKeyPrefixResult,
	SweepExpiredApiKeysInput,
	SweepExpiredApiKeysResult,
} from "./api-keys";
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
	ReadClientResult,
	RegisterClientInput,
	RegisterClientResult,
	RevokeClientSecretInput,
	RevokeClientSecretResult,
	RotateClientSecretInput,
	RotateClientSecretResult,
	SetClientPermissionClaimInput,
	SetClientPermissionClaimResult,
	UpdateClientInput,
	UpdateClientResult,
} from "./clients";
import type {
	AdoptIdentityAddressInput,
	AdoptIdentityAddressResult,
	BeginConnectionSignInInput,
	BeginConnectionSignInResult,
	CompleteConnectionSignInInput,
	CompleteConnectionSignInResult,
	LinkIdentityInput,
	LinkIdentityResult,
	ResumeConnectionSignInInput,
	UnlinkIdentityInput,
	UnlinkIdentityResult,
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
import type {
	BeginDeviceApprovalInput,
	BeginDeviceApprovalResult,
	BeginDeviceAuthorizationInput,
	BeginDeviceAuthorizationResult,
	DecideDeviceApprovalInput,
	DecideDeviceApprovalResult,
	RedeemDeviceCodeInput,
} from "./device-authorization";
import type { ApplyEntitlementsInput, ApplyEntitlementsResult } from "./entitlements";
import type {
	BeginMagicLinkSignInInput,
	BeginMagicLinkSignInResult,
	CancelMagicLinkAttemptInput,
	CompleteMagicLinkSignInInput,
	CompleteMagicLinkSignInResult,
} from "./magic-link";
import type {
	PublishMetadataResult,
	ResolveUserInfoInput,
	ResolveUserInfoResult,
} from "./metadata";
import type { CloseMeteringDayInput, DailyUsage, DauCache, ReadUsageInput } from "./metering";
import type {
	AcceptOrganizationInvitationInput,
	AcceptOrganizationInvitationResult,
	AddOrganizationDomainInput,
	AddOrganizationDomainResult,
	ApplyDomainMembershipInput,
	ApplyDomainMembershipResult,
	ConfirmOrganizationDomainInput,
	ConfirmOrganizationDomainResult,
	CreateOrganizationInput,
	CreateOrganizationResult,
	DeleteOrganizationInput,
	DeleteOrganizationResult,
	DescribeOrganizationDomainInput,
	DescribeOrganizationDomainResult,
	DescribeSubjectOrganizationsInput,
	InviteToOrganizationInput,
	InviteToOrganizationResult,
	ReadOrganizationMemberPageInput,
	ReadOrganizationMemberPageResult,
	RemoveMembershipInput,
	RemoveMembershipResult,
	RevokeOrganizationInvitationInput,
	RevokeOrganizationInvitationResult,
	SetActiveOrganizationInput,
	SetActiveOrganizationResult,
	SetMembershipRoleInput,
	SetMembershipRoleResult,
	SubjectOrganizationSummary,
	UpdateOrganizationInput,
	UpdateOrganizationResult,
} from "./organizations";
import type {
	BeginPasskeyAuthenticationInput,
	BeginPasskeyAuthenticationResult,
	BeginPasskeyRegistrationInput,
	BeginPasskeyRegistrationResult,
	EnrolPasskeyInput,
	EnrolPasskeyResult,
	ListPasskeysInput,
	ListPasskeysResult,
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
	ClearAuthenticationBackoffInput,
	ClearAuthenticationBackoffResult,
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
	AssignRoleInput,
	AssignRoleResult,
	AuthorizeSubjectInput,
	AuthorizeSubjectResult,
	DefinePermissionInput,
	DefinePermissionResult,
	DefineRoleInput,
	DefineRoleResult,
	DeleteRoleInput,
	DeleteRoleResult,
	DescribeSubjectAccessInput,
	ListPermissionsResult,
	ListRolesInput,
	ListRolesResult,
	RemovePermissionInput,
	RemovePermissionResult,
	SetRolePermissionsInput,
	SetRolePermissionsResult,
	SubjectAccessSummary,
	UpdateRoleInput,
	UpdateRoleResult,
} from "./roles";
import type {
	DescribeSamlServiceProviderResult,
	RefreshConnectionMetadataResult,
	ResolveOrganizationConnectionResult,
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
	CreateScimConnectionInput,
	CreateScimConnectionResult,
	DeleteScimConnectionResult,
	DescribeScimConnectionsInput,
	MapScimGroupInput,
	MapScimGroupResult,
	RotateScimTokenInput,
	RotateScimTokenResult,
	ScimDeleteGroupInput,
	ScimDeleteGroupResult,
	ScimDeleteUserInput,
	ScimDeleteUserResult,
	ScimPatchGroupInput,
	ScimPatchGroupResult,
	ScimPatchUserInput,
	ScimPatchUserResult,
	ScimProvisionGroupInput,
	ScimProvisionGroupResult,
	ScimProvisionUserInput,
	ScimProvisionUserResult,
	ScimReadGroupInput,
	ScimReadGroupPageInput,
	ScimReadGroupPageResult,
	ScimReadGroupResult,
	ScimReadUserInput,
	ScimReadUserPageInput,
	ScimReadUserPageResult,
	ScimReadUserResult,
	ScimReplaceGroupInput,
	ScimReplaceGroupResult,
	ScimReplaceUserInput,
	ScimReplaceUserResult,
} from "./scim";
import type {
	EffectiveSessionPolicy,
	SessionPolicyInput,
	SessionsAfterCredentialChange,
	StoredSessionPolicy,
} from "./session-policy";
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
import type { ExportSubjectPageInput, ExportSubjectPageResult } from "./subject-export";
import type { ImportRowOutcome, ImportSubjectRow } from "./subject-import";
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
	ListSubjectsInput,
	ListSubjectsResult,
	RemoveAttributeResult,
	RemoveIdentifierResult,
	SetPrimaryIdentifierResult,
	SubjectProfile,
	UnblockSubjectResult,
	UpdateSubjectResult,
	VerifyIdentifierResult,
} from "./subjects";
import type {
	AuthenticateClientInput,
	AuthenticateClientResult,
	ExchangeCodeInput,
	IssueClientCredentialsTokenInput,
	RefreshTokensInput,
	TokenOutcome,
} from "./tokens";
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
import type {
	ClaimDueDeliveriesInput,
	ClaimDueDeliveriesResult,
	PrepareDeliveryInput,
	PrepareDeliveryResult,
	ReadDeliveryPageInput,
	ReadDeliveryPageResult,
	ReplayDeliveryInput,
	ReplayDeliveryResult,
	SettleDeliveryInput,
	SettleDeliveryResult,
	SweepWebhookDeliveriesResult,
} from "./webhook-deliveries";
import type {
	DeleteWebhookEndpointInput,
	DeleteWebhookEndpointResult,
	ListWebhookEndpointsInput,
	ListWebhookEndpointsResult,
	ReadWebhookEndpointResult,
	RegisterWebhookEndpointInput,
	RegisterWebhookEndpointResult,
	RotateEndpointSecretInput,
	RotateEndpointSecretResult,
	UpdateWebhookEndpointInput,
	UpdateWebhookEndpointResult,
} from "./webhook-endpoints";

import * as ApiKeys from "./api-keys";
import {
	auditEvents,
	drainAuditEvents,
	enforceAuditRetention,
	readAuditPage,
	writeAuditEvent,
} from "./audit-events";
import { DEFAULT_FAILURE_THRESHOLD } from "./authentication-backoff";
import * as Authorization from "./authorization";
import * as Clients from "./clients";
import * as ConnectionSignIn from "./connection-sign-in";
import * as Connections from "./connections";
import * as Consent from "./consent";
import { hasAnotherCredential } from "./credentials";
import * as DeviceAuthorization from "./device-authorization";
import { applyEntitlements, entitlementEnforcement } from "./entitlements";
import * as MagicLink from "./magic-link";
import { mailSendEnvelopes } from "./mail-rate-limit";
import * as Metadata from "./metadata";
import { closeMeteringDay, createDauCache, dauDay, dauSeen, readUsage } from "./metering";
import * as Organizations from "./organizations";
import * as Passkeys from "./passkeys";
import * as Passwords from "./passwords";
import * as Roles from "./roles";
import * as SamlConnections from "./saml-connections";
import * as SamlSignIn from "./saml-sign-in";
import * as Scim from "./scim";
import {
	CONCURRENT_SESSION_LIMIT_CEILING,
	CONCURRENT_SESSION_LIMIT_DEFAULT,
	CONCURRENT_SESSION_LIMIT_FLOOR,
	effectiveSessionPolicy,
	REFRESH_TOKEN_LIFETIME_CEILING_MS,
	REFRESH_TOKEN_LIFETIME_DEFAULT_MS,
	REFRESH_TOKEN_LIFETIME_FLOOR_MS,
	SESSION_ABSOLUTE_LIFETIME_CEILING_MS,
	SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
	SESSION_ABSOLUTE_LIFETIME_FLOOR_MS,
	SESSION_IDLE_LIFETIME_DEFAULT_MS,
	SESSION_IDLE_LIFETIME_FLOOR_MS,
	SESSIONS_AFTER_CREDENTIAL_CHANGE_DEFAULT,
	validateSessionPolicyInput,
} from "./session-policy";
import * as Sessions from "./sessions";
import * as SigningKeys from "./signing-keys";
import { projectsWithinStorageCeiling } from "./storage-ceiling";
import { exportSubjectPage } from "./subject-export";
import { applyImportRow, completeImportRun, validateImportRow } from "./subject-import";
import * as Subjects from "./subjects";
import { runMigrations } from "./tenant-migrations";
import * as Tokens from "./tokens";
import * as Totp from "./totp";
import * as WebhookDeliveries from "./webhook-deliveries";
import * as WebhookEndpoints from "./webhook-endpoints";

/** The entitlement feature slug session policy customization is sold under, the exact key {@link ApplyEntitlementsInput.features} carries it as. */
const SESSION_POLICY_FEATURE = "session_policy";

/** One row: the tenant id this object is addressed by, its issuer, its MFA policy, its authentication failure threshold, its session policy customizations, and its creation time. */
const settings = table({
	name: "settings",
	primaryKey: ["tenant_id"],
	columns: {
		tenant_id: c.text(),
		issuer: c.text(),
		mfa_policy: c.enum(["optional", "required"] as const).default("optional"),
		failure_threshold: c.integer().default(4),
		/** `null` means "not customized, use the platform default" — see `session-policy.ts`. */
		session_absolute_lifetime_ms: c.integer().nullable(),
		session_idle_lifetime_ms: c.integer().nullable(),
		refresh_token_lifetime_ms: c.integer().nullable(),
		concurrent_session_limit: c.integer().nullable(),
		sessions_after_credential_change: c.enum(["revoke-others", "revoke-all"] as const).nullable(),
		magic_link_jit_subject_creation: c.boolean().default(false),
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
 * Counts this tenant's live sessions whose next resolve would compute an earlier
 * expiry under `nextPolicy` than it would have under `currentPolicy` — the same
 * earlier-of-two-instants comparison `resolveSession` itself runs, evaluated against
 * both policies at once so `setSessionPolicy` can report the shortening it is about to
 * make before the tenant confirms it.
 *
 * @param db - The tenant's database.
 * @param currentPolicy - The effective policy in force before this write.
 * @param nextPolicy - The effective policy this write is about to put in force.
 * @returns How many live sessions would resolve with an earlier expiry under `nextPolicy`.
 */
async function countSessionsShortenedBy(
	db: Database,
	currentPolicy: EffectiveSessionPolicy,
	nextPolicy: EffectiveSessionPolicy,
): Promise<number> {
	let live = await db.findMany(Sessions.sessions, { where: isNull("revoked_at") });

	let shortened = 0;

	for (let row of live) {
		let expiryUnder = (policy: EffectiveSessionPolicy): number =>
			Math.min(
				Math.min(row.expires_at, row.created_at + policy.absoluteLifetimeMs),
				Math.min(row.idle_expires_at, row.last_seen_at + policy.idleLifetimeMs),
			);

		if (expiryUnder(nextPolicy) < expiryUnder(currentPolicy)) shortened++;
	}

	return shortened;
}

/**
 * Whether a session policy field's currently effective value is the platform default
 * or the tenant's own stored customization — the same tighten-only comparison
 * `effectiveSessionPolicy` runs for that one field, reported back for `describeSessionPolicy`
 * to render "which of the two is in force" without duplicating that comparison.
 *
 * @param stored - The field as `settings` stores it; `null` means never customized.
 * @param hasEntitlement - Whether this tenant's plan currently entitles it to customize
 * session policy at all.
 * @param storedIsTighter - Whether `stored` (once entitlement has lapsed) would win the
 * tighten-only comparison against the platform default for this field.
 * @returns `"tenant"` when the stored value is what is actually in force, `"default"`
 * when the platform default is.
 */
function sessionPolicyFieldSource<value>(
	stored: value | null,
	hasEntitlement: boolean,
	storedIsTighter: (stored: value) => boolean,
): "default" | "tenant" {
	if (stored === null) return "default";
	if (hasEntitlement) return "tenant";
	return storedIsTighter(stored) ? "tenant" : "default";
}

/** One field as `describeSessionPolicy` reports it: its currently effective value, and whether that came from the platform default or the tenant's own customization. */
export interface SessionPolicyFieldSource<value> {
	value: value;
	source: "default" | "tenant";
}

/** The platform bounds `describeSessionPolicy` reports alongside the effective values, so a caller can render the range a write may choose within. */
export interface SessionPolicyBounds {
	absoluteLifetimeMs: { floor: number; ceiling: number; default: number };
	/** `ceiling` is the absolute lifetime currently in force for this tenant, not a fixed number. */
	idleLifetimeMs: { floor: number; ceiling: number; default: number };
	refreshTokenLifetimeMs: { floor: number; ceiling: number; default: number };
	concurrentSessionLimit: { floor: number; ceiling: number; default: number | null };
	sessionsAfterCredentialChange: {
		values: readonly ["revoke-others", "revoke-all"];
		default: SessionsAfterCredentialChange;
	};
}

/** What `describeSessionPolicy` answers: the effective value and its source for every field, and the platform bounds a caller renders alongside them. */
export interface DescribeSessionPolicyResult {
	absoluteLifetimeMs: SessionPolicyFieldSource<number>;
	idleLifetimeMs: SessionPolicyFieldSource<number>;
	refreshTokenLifetimeMs: SessionPolicyFieldSource<number>;
	concurrentSessionLimit: SessionPolicyFieldSource<number | null>;
	sessionsAfterCredentialChange: SessionPolicyFieldSource<SessionsAfterCredentialChange>;
	bounds: SessionPolicyBounds;
}

/** What `setSessionPolicy` answers once a write is accepted: the stored policy that resulted, and how many live sessions the new values shorten. */
export type SetSessionPolicyResult =
	| { ok: true; policy: StoredSessionPolicy; sessionsShortened: number }
	| { ok: false; field: string; message: string };

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

	/**
	 * This isolate's own map from an API key's id to the facts that verify it,
	 * updated by the same call that revokes or rotates a key so a change lands
	 * at once. Never persisted: an object evicted and rebuilt starts it empty
	 * again, paying one storage read the next time each key is presented.
	 */
	#apiKeyCache: ApiKeyVerificationCache = new Map();

	/** Every statement's own row counts, accumulated by `countingSqlStorage` and read and reset around each RPC call by `#withCost`. */
	#counters: CostCounters = { rowsRead: 0, rowsWritten: 0 };

	/**
	 * This isolate's own copy of the tenant's one `settings` row, read once per
	 * instance by {@link #settings} and invalidated by the one method that writes
	 * it — a Durable Object is the only writer of its own settings, so the read
	 * costs nothing per request once it has run the first time. Never persisted:
	 * an object evicted and rebuilt starts it empty again, paying one storage
	 * read the next time any of `#issuer`, `#mfaPolicy`, `#failureThreshold` or
	 * `#effectiveSessionPolicy` needs the row.
	 */
	#settingsRow: TableRow<typeof settings> | null = null;

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

		this.#settingsRow = null;

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

	/**
	 * This tenant's one `settings` row, read from storage once per instance and
	 * held from then on — `#issuer`, `#mfaPolicy`, `#failureThreshold` and
	 * `#effectiveSessionPolicy` all read the same row through this one cache
	 * rather than issuing their own separate reads of it, and `setMfaPolicy` and
	 * `setSessionPolicy` — the two methods that write it — invalidate the cache
	 * in the same call that writes. A tenant that has never provisioned has no
	 * row at all, which every reader here already treats as its own set of
	 * defaults.
	 */
	async #settings(): Promise<TableRow<typeof settings> | null> {
		if (this.#settingsRow === null) {
			let rows = await this.#db.findMany(settings);
			this.#settingsRow = rows[0] ?? null;
		}

		return this.#settingsRow;
	}

	/** This tenant's own issuer, as `provision` recorded it, for stamping onto an error redirect. */
	async #issuer(): Promise<string> {
		let row = await this.#settings();
		return row?.issuer ?? "";
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
	 * Whether this tenant's own enforcement record currently entitles a named feature,
	 * read locally from `entitlement_enforcement` — the same record
	 * {@link #dauEnforcement} and {@link #auditRetentionDays} already read for their own
	 * caps — rather than a further RPC round trip. A tenant whose record has never been
	 * written entitles nothing.
	 */
	async #isEntitled(feature: string): Promise<boolean> {
		let record = await this.#db.findOne(entitlementEnforcement, { where: { id: "current" } });
		return record?.features[feature] ?? false;
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
		let row = await this.#settings();
		return row?.mfa_policy ?? "optional";
	}

	/** This tenant's own authentication failure threshold, read from `settings`. A tenant that has never provisioned enforces 4. */
	async #failureThreshold(): Promise<number> {
		let row = await this.#settings();
		return row?.failure_threshold ?? DEFAULT_FAILURE_THRESHOLD;
	}

	/** Whether this tenant lets an address with no matching subject mint a magic-link attempt anyway, read from `settings`. A tenant that has never provisioned enforces off. */
	async #magicLinkJitSubjectCreationEnabled(): Promise<boolean> {
		let row = await this.#settings();
		return row?.magic_link_jit_subject_creation ?? false;
	}

	/**
	 * This tenant's own effective session policy: every field it stored, honored
	 * exactly once its plan entitles `session_policy`, or the tighter of that
	 * value and the platform default once it does not — see
	 * `session-policy.ts`'s own `effectiveSessionPolicy` for the comparison
	 * itself. Reads the same cached `settings` row `#mfaPolicy` and
	 * `#failureThreshold` already share, and the same entitlement record
	 * `#dauEnforcement` and `#auditRetentionDays` already share.
	 */
	async #effectiveSessionPolicy(): Promise<EffectiveSessionPolicy> {
		let [row, hasEntitlement] = await Promise.all([
			this.#settings(),
			this.#isEntitled(SESSION_POLICY_FEATURE),
		]);

		return effectiveSessionPolicy({
			stored: {
				sessionAbsoluteLifetimeMs: row?.session_absolute_lifetime_ms ?? null,
				sessionIdleLifetimeMs: row?.session_idle_lifetime_ms ?? null,
				refreshTokenLifetimeMs: row?.refresh_token_lifetime_ms ?? null,
				concurrentSessionLimit: row?.concurrent_session_limit ?? null,
				sessionsAfterCredentialChange: row?.sessions_after_credential_change ?? null,
			},
			hasEntitlement,
		});
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
	 * Lists a page of the tenant's subjects, newest first, each with the
	 * identifiers currently marked primary.
	 *
	 * @param input - Where to page from, and an optional status to filter on.
	 * @returns A page of subject summaries, or that the given cursor no longer matches.
	 */
	async listSubjects(input: ListSubjectsInput = {}): Promise<WithCost<ListSubjectsResult>> {
		await this.#migrated;
		return this.#withCost(() => Subjects.listSubjects(this.#db, input));
	}

	/**
	 * Assembles everything one account screen renders for a subject, including
	 * its TOTP factor, recovery codes, trusted devices, and every connection it
	 * has linked an identity through.
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
			let [secondFactor, identities] = await Promise.all([
				Totp.describeSecondFactor(this.#db, input.subjectId),
				ConnectionSignIn.describeLinkedIdentities(this.#db, input.subjectId),
			]);
			return Subjects.describeSubject(this.#db, input, secondFactor, identities);
		});
	}

	/**
	 * One page of the tenant's directory for export: every subject's identifiers,
	 * profile, declared attributes, role assignments and credentials metadata,
	 * paged the same keyset way `listSubjects` already pages a directory listing.
	 * A password hash rides along only when `includeCredentials` is true —
	 * deciding when that is allowed belongs to whatever calls this method, not
	 * to this object.
	 *
	 * @param input - Where to page from, how many subjects to a page, and
	 * whether to carry each subject's own password hash.
	 * @returns A page of export rows and the cursors around it, or that the
	 * given cursor no longer matches this ordering.
	 */
	async exportSubjectPage(
		input: ExportSubjectPageInput,
	): Promise<WithCost<ExportSubjectPageResult>> {
		await this.#migrated;
		return this.#withCost(() => exportSubjectPage(this.#db, input));
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
			let row = await this.#settings();
			if (row) {
				await this.#db.update(settings, { tenant_id: row.tenant_id }, { mfa_policy: input.policy });
				this.#settingsRow = null;
			}
			return { ok: true } as const;
		});
	}

	/**
	 * Sets whether this tenant lets an address with no matching subject mint a
	 * magic-link attempt anyway, the subject created only once that attempt
	 * completes.
	 *
	 * @param input - Whether to allow it from now on.
	 * @returns Success, once the setting is written.
	 */
	async setMagicLinkJitSubjectCreation(input: {
		enabled: boolean;
	}): Promise<WithCost<{ ok: true }>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let row = await this.#settings();
			if (row) {
				await this.#db.update(
					settings,
					{ tenant_id: row.tenant_id },
					{ magic_link_jit_subject_creation: input.enabled },
				);
				this.#settingsRow = null;
			}
			return { ok: true } as const;
		});
	}

	/**
	 * Validates and writes a partial update to this tenant's session policy — a field
	 * left out of `input.policy` leaves that column untouched, the single-field-at-a-time
	 * precedent {@link setMfaPolicy} already follows. Every given field is bounds-checked
	 * against the platform's own ranges before anything is written; the idle timeout's own
	 * ceiling is whichever absolute lifetime this same write leaves in force. The
	 * entitlement that gates who may call this at all is the caller's own concern, decided
	 * before this object is ever asked to perform the write.
	 *
	 * @param input - The fields to change, and who is changing them.
	 * @returns The stored policy once written and how many live sessions the new values
	 * shorten, or which field and bound refused the write.
	 */
	async setSessionPolicy(input: {
		policy: SessionPolicyInput;
		actor: AuditActor;
	}): Promise<WithCost<SetSessionPolicyResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let row = await this.#settings();
			if (!row) {
				return {
					ok: false,
					field: "tenantId",
					message: "the tenant has not been provisioned yet",
				} as const;
			}

			let currentStored: StoredSessionPolicy = {
				sessionAbsoluteLifetimeMs: row.session_absolute_lifetime_ms,
				sessionIdleLifetimeMs: row.session_idle_lifetime_ms,
				refreshTokenLifetimeMs: row.refresh_token_lifetime_ms,
				concurrentSessionLimit: row.concurrent_session_limit,
				sessionsAfterCredentialChange: row.sessions_after_credential_change,
			};

			let currentAbsoluteLifetimeMs =
				currentStored.sessionAbsoluteLifetimeMs ?? SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS;

			let validated = validateSessionPolicyInput({
				policy: input.policy,
				currentAbsoluteLifetimeMs,
			});
			if (!validated.ok) return validated;

			let nextStored: StoredSessionPolicy = {
				sessionAbsoluteLifetimeMs:
					input.policy.absoluteLifetimeMs ?? currentStored.sessionAbsoluteLifetimeMs,
				sessionIdleLifetimeMs: input.policy.idleLifetimeMs ?? currentStored.sessionIdleLifetimeMs,
				refreshTokenLifetimeMs:
					input.policy.refreshTokenLifetimeMs ?? currentStored.refreshTokenLifetimeMs,
				concurrentSessionLimit:
					input.policy.concurrentSessionLimit !== undefined
						? input.policy.concurrentSessionLimit
						: currentStored.concurrentSessionLimit,
				sessionsAfterCredentialChange:
					input.policy.sessionsAfterCredentialChange ?? currentStored.sessionsAfterCredentialChange,
			};

			let hasEntitlement = await this.#isEntitled(SESSION_POLICY_FEATURE);
			let currentEffective = effectiveSessionPolicy({ stored: currentStored, hasEntitlement });
			let nextEffective = effectiveSessionPolicy({ stored: nextStored, hasEntitlement });

			let sessionsShortened = await countSessionsShortenedBy(
				this.#db,
				currentEffective,
				nextEffective,
			);

			await this.#db.update(
				settings,
				{ tenant_id: row.tenant_id },
				{
					session_absolute_lifetime_ms: nextStored.sessionAbsoluteLifetimeMs,
					session_idle_lifetime_ms: nextStored.sessionIdleLifetimeMs,
					refresh_token_lifetime_ms: nextStored.refreshTokenLifetimeMs,
					concurrent_session_limit: nextStored.concurrentSessionLimit,
					sessions_after_credential_change: nextStored.sessionsAfterCredentialChange,
				},
			);
			this.#settingsRow = null;

			let fields: Array<[keyof StoredSessionPolicy, string]> = [
				["sessionAbsoluteLifetimeMs", "absoluteLifetimeMs"],
				["sessionIdleLifetimeMs", "idleLifetimeMs"],
				["refreshTokenLifetimeMs", "refreshTokenLifetimeMs"],
				["concurrentSessionLimit", "concurrentSessionLimit"],
				["sessionsAfterCredentialChange", "sessionsAfterCredentialChange"],
			];

			let changed: Record<string, { from: unknown; to: unknown }> = {};
			for (let [storedKey, label] of fields) {
				if (currentStored[storedKey] !== nextStored[storedKey]) {
					changed[label] = { from: currentStored[storedKey], to: nextStored[storedKey] };
				}
			}

			await writeAuditEvent(this.#db, {
				action: "session_policy.changed",
				actor: input.actor,
				targetType: "tenant",
				targetId: row.tenant_id,
				outcome: "succeeded",
				detail: { changed },
			});

			return { ok: true, policy: nextStored, sessionsShortened };
		});
	}

	/**
	 * Reads this tenant's session policy: the effective values it currently enforces,
	 * whether each one is the platform default or the tenant's own stored customization,
	 * and the platform bounds a caller renders alongside them. Open on every tier — a
	 * tenant asking what its own session lifetimes are is asking about its own security
	 * posture, not exercising the paid capability to change them.
	 *
	 * @returns The effective policy, its per-field source, and the platform bounds.
	 */
	async describeSessionPolicy(
		input: Record<string, never> = {},
	): Promise<WithCost<DescribeSessionPolicyResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let [row, hasEntitlement] = await Promise.all([
				this.#settings(),
				this.#isEntitled(SESSION_POLICY_FEATURE),
			]);

			let stored: StoredSessionPolicy = {
				sessionAbsoluteLifetimeMs: row?.session_absolute_lifetime_ms ?? null,
				sessionIdleLifetimeMs: row?.session_idle_lifetime_ms ?? null,
				refreshTokenLifetimeMs: row?.refresh_token_lifetime_ms ?? null,
				concurrentSessionLimit: row?.concurrent_session_limit ?? null,
				sessionsAfterCredentialChange: row?.sessions_after_credential_change ?? null,
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement });

			return {
				absoluteLifetimeMs: {
					value: effective.absoluteLifetimeMs,
					source: sessionPolicyFieldSource(
						stored.sessionAbsoluteLifetimeMs,
						hasEntitlement,
						(value) => value < SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
					),
				},
				idleLifetimeMs: {
					value: effective.idleLifetimeMs,
					source: sessionPolicyFieldSource(
						stored.sessionIdleLifetimeMs,
						hasEntitlement,
						(value) => value < SESSION_IDLE_LIFETIME_DEFAULT_MS,
					),
				},
				refreshTokenLifetimeMs: {
					value: effective.refreshTokenLifetimeMs,
					source: sessionPolicyFieldSource(
						stored.refreshTokenLifetimeMs,
						hasEntitlement,
						(value) => value < REFRESH_TOKEN_LIFETIME_DEFAULT_MS,
					),
				},
				concurrentSessionLimit: {
					value: effective.concurrentSessionLimit,
					source: sessionPolicyFieldSource(
						stored.concurrentSessionLimit,
						hasEntitlement,
						() => true,
					),
				},
				sessionsAfterCredentialChange: {
					value: effective.sessionsAfterCredentialChange,
					source: sessionPolicyFieldSource(
						stored.sessionsAfterCredentialChange,
						hasEntitlement,
						(value) => value === "revoke-all",
					),
				},
				bounds: {
					absoluteLifetimeMs: {
						floor: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS,
						ceiling: SESSION_ABSOLUTE_LIFETIME_CEILING_MS,
						default: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
					},
					idleLifetimeMs: {
						floor: SESSION_IDLE_LIFETIME_FLOOR_MS,
						ceiling: effective.absoluteLifetimeMs,
						default: SESSION_IDLE_LIFETIME_DEFAULT_MS,
					},
					refreshTokenLifetimeMs: {
						floor: REFRESH_TOKEN_LIFETIME_FLOOR_MS,
						ceiling: REFRESH_TOKEN_LIFETIME_CEILING_MS,
						default: REFRESH_TOKEN_LIFETIME_DEFAULT_MS,
					},
					concurrentSessionLimit: {
						floor: CONCURRENT_SESSION_LIMIT_FLOOR,
						ceiling: CONCURRENT_SESSION_LIMIT_CEILING,
						default: CONCURRENT_SESSION_LIMIT_DEFAULT,
					},
					sessionsAfterCredentialChange: {
						values: ["revoke-others", "revoke-all"] as const,
						default: SESSIONS_AFTER_CREDENTIAL_CHANGE_DEFAULT,
					},
				},
			};
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
			let [sealKey, failureThreshold] = await Promise.all([
				this.#sealKey(),
				this.#failureThreshold(),
			]);
			return Totp.completeSecondFactor(this.#db, sealKey, input, failureThreshold);
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
			let [sealKey, failureThreshold] = await Promise.all([
				this.#sealKey(),
				this.#failureThreshold(),
			]);
			let now = input.now ?? Date.now();

			let proven = await Totp.completeStepUp(
				this.#db,
				sealKey,
				{ ...input, now },
				failureThreshold,
			);
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

		return this.#withCost(async () => {
			let { sessionsAfterCredentialChange } = await this.#effectiveSessionPolicy();
			return Passwords.changePassword(this.#db, input, sessionsAfterCredentialChange);
		});
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
			let [{ cap, hard }, mfaPolicy, failureThreshold, sessionPolicy] = await Promise.all([
				this.#dauEnforcement(),
				this.#mfaPolicy(),
				this.#failureThreshold(),
				this.#effectiveSessionPolicy(),
			]);
			return Passwords.signInWithPassword(
				this.#db,
				input,
				{ cache: this.#dauCache, cap, hard },
				mfaPolicy,
				true,
				failureThreshold,
				sessionPolicy,
			);
		});
	}

	/**
	 * Clears a subject's own authentication backoff: the failure count, the window it
	 * opened, and when it was last touched — an administrator's undo for a lockout the
	 * subject cannot lift on its own.
	 *
	 * @param input - The subject to clear, who is clearing it, and why.
	 * @returns Success, or that the subject holds no password row to clear.
	 */
	async clearAuthenticationBackoff(
		input: ClearAuthenticationBackoffInput,
	): Promise<WithCost<ClearAuthenticationBackoffResult>> {
		await this.#migrated;
		return this.#withCost(() => Passwords.clearAuthenticationBackoff(this.#db, input));
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
	 * Resolves an address, spends its two budgets, and mints a magic-link token and
	 * code bound to the asking browser.
	 *
	 * @param input - The address as typed, the locale to remember for delivery, the
	 * bound browser's nonce hash, and the clock to measure against.
	 * @returns The token, code and expiry to deliver, that no account matches, or
	 * how many seconds until the tighter of the two budgets next has room.
	 */
	async beginMagicLinkSignIn(
		input: BeginMagicLinkSignInInput,
	): Promise<WithCost<BeginMagicLinkSignInResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let jitSubjectCreationAllowed = await this.#magicLinkJitSubjectCreationEnabled();
			return MagicLink.beginMagicLinkSignIn(this.#db, input, jitSubjectCreationAllowed);
		});
	}

	/**
	 * Spends a magic-link token or code and opens a session for the subject it
	 * resolves to, creating it first when the attempt was minted for an address
	 * with none yet.
	 *
	 * @param input - The credential presented, the bound browser's raw nonce, and
	 * the clock to measure against.
	 * @returns The subject and the session opened for it, that the credential never
	 * resolved to a live attempt, that it resolved to one bound to a different
	 * browser, how many attempts a wrong code leaves, or that the daily cap refused
	 * this subject a session.
	 */
	async completeMagicLinkSignIn(
		input: CompleteMagicLinkSignInInput,
	): Promise<WithCost<CompleteMagicLinkSignInResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let [{ cap, hard }, sessionPolicy] = await Promise.all([
				this.#dauEnforcement(),
				this.#effectiveSessionPolicy(),
			]);

			return MagicLink.completeMagicLinkSignIn(
				this.#db,
				input,
				{ cache: this.#dauCache, cap, hard },
				sessionPolicy,
			);
		});
	}

	/**
	 * Abandons the outstanding magic-link attempt a browser's own nonce names.
	 *
	 * @param input - The bound browser's raw nonce.
	 * @returns Success, whether or not a matching attempt was found.
	 */
	async cancelMagicLinkAttempt(
		input: CancelMagicLinkAttemptInput,
	): Promise<WithCost<{ ok: true }>> {
		await this.#migrated;
		return this.#withCost(() => MagicLink.cancelMagicLinkAttempt(this.#db, input));
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
			let [{ cap, hard }, sessionPolicy] = await Promise.all([
				this.#dauEnforcement(),
				this.#effectiveSessionPolicy(),
			]);
			return Passkeys.signInWithPasskey(
				this.#db,
				input,
				{ cache: this.#dauCache, cap, hard },
				true,
				undefined,
				sessionPolicy,
			);
		});
	}

	/**
	 * Lists every passkey a subject holds, newest first.
	 *
	 * @param input - The subject whose credentials to list.
	 * @returns Every credential the subject holds, summarized for a credential list.
	 */
	async listPasskeys(input: ListPasskeysInput): Promise<WithCost<ListPasskeysResult>> {
		await this.#migrated;
		return this.#withCost(() => Passkeys.listPasskeys(this.#db, input));
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
	 * their thirty seconds, deletes organization invitations a week past their expiry
	 * that were never accepted or revoked, deletes API keys past their expiry, then
	 * arms tomorrow's run.
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
				let { more } = await DeviceAuthorization.sweepDeviceAuthorizations(this.#db);
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

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await Organizations.sweepExpiredOrganizationInvitations(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let { more } = await ApiKeys.sweepExpiredApiKeys(this.#db);
				if (!more) break;
			}

			for (let iteration = 0; iteration < 20; iteration++) {
				let retentionDays = await this.#auditRetentionDays();
				let { more } = await WebhookDeliveries.sweepWebhookDeliveries(this.#db, {
					retentionDays,
				});
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

		return this.#withCost(async () => {
			let policy = await this.#effectiveSessionPolicy();
			return Sessions.resolveSession(this.#db, input, policy);
		});
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
		actor?: AuditActor;
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

		return this.#withCost(async () => {
			if (input.grantTypes.includes("client_credentials")) {
				if (!(await this.#isEntitled(ApiKeys.MACHINE_ACCESS_FEATURE))) {
					return { ok: false, reason: "entitlement-required" };
				}
			}
			if (input.grantTypes.includes(DeviceAuthorization.DEVICE_CODE_GRANT_TYPE)) {
				if (!(await this.#isEntitled(DeviceAuthorization.DEVICE_GRANT_FEATURE))) {
					return { ok: false, reason: "entitlement-required" };
				}
			}
			return Clients.registerClient(this.#db, input);
		});
	}

	/**
	 * Replaces a client's editable fields as one set, refusing a change to `kind`.
	 *
	 * @param input - The client to update and its whole new editable record.
	 * @returns The updated record, or which rule refused the update.
	 */
	async updateClient(input: UpdateClientInput): Promise<WithCost<UpdateClientResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (input.grantTypes.includes("client_credentials")) {
				if (!(await this.#isEntitled(ApiKeys.MACHINE_ACCESS_FEATURE))) {
					return { ok: false, reason: "entitlement-required" };
				}
			}
			if (input.grantTypes.includes(DeviceAuthorization.DEVICE_CODE_GRANT_TYPE)) {
				if (!(await this.#isEntitled(DeviceAuthorization.DEVICE_GRANT_FEATURE))) {
					return { ok: false, reason: "entitlement-required" };
				}
			}
			return Clients.updateClient(this.#db, input);
		});
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
	 * Toggles whether minting adds a `permissions` claim to this client's tokens.
	 *
	 * @param input - The client whose switch is being set, its new value, and who
	 * is making the call.
	 * @returns The updated record, or that no such client exists.
	 */
	async setClientPermissionClaim(
		input: SetClientPermissionClaimInput,
	): Promise<WithCost<SetClientPermissionClaimResult>> {
		await this.#migrated;
		return this.#withCost(() => Clients.setClientPermissionClaim(this.#db, input));
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
	 * Reads one client's whole record.
	 *
	 * @param input - The client to read.
	 * @returns The client's record, or that no such client exists.
	 */
	async readClient(input: { clientId: string }): Promise<WithCost<ReadClientResult>> {
		await this.#migrated;
		return this.#withCost(() => Clients.readClient(this.#db, input));
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
	 * Mints a SCIM connection's bearer token, stores only its digest, and writes
	 * its starting record.
	 *
	 * @param input - The connection's name, its delete policy and whether it
	 * syncs groups, and who is creating it.
	 * @returns The connection's public record and the token to deliver once.
	 */
	async createScimConnection(
		input: CreateScimConnectionInput,
	): Promise<WithCost<CreateScimConnectionResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.createScimConnection(this.#db, input));
	}

	/**
	 * Mints a successor SCIM token and opens the 72-hour grace window on the
	 * outgoing one.
	 *
	 * @param input - The connection to rotate.
	 * @returns The new token and when the outgoing one now expires, or that no
	 * such connection exists.
	 */
	async rotateScimToken(input: RotateScimTokenInput): Promise<WithCost<RotateScimTokenResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.rotateScimToken(this.#db, input));
	}

	/**
	 * Removes a SCIM connection and everything scoped to it.
	 *
	 * @param input - The connection to remove.
	 * @returns Success, or that no such connection exists.
	 */
	async deleteScimConnection(input: {
		connectionId: string;
	}): Promise<WithCost<DeleteScimConnectionResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.deleteScimConnection(this.#db, input));
	}

	/**
	 * Every SCIM connection's public record, never the token digest.
	 *
	 * @returns Every connection, oldest first.
	 */
	async describeScimConnections(
		input: DescribeScimConnectionsInput = {},
	): Promise<WithCost<{ connections: Scim.ScimConnectionRecord[] }>> {
		await this.#migrated;
		return this.#withCost(() => Scim.describeScimConnections(this.#db, input));
	}

	/**
	 * Provisions a user from a directory connection: adopts a subject already
	 * carrying the resource's folded email, or mints a fresh one.
	 *
	 * @param input - The bearer token, the SCIM user resource, and the clock to
	 * write with.
	 * @returns The subject's representation and whether it was created, or
	 * which rule refused the call.
	 */
	async scimProvisionUser(
		input: ScimProvisionUserInput,
	): Promise<WithCost<ScimProvisionUserResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimProvisionUser(this.#db, input));
	}

	/**
	 * Replaces a user's mapped attributes wholesale, answering the current
	 * representation flagged unchanged and writing nothing when the resource's
	 * mapped digest already matches.
	 *
	 * @param input - The bearer token, the subject id, the replacement
	 * resource, and the clock to write with.
	 * @returns The current representation and whether anything changed, or
	 * which rule refused the call.
	 */
	async scimReplaceUser(input: ScimReplaceUserInput): Promise<WithCost<ScimReplaceUserResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimReplaceUser(this.#db, input));
	}

	/**
	 * Applies `replace`/`add` PATCH operations on named user attributes.
	 * `active: false` blocks the subject and revokes every session in the same
	 * call.
	 *
	 * @param input - The bearer token, the subject id, the operations to
	 * apply, and the clock to write with.
	 * @returns The updated representation, or which rule refused the call.
	 */
	async scimPatchUser(input: ScimPatchUserInput): Promise<WithCost<ScimPatchUserResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimPatchUser(this.#db, input));
	}

	/**
	 * Deletes a user per the connection's own policy: blocks and revokes its
	 * sessions, or retires the subject outright. A `deleted` outcome also
	 * clears the subject's passwords, passkeys, consent grants and second
	 * factor, the same cascade {@link deleteSubject} runs for its own caller.
	 *
	 * @param input - The bearer token, the subject id, and the clock to write
	 * with.
	 * @returns Which effect ran and the subject it ran against, or which rule
	 * refused the call.
	 */
	async scimDeleteUser(input: ScimDeleteUserInput): Promise<WithCost<ScimDeleteUserResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let result = await Scim.scimDeleteUser(this.#db, input);

			if (result.ok && result.action === "deleted") {
				let subjectId = result.subjectId;
				await this.#db.deleteMany(Passwords.passwords, { where: { subject_id: subjectId } });
				await this.#db.deleteMany(Passkeys.passkeys, { where: { subject_id: subjectId } });
				await this.#db.deleteMany(Consent.grants, { where: { subject_id: subjectId } });
				await this.#db.deleteMany(Totp.totpEnrolments, { where: { subject_id: subjectId } });
				await this.#db.deleteMany(Totp.totpFactors, { where: { subject_id: subjectId } });
				await this.#db.deleteMany(Totp.recoveryCodes, { where: { subject_id: subjectId } });
				await this.#db.deleteMany(Totp.trustedDevices, { where: { subject_id: subjectId } });
			}

			return result;
		});
	}

	/**
	 * Reads one user this connection provisioned.
	 *
	 * @param input - The bearer token and the subject id.
	 * @returns The user's representation, or which rule refused the call.
	 */
	async scimReadUser(input: ScimReadUserInput): Promise<WithCost<ScimReadUserResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimReadUser(this.#db, input));
	}

	/**
	 * A page of a SCIM connection's users, ordered by creation, with
	 * `totalResults` exact.
	 *
	 * @param input - The bearer token, an optional `attribute eq "value"`
	 * filter, and where to page from.
	 * @returns The page and its exact total, or which rule refused the call.
	 */
	async scimReadUserPage(input: ScimReadUserPageInput): Promise<WithCost<ScimReadUserPageResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimReadUserPage(this.#db, input));
	}

	/**
	 * Provisions a group, validating every member names an existing subject
	 * before writing anything.
	 *
	 * @param input - The bearer token, the SCIM group resource, and the clock
	 * to write with.
	 * @returns The group's representation, or which rule refused the call.
	 */
	async scimProvisionGroup(
		input: ScimProvisionGroupInput,
	): Promise<WithCost<ScimProvisionGroupResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimProvisionGroup(this.#db, input));
	}

	/**
	 * Replaces a group's display name and whole membership set.
	 *
	 * @param input - The bearer token, the group id, the replacement resource,
	 * and the clock to write with.
	 * @returns The updated representation, or which rule refused the call.
	 */
	async scimReplaceGroup(input: ScimReplaceGroupInput): Promise<WithCost<ScimReplaceGroupResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimReplaceGroup(this.#db, input));
	}

	/**
	 * Applies group PATCH operations: a plain `displayName` change, or a
	 * membership `add`/`remove`.
	 *
	 * @param input - The bearer token, the group id, the operations to apply,
	 * and the clock to write with.
	 * @returns The updated representation, or which rule refused the call.
	 */
	async scimPatchGroup(input: ScimPatchGroupInput): Promise<WithCost<ScimPatchGroupResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimPatchGroup(this.#db, input));
	}

	/**
	 * Deletes a group, its membership and its mappings, leaving the subjects
	 * that belonged to it exactly as they are.
	 *
	 * @param input - The bearer token, the group id, and the clock to write
	 * with.
	 * @returns Success, or which rule refused the call.
	 */
	async scimDeleteGroup(input: ScimDeleteGroupInput): Promise<WithCost<ScimDeleteGroupResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimDeleteGroup(this.#db, input));
	}

	/**
	 * Reads one group this connection provisioned.
	 *
	 * @param input - The bearer token and the group id.
	 * @returns The group's representation, or which rule refused the call.
	 */
	async scimReadGroup(input: ScimReadGroupInput): Promise<WithCost<ScimReadGroupResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimReadGroup(this.#db, input));
	}

	/**
	 * A page of a SCIM connection's groups, ordered by creation, with
	 * `totalResults` exact.
	 *
	 * @param input - The bearer token, an optional `attribute eq "value"`
	 * filter, and where to page from.
	 * @returns The page and its exact total, or which rule refused the call.
	 */
	async scimReadGroupPage(
		input: ScimReadGroupPageInput,
	): Promise<WithCost<ScimReadGroupPageResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.scimReadGroupPage(this.#db, input));
	}

	/**
	 * Records what a synced group stands for — a role, or an organization when
	 * that add-on is present — as plain data naming the target's kind and id.
	 *
	 * @param input - The connection and group being mapped, and the target it
	 * now stands for.
	 * @returns Success, or that no such group exists for this connection.
	 */
	async mapScimGroup(input: MapScimGroupInput): Promise<WithCost<MapScimGroupResult>> {
		await this.#migrated;
		return this.#withCost(() => Scim.mapScimGroup(this.#db, input));
	}

	/**
	 * Creates an organization and writes its creator's `owner` membership in
	 * the same call.
	 *
	 * @param input - The organization's name and slug, the subject creating
	 * it, and who is making the call.
	 * @returns The new organization's record, or which rule refused the call.
	 */
	async createOrganization(
		input: CreateOrganizationInput,
	): Promise<WithCost<CreateOrganizationResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.createOrganization(this.#db, input));
	}

	/**
	 * Updates an organization's name, logo and metadata, leaving any field
	 * left out exactly as it stood.
	 *
	 * @param input - The organization to update, the fields to change, and
	 * who is making the call.
	 * @returns The organization's record once updated, or that no such
	 * organization exists.
	 */
	async updateOrganization(
		input: UpdateOrganizationInput,
	): Promise<WithCost<UpdateOrganizationResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.updateOrganization(this.#db, input));
	}

	/**
	 * Removes an organization and everything scoped to it, clearing the
	 * active organization off every session naming it.
	 *
	 * @param input - The organization to remove, and who is making the call.
	 * @returns Success, or that no such organization exists.
	 */
	async deleteOrganization(
		input: DeleteOrganizationInput,
	): Promise<WithCost<DeleteOrganizationResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.deleteOrganization(this.#db, input));
	}

	/**
	 * Invites an address to join an organization, minting a bearer token
	 * stored only as its digest.
	 *
	 * @param input - The organization, the address and role being invited,
	 * and who is sending it.
	 * @returns The token to deliver once, with the address and locale to
	 * deliver it to, or which rule refused the call.
	 */
	async inviteToOrganization(
		input: InviteToOrganizationInput,
	): Promise<WithCost<InviteToOrganizationResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.inviteToOrganization(this.#db, input));
	}

	/**
	 * Revokes an open invitation, closing it to acceptance.
	 *
	 * @param input - The invitation to revoke, and who is making the call.
	 * @returns Success, or which rule refused the call.
	 */
	async revokeOrganizationInvitation(
		input: RevokeOrganizationInvitationInput,
	): Promise<WithCost<RevokeOrganizationInvitationResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.revokeOrganizationInvitation(this.#db, input));
	}

	/**
	 * Accepts an invitation once the signed-in subject's own verified email
	 * identifier matches the invited address; anyone else is refused without
	 * marking the invitation resolved.
	 *
	 * @param input - The bearer token, the subject accepting it, and the
	 * clock to write with.
	 * @returns The organization joined and the role granted, or which rule
	 * refused the call.
	 */
	async acceptOrganizationInvitation(
		input: AcceptOrganizationInvitationInput,
	): Promise<WithCost<AcceptOrganizationInvitationResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.acceptOrganizationInvitation(this.#db, input));
	}

	/**
	 * Changes a membership's role to whatever string the caller gives.
	 *
	 * @param input - The membership to change, its new role, and who is
	 * making the call.
	 * @returns The role now stored, or which rule refused the call.
	 */
	async setMembershipRole(
		input: SetMembershipRoleInput,
	): Promise<WithCost<SetMembershipRoleResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.setMembershipRole(this.#db, input));
	}

	/**
	 * Removes a membership and clears `active_organization_id` off the
	 * subject's own sessions naming this organization.
	 *
	 * @param input - The membership to remove, and who is making the call.
	 * @returns Success, or that no such membership exists.
	 */
	async removeMembership(input: RemoveMembershipInput): Promise<WithCost<RemoveMembershipResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.removeMembership(this.#db, input));
	}

	/**
	 * Sets the organization a session is acting for, once the subject's own
	 * membership and the session's own ownership both check out.
	 *
	 * @param input - The session to set it on, the subject it must belong
	 * to, and the organization to activate.
	 * @returns The organization now active, or which rule refused the call.
	 */
	async setActiveOrganization(
		input: SetActiveOrganizationInput,
	): Promise<WithCost<SetActiveOrganizationResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.setActiveOrganization(this.#db, input));
	}

	/**
	 * Claims a domain for an organization, minting a TXT record to publish.
	 *
	 * @param input - The organization claiming the domain, the domain
	 * itself, and whether it auto-joins or only suggests.
	 * @returns The TXT record name and value to publish, or which rule
	 * refused the call.
	 */
	async addOrganizationDomain(
		input: AddOrganizationDomainInput,
	): Promise<WithCost<AddOrganizationDomainResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.addOrganizationDomain(this.#db, input));
	}

	/**
	 * Marks a domain verified, trusting that the DNS lookup proving it
	 * already ran.
	 *
	 * @param input - The organization and domain now proven.
	 * @returns When the domain was marked verified, or that no such claimed
	 * domain exists.
	 */
	async confirmOrganizationDomain(
		input: ConfirmOrganizationDomainInput,
	): Promise<WithCost<ConfirmOrganizationDomainResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.confirmOrganizationDomain(this.#db, input));
	}

	/**
	 * Reads what a claimed domain expects to find published, for the
	 * Worker-side DNS lookup to check a real answer against.
	 *
	 * @param input - The organization and domain to describe.
	 * @returns The TXT record name and value this domain expects, and
	 * whether it is already verified, or that no such claimed domain exists.
	 */
	async describeOrganizationDomain(
		input: DescribeOrganizationDomainInput,
	): Promise<WithCost<DescribeOrganizationDomainResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.describeOrganizationDomain(this.#db, input));
	}

	/**
	 * Writes the memberships a subject's own verified email domains earn
	 * automatically, and answers the organizations it only suggests.
	 *
	 * @param input - The subject to resolve, and the clock to write with.
	 * @returns Every membership this call wrote, and every organization it
	 * suggests instead.
	 */
	async applyDomainMembership(
		input: ApplyDomainMembershipInput,
	): Promise<WithCost<ApplyDomainMembershipResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.applyDomainMembership(this.#db, input));
	}

	/**
	 * Every organization a subject belongs to, for a switcher UI.
	 *
	 * @param input - The subject to resolve.
	 * @returns Every membership the subject holds, most recently joined
	 * first.
	 */
	async describeSubjectOrganizations(
		input: DescribeSubjectOrganizationsInput,
	): Promise<WithCost<{ organizations: SubjectOrganizationSummary[] }>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.describeSubjectOrganizations(this.#db, input));
	}

	/**
	 * A page of an organization's members, most recently joined first.
	 *
	 * @param input - The organization to list, and where to page from.
	 * @returns A page of member summaries and the cursors around it, or that
	 * the given cursor no longer matches this ordering.
	 */
	async readOrganizationMemberPage(
		input: ReadOrganizationMemberPageInput,
	): Promise<WithCost<ReadOrganizationMemberPageResult>> {
		await this.#migrated;
		return this.#withCost(() => Organizations.readOrganizationMemberPage(this.#db, input));
	}

	/**
	 * Defines a tenant's own role at a scope, refusing a key that collides with
	 * one of the three the platform reserves or with a role this scope
	 * already has.
	 *
	 * @param input - The scope and key the role is defined at, its name and
	 * description, and who is defining it.
	 * @returns The new role's record, or which rule refused the call.
	 */
	async defineRole(input: DefineRoleInput): Promise<WithCost<DefineRoleResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(Roles.CUSTOM_ROLES_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return Roles.defineRole(this.#db, input);
		});
	}

	/**
	 * Updates a custom role's name and description, refusing a call naming one
	 * of the three system roles outright.
	 *
	 * @param input - The role to update, the fields to change, and who is
	 * making the call.
	 * @returns The role's record once updated, or which rule refused the call.
	 */
	async updateRole(input: UpdateRoleInput): Promise<WithCost<UpdateRoleResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(Roles.CUSTOM_ROLES_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return Roles.updateRole(this.#db, input);
		});
	}

	/**
	 * Deletes a custom role, reassigning every current holder to another role
	 * in the same call.
	 *
	 * @param input - The role to delete, the role its holders move to, and who
	 * is making the call.
	 * @returns How many holders were reassigned, or which rule refused the
	 * call.
	 */
	async deleteRole(input: DeleteRoleInput): Promise<WithCost<DeleteRoleResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(Roles.CUSTOM_ROLES_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return Roles.deleteRole(this.#db, input);
		});
	}

	/**
	 * Defines a tenant's own permission, refusing a key beginning `auth:` —
	 * reserved for this platform's own management-API permissions.
	 *
	 * @param input - The permission's key, name and description, and who is
	 * defining it.
	 * @returns The new permission's record, or which rule refused the call.
	 */
	async definePermission(input: DefinePermissionInput): Promise<WithCost<DefinePermissionResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(Roles.CUSTOM_ROLES_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return Roles.definePermission(this.#db, input);
		});
	}

	/**
	 * Removes a tenant's own permission, dropping every role's grant of it in
	 * the same call.
	 *
	 * @param input - The permission to remove, and who is making the call.
	 * @returns Success, or that no such permission exists.
	 */
	async removePermission(input: RemovePermissionInput): Promise<WithCost<RemovePermissionResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(Roles.CUSTOM_ROLES_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return Roles.removePermission(this.#db, input);
		});
	}

	/**
	 * Replaces a custom role's whole granted permission set, refusing one
	 * whose serialized form would exceed what a token's `permissions` claim
	 * may carry.
	 *
	 * @param input - The role to set, its whole new set of permission keys,
	 * and who is making the call.
	 * @returns The set now granted, or which rule refused the call.
	 */
	async setRolePermissions(
		input: SetRolePermissionsInput,
	): Promise<WithCost<SetRolePermissionsResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(Roles.CUSTOM_ROLES_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return Roles.setRolePermissions(this.#db, input);
		});
	}

	/**
	 * Assigns a role to a subject at a scope, replacing any role already held
	 * there. An organization-scope assignment writes through to
	 * `organization_members.role` rather than a `role_assignments` row.
	 *
	 * @param input - The subject, the scope the role is held at, the role's
	 * key, and who is making the call.
	 * @returns The role now held, or which rule refused the call.
	 */
	async assignRole(input: AssignRoleInput): Promise<WithCost<AssignRoleResult>> {
		await this.#migrated;
		return this.#withCost(() => Roles.assignRole(this.#db, input));
	}

	/**
	 * The role a subject holds at a scope and its resolved permission set, for
	 * one screen or one `/userinfo` response to render.
	 *
	 * @param input - The subject and scope to describe.
	 * @returns The held role (empty when none) and the permission keys it
	 * resolves to.
	 */
	async describeSubjectAccess(
		input: DescribeSubjectAccessInput,
	): Promise<WithCost<SubjectAccessSummary>> {
		await this.#migrated;
		return this.#withCost(() => Roles.describeSubjectAccess(this.#db, input));
	}

	/**
	 * Every role held at a scope, system roles first. Never gated: seeing
	 * what already exists is not the operation the `custom_roles`
	 * entitlement guards.
	 *
	 * @param input - The scope to list roles at.
	 * @returns Every role held at that scope, system roles first.
	 */
	async listRoles(input: ListRolesInput): Promise<WithCost<ListRolesResult>> {
		await this.#migrated;
		return this.#withCost(() => Roles.listRoles(this.#db, input));
	}

	/**
	 * Every permission this tenant has declared. Never gated, for the same
	 * reason {@link listRoles} is not.
	 *
	 * @returns Every permission this tenant has declared.
	 */
	async listPermissions(): Promise<WithCost<ListPermissionsResult>> {
		await this.#migrated;
		return this.#withCost(() => Roles.listPermissions(this.#db));
	}

	/**
	 * The single-decision check: does the role a subject holds at a scope
	 * grant a given permission.
	 *
	 * @param input - The subject, the scope, and the permission being asked
	 * for.
	 * @returns Whether the subject's held role grants it.
	 */
	async authorizeSubject(input: AuthorizeSubjectInput): Promise<WithCost<AuthorizeSubjectResult>> {
		await this.#migrated;
		return this.#withCost(() => Roles.authorizeSubject(this.#db, input));
	}

	/**
	 * Sets this tenant's own API key prefix, once. A call naming the prefix
	 * already in force is a no-op success; a call naming a different one is
	 * refused.
	 *
	 * @param input - The prefix to set, and who is making the call.
	 * @returns The prefix now in force, or which rule refused the call.
	 */
	async setApiKeyPrefix(input: SetApiKeyPrefixInput): Promise<WithCost<SetApiKeyPrefixResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(ApiKeys.MACHINE_ACCESS_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return ApiKeys.setApiKeyPrefix(this.#db, input);
		});
	}

	/**
	 * Mints an API key for one of this tenant's own end users, narrowing rather
	 * than creating an authorization: every requested scope must already be one
	 * the issuing subject holds.
	 *
	 * @param input - The subject the key acts as, its name, scopes and optional
	 * expiry, and who is making the call.
	 * @returns The new record and the one-time key value, or which rule refused
	 * the call.
	 */
	async createApiKey(input: CreateApiKeyInput): Promise<WithCost<CreateApiKeyResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(ApiKeys.MACHINE_ACCESS_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return ApiKeys.createApiKey(this.#db, input);
		});
	}

	/**
	 * Verifies a presented API key value, answering the subject and scopes it
	 * resolves to without opening a session. Counts the resolved subject toward
	 * today's daily active users, the same meter a sign-in counts against.
	 *
	 * @param input - The presented value, and the clock to check its expiry
	 * against.
	 * @returns The resolved subject and scopes, or which check refused it.
	 */
	async authenticateApiKey(
		input: AuthenticateApiKeyInput,
	): Promise<WithCost<AuthenticateApiKeyResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let { cap, hard } = await this.#dauEnforcement();
			return ApiKeys.authenticateApiKey(this.#db, input, this.#apiKeyCache, {
				cache: this.#dauCache,
				cap,
				hard,
			});
		});
	}

	/**
	 * Mints a successor key and opens the incumbent's overlap window in the same
	 * call, updating this instance's own verification cache so the incumbent's
	 * new expiry is what a warm object checks next.
	 *
	 * @param input - The key to rotate, how many days the incumbent's window
	 * lasts, and who is making the call.
	 * @returns The new record and its one-time value, plus the incumbent's
	 * updated expiry, or which rule refused the call.
	 */
	async rotateApiKey(input: RotateApiKeyInput): Promise<WithCost<RotateApiKeyResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(ApiKeys.MACHINE_ACCESS_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return ApiKeys.rotateApiKey(this.#db, input, this.#apiKeyCache);
		});
	}

	/**
	 * Revokes an API key at once, evicting it from this instance's own
	 * verification cache in the same call.
	 *
	 * @param input - The key to revoke, why, and who is making the call.
	 * @returns Success, or that no such key exists.
	 */
	async revokeApiKey(input: RevokeApiKeyInput): Promise<WithCost<RevokeApiKeyResult>> {
		await this.#migrated;
		return this.#withCost(() => ApiKeys.revokeApiKey(this.#db, input, this.#apiKeyCache));
	}

	/**
	 * Reads one API key's own record. Never gated: reading a key a tenant
	 * already holds is not something a lapsed subscription blocks.
	 *
	 * @param input - The key to read.
	 * @returns The key's record, or that no such key exists.
	 */
	async readApiKey(input: { keyId: string }): Promise<WithCost<ReadApiKeyResult>> {
		await this.#migrated;
		return this.#withCost(() => ApiKeys.readApiKey(this.#db, input));
	}

	/**
	 * Lists a page of a subject's own API keys, newest first.
	 *
	 * @param input - The subject whose keys to list, and where to page from.
	 * @returns A page of key summaries, or that the given cursor no longer
	 * matches.
	 */
	async listApiKeys(input: ListApiKeysInput): Promise<WithCost<ListApiKeysResult>> {
		await this.#migrated;
		return this.#withCost(() => ApiKeys.listApiKeys(this.#db, input));
	}

	/**
	 * Deletes API keys past their expiry, in one bounded batch, for the
	 * scheduled handler driving retention.
	 *
	 * @param input - The clock to sweep against, and how many rows one call may
	 * remove.
	 * @returns How many rows this call deleted, and whether the batch was full.
	 */
	async sweepExpiredApiKeys(
		input: SweepExpiredApiKeysInput = {},
	): Promise<WithCost<SweepExpiredApiKeysResult>> {
		await this.#migrated;
		return this.#withCost(() => ApiKeys.sweepExpiredApiKeys(this.#db, input));
	}

	/**
	 * Validates and writes a new webhook endpoint record, minting its signing
	 * secret and returning it once.
	 *
	 * @param input - The endpoint's URL, description and subscribed event
	 * types, and who is registering it.
	 * @returns The new record and the one-time plaintext secret, or which rule
	 * refused it.
	 */
	async registerWebhookEndpoint(
		input: RegisterWebhookEndpointInput,
	): Promise<WithCost<RegisterWebhookEndpointResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(WebhookEndpoints.OUTBOUND_WEBHOOKS_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			let sealKey = await this.#sealKey();
			return WebhookEndpoints.registerWebhookEndpoint(this.#db, sealKey, input);
		});
	}

	/**
	 * Replaces a webhook endpoint's editable fields as one set: its URL,
	 * description and subscribed event types.
	 *
	 * @param input - The endpoint to update and its whole new editable record.
	 * @returns The updated record, or which rule refused the update.
	 */
	async updateWebhookEndpoint(
		input: UpdateWebhookEndpointInput,
	): Promise<WithCost<UpdateWebhookEndpointResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			if (!(await this.#isEntitled(WebhookEndpoints.OUTBOUND_WEBHOOKS_FEATURE))) {
				return { ok: false, reason: "entitlement-required" };
			}
			return WebhookEndpoints.updateWebhookEndpoint(this.#db, input);
		});
	}

	/**
	 * Mints a successor signing secret and keeps the incumbent live as
	 * `sealed_previous` for the rotation's overlap window.
	 *
	 * @param input - The endpoint to rotate, and who is making the call.
	 * @returns The updated record and the new one-time secret, or that no such
	 * endpoint exists.
	 */
	async rotateEndpointSecret(
		input: RotateEndpointSecretInput,
	): Promise<WithCost<RotateEndpointSecretResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let sealKey = await this.#sealKey();
			return WebhookEndpoints.rotateEndpointSecret(this.#db, sealKey, input);
		});
	}

	/**
	 * Deletes a webhook endpoint outright.
	 *
	 * @param input - The endpoint to delete, and who is making the call.
	 * @returns Success, or that no such endpoint exists.
	 */
	async deleteWebhookEndpoint(
		input: DeleteWebhookEndpointInput,
	): Promise<WithCost<DeleteWebhookEndpointResult>> {
		await this.#migrated;
		return this.#withCost(() => WebhookEndpoints.deleteWebhookEndpoint(this.#db, input));
	}

	/**
	 * Reads one webhook endpoint's record.
	 *
	 * @param input - The endpoint to read.
	 * @returns The record, or that no such endpoint exists.
	 */
	async readWebhookEndpoint(input: {
		endpointId: string;
	}): Promise<WithCost<ReadWebhookEndpointResult>> {
		await this.#migrated;
		return this.#withCost(() => WebhookEndpoints.readWebhookEndpoint(this.#db, input));
	}

	/**
	 * Lists a page of this tenant's own webhook endpoints, newest first.
	 *
	 * @param input - Where to page from.
	 * @returns A page of endpoint records, or that the given cursor no longer
	 * matches.
	 */
	async listWebhookEndpoints(
		input: ListWebhookEndpointsInput = {},
	): Promise<WithCost<ListWebhookEndpointsResult>> {
		await this.#migrated;
		return this.#withCost(() => WebhookEndpoints.listWebhookEndpoints(this.#db, input));
	}

	/**
	 * Leases a pending delivery for one attempt and signs it under every
	 * currently live secret its endpoint holds. Never gated: a tenant
	 * delivering to an endpoint it already registered is protocol surface, not
	 * something a lapsed subscription blocks.
	 *
	 * @param input - The delivery to prepare, and the clock to measure its
	 * secrets' rotation windows against.
	 * @returns The request to send and which attempt this now is, or that the
	 * delivery does not exist or is no longer pending.
	 */
	async prepareDelivery(input: PrepareDeliveryInput): Promise<WithCost<PrepareDeliveryResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let sealKey = await this.#sealKey();
			return WebhookDeliveries.prepareDelivery(this.#db, sealKey, input);
		});
	}

	/**
	 * Records one delivery attempt and decides what happens next.
	 *
	 * @param input - The delivery this attempt belongs to, how it went, and
	 * the clock to measure the next attempt against.
	 * @returns The row's status after recording the attempt, or that no such
	 * delivery exists.
	 */
	async settleDelivery(input: SettleDeliveryInput): Promise<WithCost<SettleDeliveryResult>> {
		await this.#migrated;
		return this.#withCost(() => WebhookDeliveries.settleDelivery(this.#db, input));
	}

	/**
	 * The pending deliveries already past their own `next_attempt_at`, for the
	 * scheduled sweep to enqueue.
	 *
	 * @param input - The clock to compare `next_attempt_at` against, and how
	 * many rows one call may return.
	 * @returns The due deliveries, and whether the batch was full.
	 */
	async claimDueDeliveries(
		input: ClaimDueDeliveriesInput = {},
	): Promise<WithCost<ClaimDueDeliveriesResult>> {
		await this.#migrated;
		return this.#withCost(() => WebhookDeliveries.claimDueDeliveries(this.#db, input));
	}

	/**
	 * Writes a new delivery row carrying an existing delivery's own payload,
	 * event type and endpoint.
	 *
	 * @param input - The delivery to replay, and who asked for it.
	 * @returns The new pending row, or that the original delivery or its
	 * endpoint no longer exists.
	 */
	async replayDelivery(input: ReplayDeliveryInput): Promise<WithCost<ReplayDeliveryResult>> {
		await this.#migrated;
		return this.#withCost(() => WebhookDeliveries.replayDelivery(this.#db, input));
	}

	/**
	 * A page of one endpoint's own delivery log, most recently created first.
	 *
	 * @param input - The endpoint whose deliveries to read, and where to page
	 * from.
	 * @returns A page of delivery summaries, or that the given cursor no
	 * longer matches.
	 */
	async readDeliveryPage(input: ReadDeliveryPageInput): Promise<WithCost<ReadDeliveryPageResult>> {
		await this.#migrated;
		return this.#withCost(() => WebhookDeliveries.readDeliveryPage(this.#db, input));
	}

	/**
	 * Deletes delivered or exhausted delivery rows older than this tenant's
	 * own retention window, at most `limit` per call, for the scheduled sweep
	 * to call repeatedly.
	 *
	 * @param input - How many rows one call may remove, and the clock to
	 * measure the window against.
	 * @returns How many rows this call deleted, and whether the batch was
	 * full.
	 */
	async sweepWebhookDeliveries(
		input: { now?: number; limit?: number } = {},
	): Promise<WithCost<SweepWebhookDeliveriesResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let retentionDays = await this.#auditRetentionDays();
			return WebhookDeliveries.sweepWebhookDeliveries(this.#db, {
				retentionDays,
				now: input.now,
				limit: input.limit,
			});
		});
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
	 * Resolves the enterprise connection a verified email domain routes to, for
	 * a sign-in page taking an address rather than showing a list of providers.
	 *
	 * @param input - The domain a sign-in address named.
	 * @returns The one enabled connection scoped to the organization that
	 * verified-claims this domain, or that none does.
	 */
	async resolveOrganizationConnection(input: {
		domain: string;
	}): Promise<WithCost<ResolveOrganizationConnectionResult>> {
		await this.#migrated;
		return this.#withCost(() => SamlConnections.resolveOrganizationConnection(this.#db, input));
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
			let [sealKey, issuer, { cap, hard }, sessionPolicy] = await Promise.all([
				this.#sealKey(),
				this.#issuer(),
				this.#dauEnforcement(),
				this.#effectiveSessionPolicy(),
			]);

			return SamlSignIn.signInWithSamlResponse(
				this.#db,
				sealKey,
				{ ...input, callbackOrigin: issuer },
				{ cache: this.#dauCache, cap, hard },
				sessionPolicy,
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
			let [sealKey, { cap, hard }, sessionPolicy] = await Promise.all([
				this.#sealKey(),
				this.#dauEnforcement(),
				this.#effectiveSessionPolicy(),
			]);

			return ConnectionSignIn.completeConnectionSignIn(
				this.#db,
				sealKey,
				input,
				{ cache: this.#dauCache, cap, hard },
				sessionPolicy,
			);
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
	 * Removes a subject's identity at one connection, refusing to take its last
	 * remaining way to sign in. An administrator's unlink also revokes every
	 * live session carrying that connection kind's method family in its `amr`.
	 *
	 * @param input - The subject, the connection's slug, and who is asking.
	 * @returns Success, or that no such identity exists, or that it is the
	 * subject's last remaining credential.
	 */
	async unlinkIdentity(input: UnlinkIdentityInput): Promise<WithCost<UnlinkIdentityResult>> {
		await this.#migrated;
		return this.#withCost(() => ConnectionSignIn.unlinkIdentity(this.#db, input));
	}

	/**
	 * Spends a confirmed-path ticket once the named subject has presented a
	 * credential for it, writing the identity it names.
	 *
	 * @param input - The subject completing the link, the ticket they presented
	 * a credential for, and who is asking.
	 * @returns Success, or that the ticket does not work, or that the provider
	 * identity it named was linked to somebody else in the meantime.
	 */
	async linkIdentity(input: LinkIdentityInput): Promise<WithCost<LinkIdentityResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let sealKey = await this.#sealKey();
			return ConnectionSignIn.linkIdentity(this.#db, sealKey, input);
		});
	}

	/**
	 * Adds a linked identity's own provider address as the subject's own
	 * identifier, verifying it at once when the provider already proved it.
	 *
	 * @param input - The subject, the connection whose identity names the
	 * address to adopt, and who is asking.
	 * @returns The address adopted and its verified state, or which rule
	 * refused the adoption.
	 */
	async adoptIdentityAddress(
		input: AdoptIdentityAddressInput,
	): Promise<WithCost<AdoptIdentityAddressResult>> {
		await this.#migrated;
		return this.#withCost(() => ConnectionSignIn.adoptIdentityAddress(this.#db, input));
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
	 * Mints a device and user code pair for a client that carries the device grant,
	 * the response a device with no browser worth using polls the token endpoint
	 * with next.
	 *
	 * @param input - The client asking for the grant, the scope it requests, and
	 * the clock to mint against.
	 * @returns The minted codes and polling parameters, or which rule refused the
	 * request.
	 */
	async beginDeviceAuthorization(
		input: Omit<BeginDeviceAuthorizationInput, "issuer">,
	): Promise<WithCost<BeginDeviceAuthorizationResult>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let issuer = await this.#issuer();
			return DeviceAuthorization.beginDeviceAuthorization(this.#db, { ...input, issuer });
		});
	}

	/**
	 * Turns a device code into a token set once a person has approved it, enforcing
	 * the polling interval and redeeming the row atomically so two concurrent polls
	 * cannot both mint.
	 *
	 * @param input - The presented device code, the client's credentials, and the
	 * clock to mint against.
	 * @returns The minted token set, or the error this poll was refused for.
	 */
	async redeemDeviceCode(
		input: Omit<RedeemDeviceCodeInput, "issuer">,
	): Promise<WithCost<TokenOutcome>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let issuer = await this.#issuer();
			return DeviceAuthorization.redeemDeviceCode(this.#db, { ...input, issuer });
		});
	}

	/**
	 * Resolves a presented user code to the pending row it names and the
	 * consent screen it should be approved or denied through.
	 *
	 * @param input - The presented user code, the approving session, and the
	 * clock to check expiry against.
	 * @returns The screen to render and the row's own id, or which rule
	 * refused the code.
	 */
	async beginDeviceApproval(
		input: BeginDeviceApprovalInput,
	): Promise<WithCost<BeginDeviceApprovalResult>> {
		await this.#migrated;
		return this.#withCost(() => DeviceAuthorization.beginDeviceApproval(this.#db, input));
	}

	/**
	 * Records the decision a person took on a device's own consent screen.
	 *
	 * @param input - The row being decided, the deciding session, whether it
	 * was approved, and the clock to stamp the decision with.
	 * @returns Which decision was recorded, or that the row no longer took one.
	 */
	async decideDeviceApproval(
		input: DecideDeviceApprovalInput,
	): Promise<WithCost<DecideDeviceApprovalResult>> {
		await this.#migrated;
		return this.#withCost(() => DeviceAuthorization.decideDeviceApproval(this.#db, input));
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
	 * Exchanges a client id and secret for a token about the client itself,
	 * carrying no subject, session or refresh token. Issuing to a client that
	 * already carries the grant on its own record is protocol surface, so
	 * this stays open to every tenant regardless of its own add-on standing.
	 *
	 * @param input - The client's credentials, the scope and resource
	 * requested, and the clock to mint against.
	 * @returns The minted access token, or the error this grant was refused
	 * for.
	 */
	async issueClientCredentialsToken(
		input: Omit<IssueClientCredentialsTokenInput, "issuer">,
	): Promise<WithCost<TokenOutcome>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let issuer = await this.#issuer();
			return Tokens.issueClientCredentialsToken(this.#db, { ...input, issuer });
		});
	}

	/**
	 * Authenticates a client's own credentials without minting anything, for
	 * a caller that only needs to know whether the presenter is who it
	 * claims — a client-authenticated endpoint verifying someone else's
	 * credential, rather than the token endpoint minting one.
	 *
	 * @param input - The client's id and secret, and how it presented itself.
	 * @returns Success, or the status and description an HTTP layer answers
	 * with.
	 */
	async authenticateClient(
		input: AuthenticateClientInput,
	): Promise<WithCost<AuthenticateClientResult>> {
		await this.#migrated;
		return this.#withCost(() => Tokens.authenticateClient(this.#db, input));
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
			let [issuer, hasDeviceGrant] = await Promise.all([
				this.#issuer(),
				this.#isEntitled(DeviceAuthorization.DEVICE_GRANT_FEATURE),
			]);
			return Metadata.publishMetadata(this.#db, { ...input, issuer, hasDeviceGrant });
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
	 * Whether this tenant's own enforcement record currently entitles a named
	 * feature, read from the same `entitlement_enforcement` row
	 * {@link #dauEnforcement} and {@link #auditRetentionDays} already read
	 * locally for their own caps — an add-on gate lives at this boundary
	 * rather than behind a database connection this object does not hold. A
	 * tenant whose record has never been written entitles nothing.
	 *
	 * @param input - The feature slug to check.
	 * @returns Whether the feature is currently entitled.
	 */
	async hasEntitlement(input: { feature: string }): Promise<WithCost<{ entitled: boolean }>> {
		await this.#migrated;

		return this.#withCost(async () => ({ entitled: await this.#isEntitled(input.feature) }));
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
				scim_connections: Scim.scimConnections,
				scim_groups: Scim.scimGroups,
				scim_group_members: Scim.scimGroupMembers,
				scim_group_mappings: Scim.scimGroupMappings,
				scim_links: Scim.scimLinks,
			};

			let rows: Record<string, number> = {};
			for (let [name, ref] of Object.entries(tables)) {
				rows[name] = await this.#db.count(ref);
			}

			return { rows, databaseSize: this.ctx.storage.sql.databaseSize };
		});
	}

	/**
	 * Answers whether an import of roughly `estimatedRows` more subjects still fits
	 * under this object's own storage ceiling, projected from its current size — the
	 * one question only this object can answer before a run starts moving rows
	 * through it. The run itself, and the id it is tracked under, are the
	 * control-plane job's own bookkeeping and never reach this object.
	 *
	 * @param input - How many subjects the run is about to write.
	 * @returns Success, or that the projected size would cross the ceiling.
	 */
	async beginImportRun(input: {
		estimatedRows: number;
	}): Promise<WithCost<{ ok: true } | { ok: false; reason: "storage-ceiling" }>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let fits = projectsWithinStorageCeiling({
				currentDatabaseSize: this.ctx.storage.sql.databaseSize,
				estimatedRows: input.estimatedRows,
			});

			if (!fits) return { ok: false, reason: "storage-ceiling" } as const;
			return { ok: true } as const;
		});
	}

	/**
	 * Validates or writes one already-assembled batch of import rows, sequentially,
	 * answering one outcome per row in the same order. Pacing the rows across calls
	 * and persisting how far a run has gotten are the control-plane job's own concern;
	 * this method only ever sees the one batch it is handed.
	 *
	 * @param input - Whether to only check the batch or write it, and the rows
	 * themselves.
	 * @returns One outcome per row, in the order the rows were given.
	 */
	async importSubjects(input: {
		mode: "validate" | "apply";
		rows: ImportSubjectRow[];
	}): Promise<WithCost<{ outcomes: ImportRowOutcome[] }>> {
		await this.#migrated;

		return this.#withCost(async () => {
			let outcomes: ImportRowOutcome[] = [];

			for (let row of input.rows) {
				outcomes.push(
					input.mode === "validate"
						? await validateImportRow(this.#db, row)
						: await applyImportRow(this.#db, row),
				);
			}

			return { outcomes };
		});
	}

	/**
	 * Writes one summary audit row for a finished import run's totals.
	 *
	 * @param input - How many rows the run processed, how many subjects it created,
	 * and how many rows failed.
	 * @returns Success, once the row is written.
	 */
	async completeImportRun(input: {
		processed: number;
		created: number;
		failed: number;
	}): Promise<WithCost<{ ok: true }>> {
		await this.#migrated;
		return this.#withCost(() => completeImportRun(this.#db, input));
	}
}
