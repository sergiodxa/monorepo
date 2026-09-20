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
		return Subjects.removeIdentifier(this.#db, input);
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
	 * The daily retention sweep: releases unverified identifiers whose ticket is gone or
	 * expired and whose row has sat unproven for a week, then arms tomorrow's run.
	 *
	 * Never rejects, the way a Durable Object alarm should not: a rejected alarm is
	 * retried by the platform, which would repeat a sweep that already ran.
	 */
	override async alarm(): Promise<void> {
		try {
			await this.#migrated;
			await Subjects.sweepUnverifiedIdentifiers(this.#db);
		} catch (error) {
			console.error("subject retention sweep failed", error);
		} finally {
			await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS).catch(() => undefined);
		}
	}
}
