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

import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { column as c, Database, table } from "remix/data-table";

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

import { hasAnotherCredential } from "./credentials";
import * as Passkeys from "./passkeys";
import * as Passwords from "./passwords";
import * as Subjects from "./subjects";
import { runMigrations } from "./tenant-migrations";

/** One row: the tenant id this object is addressed by, its issuer, and its creation time. */
const settings = table({
	name: "settings",
	primaryKey: ["tenant_id"],
	columns: {
		tenant_id: c.text(),
		issuer: c.text(),
		created_at: c.integer(),
	},
});

/** What `provision` hands back: the schema now applied, and the issuer it recorded. */
export interface ProvisionResult {
	applied: string[];
	issuer: string;
}

/**
 * How often the retention alarm sweeps unverified identifiers. Daily is frequent enough
 * that a swept row never sits long past the retention window, and infrequent enough
 * that an idle tenant's object wakes for almost nothing else.
 */
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * One tenant's identity state, isolated in this object's own SQLite database.
 */
export default class Tenant extends DurableObject<Cloudflare.Env> {
	#db: Database;

	/** The migrations applied during construction, read by `provision` once it settles. */
	#migrated: Promise<{ applied: string[] }>;

	/**
	 * Opens this tenant's database and applies whatever schema has not run yet, queuing
	 * every method behind it so none observes a half-applied schema.
	 *
	 * @param ctx - The object's storage, alarms and concurrency gate.
	 * @param env - The Worker's bindings.
	 */
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);

		let driver = createSQLStorageDatabaseAdapter(ctx.storage.sql);
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
	 * Provisions this tenant: waits on the schema the constructor already started
	 * migrating, then records the tenant's id and issuer in `settings`. A first boot and a
	 * catch-up boot behind several releases take the same path, because both wait on the
	 * one migration run the constructor starts.
	 *
	 * @param input - The tenant id this object is addressed by, and the issuer it mints
	 * tokens under.
	 * @returns The migration ids applied on this boot, and the issuer now recorded.
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

		return { applied, issuer: input.issuer };
	}

	/**
	 * Destroys everything this object holds, for the control plane's purge job. Nothing
	 * calls this yet; the job that will is out of scope here.
	 */
	async erase(): Promise<void> {
		await this.ctx.storage.deleteAll();
	}

	/**
	 * Creates a subject with its claimed identifiers, profile and attributes.
	 *
	 * @param input - The identifiers to claim, the standard profile claims, and any
	 * declared attributes to set.
	 * @returns The new subject's id and each identifier's starting state, or which
	 * identifier or attribute key the call was refused for.
	 */
	async createSubject(input: CreateSubjectInput): Promise<CreateSubjectResult> {
		await this.#migrated;
		return Subjects.createSubject(this.#db, input);
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
	}): Promise<UpdateSubjectResult> {
		await this.#migrated;
		return Subjects.updateSubject(this.#db, input);
	}

	/**
	 * Claims a new identifier for an existing subject, minting a verification ticket for
	 * an email address.
	 *
	 * @param input - The subject, the identifier's kind and value, and who is asking.
	 * @returns The identifier's starting state — with a ticket to deliver for an email —
	 * or which rule the call was refused for.
	 */
	async addIdentifier(input: AddIdentifierInput): Promise<AddIdentifierResult> {
		await this.#migrated;
		return Subjects.addIdentifier(this.#db, input);
	}

	/**
	 * Spends a verification ticket, proving the identifier it was minted for.
	 *
	 * @param input - The ticket as it was delivered to the address.
	 * @returns The subject the address belongs to and whether it became primary, or why
	 * the ticket does not work.
	 */
	async verifyIdentifier(input: { ticket: string }): Promise<VerifyIdentifierResult> {
		await this.#migrated;
		return Subjects.verifyIdentifier(this.#db, input);
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
	}): Promise<SetPrimaryIdentifierResult> {
		await this.#migrated;
		return Subjects.setPrimaryIdentifier(this.#db, input);
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
	}): Promise<RemoveIdentifierResult> {
		await this.#migrated;

		let row = await this.#db.findOne(Subjects.subjectIdentifiers, {
			where: { subject_id: input.subjectId, value: input.value },
		});
		if (!row) return Subjects.removeIdentifier(this.#db, input);

		let hasOtherCredential = await hasAnotherCredential(this.#db, input.subjectId, {
			kind: "identifier",
			id: row.id,
		});

		return Subjects.removeIdentifier(this.#db, input, hasOtherCredential);
	}

	/**
	 * Blocks a subject.
	 *
	 * @param input - The subject to block and the reason recorded for the call.
	 * @returns Success, or that no such subject exists.
	 */
	async blockSubject(input: { subjectId: string; reason: string }): Promise<BlockSubjectResult> {
		await this.#migrated;
		return Subjects.blockSubject(this.#db, input);
	}

	/**
	 * Unblocks a subject.
	 *
	 * @param input - The subject to unblock.
	 * @returns Success, or that no such subject exists.
	 */
	async unblockSubject(input: { subjectId: string }): Promise<UnblockSubjectResult> {
		await this.#migrated;
		return Subjects.unblockSubject(this.#db, input);
	}

	/**
	 * Deletes a subject, its identifiers and its attributes, and retires its id.
	 *
	 * @param input - The subject to delete.
	 * @returns Success, or that no such subject exists.
	 */
	async deleteSubject(input: { subjectId: string }): Promise<DeleteSubjectResult> {
		await this.#migrated;
		return Subjects.deleteSubject(this.#db, input);
	}

	/**
	 * Declares or redeclares a tenant's custom attribute key.
	 *
	 * @param input - The key, its type, and its visibility.
	 * @returns Success; defining an existing key updates it in place.
	 */
	async defineAttribute(input: DefineAttributeInput): Promise<{ ok: true }> {
		await this.#migrated;
		return Subjects.defineAttribute(this.#db, input);
	}

	/**
	 * Removes an attribute's definition, leaving subjects' stored values in place.
	 *
	 * @param input - The key to remove.
	 * @returns Success, or that no such key was defined.
	 */
	async removeAttribute(input: { key: string }): Promise<RemoveAttributeResult> {
		await this.#migrated;
		return Subjects.removeAttribute(this.#db, input);
	}

	/**
	 * Assembles everything one account screen renders for a subject.
	 *
	 * @param input - The subject to describe and who is looking.
	 * @returns The assembled view, or that no such subject exists.
	 */
	async describeSubject(input: {
		subjectId: string;
		audience: Actor;
	}): Promise<DescribeSubjectResult> {
		await this.#migrated;
		return Subjects.describeSubject(this.#db, input);
	}

	/**
	 * Reads the tenant's password policy.
	 *
	 * @returns The minimum length, denied terms, expiry interval and history depth
	 * currently in force.
	 */
	async describePasswordPolicy(): Promise<PasswordPolicy> {
		await this.#migrated;
		return Passwords.describePasswordPolicy(this.#db);
	}

	/**
	 * Sets a subject's password, enforcing policy and refusing a reuse.
	 *
	 * @param input - The subject, the candidate password, and who is asking.
	 * @returns The new row's id and expiry, or which policy rule refused the candidate.
	 */
	async setPassword(input: SetPasswordInput): Promise<SetPasswordResult> {
		await this.#migrated;
		return Passwords.setPassword(this.#db, input);
	}

	/**
	 * Verifies a subject's current password and replaces it.
	 *
	 * @param input - The subject, its current password, and the replacement.
	 * @returns The new row's id and expiry, or why the change was refused.
	 */
	async changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
		await this.#migrated;
		return Passwords.changePassword(this.#db, input);
	}

	/**
	 * Verifies a password sign-in and reports what is owed, without opening a session.
	 *
	 * @param input - The identifier as typed, and the candidate password.
	 * @returns The subject and what it still owes, or why sign-in was refused.
	 */
	async signInWithPassword(input: SignInWithPasswordInput): Promise<SignInWithPasswordResult> {
		await this.#migrated;
		return Passwords.signInWithPassword(this.#db, input);
	}

	/**
	 * Mints a password reset ticket for the address a subject signs in with.
	 *
	 * @param input - The identifier as typed.
	 * @returns The plaintext ticket to deliver, and the address to deliver it to.
	 */
	async beginPasswordReset(input: BeginPasswordResetInput): Promise<BeginPasswordResetResult> {
		await this.#migrated;
		return Passwords.beginPasswordReset(this.#db, input);
	}

	/**
	 * Spends a password reset ticket and writes the new password it authorized.
	 *
	 * @param input - The ticket as delivered, and the new password it authorizes.
	 * @returns The subject and the new row's id, or why the reset was refused.
	 */
	async completePasswordReset(
		input: CompletePasswordResetInput,
	): Promise<CompletePasswordResetResult> {
		await this.#migrated;
		return Passwords.completePasswordReset(this.#db, input);
	}

	/**
	 * Marks a subject's current password as owing a change.
	 *
	 * @param input - The subject, and why the reset is being forced.
	 * @returns The row now marked, and the reason recorded, or why nothing was marked.
	 */
	async forcePasswordReset(input: ForcePasswordResetInput): Promise<ForcePasswordResetResult> {
		await this.#migrated;
		return Passwords.forcePasswordReset(this.#db, input);
	}

	/**
	 * Removes a subject's password, refusing to take its last remaining credential.
	 *
	 * @param input - The subject to remove the password from.
	 * @returns Success, or why the removal was refused.
	 */
	async removePassword(input: { subjectId: string }): Promise<RemovePasswordResult> {
		await this.#migrated;

		let hasOtherCredential = await hasAnotherCredential(this.#db, input.subjectId, {
			kind: "password",
		});

		return Passwords.removePassword(this.#db, input, hasOtherCredential);
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
	): Promise<BeginPasskeyRegistrationResult> {
		await this.#migrated;
		return Passkeys.beginPasskeyRegistration(this.#db, input);
	}

	/**
	 * Spends a registration ceremony's challenge and stores the credential it verifies.
	 *
	 * @param input - The ceremony id, the browser's response, an optional label, the
	 * enrolling request's `User-Agent`, and the relying party id and origins the Worker
	 * resolved.
	 * @returns The stored credential's public fields, or which check refused it.
	 */
	async enrolPasskey(input: EnrolPasskeyInput): Promise<EnrolPasskeyResult> {
		await this.#migrated;
		return Passkeys.enrolPasskey(this.#db, input);
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
	): Promise<BeginPasskeyAuthenticationResult> {
		await this.#migrated;
		return Passkeys.beginPasskeyAuthentication(this.#db, input);
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
	async signInWithPasskey(input: SignInWithPasskeyInput): Promise<SignInWithPasskeyResult> {
		await this.#migrated;
		return Passkeys.signInWithPasskey(this.#db, input);
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
	}): Promise<RenamePasskeyResult> {
		await this.#migrated;
		return Passkeys.renamePasskey(this.#db, input);
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
	}): Promise<RevokePasskeyResult> {
		await this.#migrated;

		let hasOtherCredential = await hasAnotherCredential(this.#db, input.subjectId, {
			kind: "passkey",
			credentialId: input.credentialId,
		});

		return Passkeys.revokePasskey(this.#db, input, hasOtherCredential);
	}

	/**
	 * The daily retention sweep: releases unverified identifiers whose ticket is gone or
	 * expired and whose row has sat unproven for a week, clears expired passkey
	 * ceremonies, then arms tomorrow's run.
	 *
	 * Never rejects, the way a Durable Object alarm should not: a rejected alarm is
	 * retried by the platform, which would repeat a sweep that already ran.
	 */
	override async alarm(): Promise<void> {
		try {
			await this.#migrated;
			await Subjects.sweepUnverifiedIdentifiers(this.#db);
			await Passkeys.sweepExpiredPasskeyChallenges(this.#db);
		} catch (error) {
			console.error("retention sweep failed", error);
		} finally {
			await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS).catch(() => undefined);
		}
	}
}
