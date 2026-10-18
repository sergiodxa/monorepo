/**
 * What `sdxc deploy` shows before it touches production: the Worker and D1 database the build
 * output resolves, the account `cf auth whoami` reports, and the migrations
 * `cf d1 migrations list` finds pending, read from `cf`'s JSON output and printed as one plan.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";

/** Where `vp build` writes each Worker's resolved configuration, relative to the project root. */
export const BUILD_WORKERS = ".cloudflare/output/v0/workers";

/** The database id the `app` template ships with, which every `cf d1` call rejects. */
export const PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

/** The binding the app's `db migrate --remote` applies the chain to when a Worker has several. */
export const MIGRATED_BINDING = "DB";

/** A D1 binding of the built Worker. */
export interface Database {
	binding: string;
	id: string;
}

/** What the build output says about the Worker it will deploy. */
export interface BuiltWorker {
	name: string;
	/** The database the migration chain applies to; `undefined` for a Worker without D1. */
	database: Database | undefined;
}

/** Who `cf` deploys as, ready to print. */
export interface Identity {
	/** The account, as `Name (id)` when `cf` names it. */
	account: string;
	email: string | undefined;
}

/** What happens to the migration chain, as the plan reports it. */
export type MigrationStep =
	| { status: "pending"; database: Database; names: string[] }
	| { status: "skipped"; reason: string };

/** Everything the confirmation prints. */
export interface Plan {
	worker: string;
	identity: Identity;
	/** `true` when the deploy uploads output an earlier build wrote. */
	prebuilt: boolean;
	migrations: MigrationStep;
}

/** The fields of `worker.config.json` the plan reads. */
const WORKER_CONFIG_SCHEMA = s.object({
	name: s.string(),
	env: s.defaulted(
		s.record(s.string(), s.object({ type: s.string(), id: s.optional(s.string()) })),
		{},
	),
});

/** The fields of `cf auth whoami`'s JSON the plan reads. */
const WHOAMI_SCHEMA = s.object({
	authenticated: s.boolean(),
	email: s.optional(s.string()),
	accounts: s.defaulted(s.array(s.object({ id: s.string(), name: s.string() })), []),
});

/** `cf d1 migrations list`'s JSON: one row per unapplied migration file. */
const PENDING_SCHEMA = s.array(s.object({ Name: s.string() }));

/** Escape sequences `cf` colors its JSON with when it decides the output is a terminal. */
// oxlint-disable-next-line no-control-regex -- matching the ESC that starts a color sequence
const ANSI = /\u001B\[[0-9;]*m/g;

/** `cf`'s printed JSON, uncolored and parsed, or a failure naming the command that printed it. */
function parseJSON(stdout: string, command: string): Result<unknown, Error> {
	let parsed = wrap(() => JSON.parse(stdout.replace(ANSI, "")) as unknown);
	if (isFailure(parsed)) {
		return failure(new Error(`${command} printed something other than JSON: ${stdout.trim()}`));
	}
	return parsed;
}

/**
 * The Worker the build output in `root` deploys. One Worker per build is what `cf deploy`
 * uploads, so a missing or ambiguous output fails, naming the build as the fix. The chain's
 * database is the `DB` binding, or the only D1 binding when the Worker has one under another name.
 */
export async function readBuiltWorker(root: string): Promise<Result<BuiltWorker, Error>> {
	let directory = join(root, BUILD_WORKERS);
	let workers = await wrap(() => readdir(directory));
	if (isFailure(workers) || workers.data.length === 0) {
		return failure(new Error(`No build output in ${BUILD_WORKERS}; run the build first`));
	}
	if (workers.data.length > 1) {
		return failure(
			new Error(`${BUILD_WORKERS} holds ${workers.data.length} Workers; deploy one at a time`),
		);
	}
	let file = join(BUILD_WORKERS, workers.data[0]!, "worker.config.json");
	let text = await wrap(() => readFile(join(root, file), "utf8"));
	if (isFailure(text)) return failure(new Error(`${file} is missing; run the build again`));
	let parsed = wrap(() => JSON.parse(text.data) as unknown);
	let checked = isSuccess(parsed) ? s.parseSafe(WORKER_CONFIG_SCHEMA, parsed.data) : undefined;
	if (checked === undefined || !checked.success) {
		return failure(new Error(`${file} does not name the Worker; run the build again`));
	}
	let databases = Object.entries(checked.value.env).flatMap(([binding, value]) =>
		value.type === "d1" && value.id !== undefined ? [{ binding, id: value.id }] : [],
	);
	let database =
		databases.find((candidate) => candidate.binding === MIGRATED_BINDING) ??
		(databases.length === 1 ? databases[0] : undefined);
	return success({ name: checked.value.name, database });
}

/**
 * Who `cf auth whoami` reports. `CLOUDFLARE_ACCOUNT_ID` decides the account when set, as it does
 * for `cf`; otherwise a login reaching one account names it, and one reaching several says `cf`
 * picks. Signed-out credentials fail, naming `cf auth login`.
 *
 * @param stdout - What `cf auth whoami` printed
 * @param accountId - The run's `CLOUDFLARE_ACCOUNT_ID`
 */
export function parseIdentity(
	stdout: string,
	accountId: string | undefined,
): Result<Identity, Error> {
	let parsed = parseJSON(stdout, "cf auth whoami");
	if (isFailure(parsed)) return parsed;
	let checked = s.parseSafe(WHOAMI_SCHEMA, parsed.data);
	if (!checked.success) {
		return failure(new Error(`cf auth whoami printed an unexpected shape: ${stdout.trim()}`));
	}
	let whoami = checked.value;
	if (!whoami.authenticated) {
		return failure(
			new Error("cf is not logged in; run cf auth login, or set CLOUDFLARE_API_TOKEN"),
		);
	}
	let named = (id: string) => {
		let account = whoami.accounts.find((candidate) => candidate.id === id);
		return account === undefined ? id : `${account.name} (${account.id})`;
	};
	let account =
		accountId !== undefined && accountId !== ""
			? `${named(accountId)}, from CLOUDFLARE_ACCOUNT_ID`
			: whoami.accounts.length === 1
				? named(whoami.accounts[0]!.id)
				: `one of ${whoami.accounts.length} accounts, which cf picks`;
	return success({ account, email: whoami.email });
}

/** The unapplied migration names `cf d1 migrations list` printed, in the order `cf` applies them. */
export function parsePending(stdout: string): Result<string[], Error> {
	let parsed = parseJSON(stdout, "cf d1 migrations list");
	if (isFailure(parsed)) return parsed;
	let checked = s.parseSafe(PENDING_SCHEMA, parsed.data);
	if (!checked.success) {
		return failure(
			new Error(`cf d1 migrations list printed an unexpected shape: ${stdout.trim()}`),
		);
	}
	return success(checked.value.map((row) => row.Name));
}

/** Whether `directory` holds a migration file; a missing directory holds none. */
export async function hasMigrations(directory: string): Promise<boolean> {
	let names = await wrap(() => readdir(directory));
	return isSuccess(names) && names.data.some((name) => name.endsWith(".sql"));
}

/** The plan as the terminal shows it, one fact per line and one line per pending migration. */
export function formatPlan(plan: Plan): string {
	let lines = [
		`Worker:     ${plan.worker}`,
		`Account:    ${plan.identity.account}${plan.identity.email === undefined ? "" : `, as ${plan.identity.email}`}`,
		`Build:      ${plan.prebuilt ? "existing .cloudflare/output (--skip-build)" : "built just now"}`,
	];
	let migrations = plan.migrations;
	if (migrations.status === "skipped") {
		lines.push(`Migrations: none to apply (${migrations.reason})`);
	} else {
		let { binding, id } = migrations.database;
		lines.push(`Migrations: ${migrations.names.length} pending on ${binding} (${id})`);
		for (let name of migrations.names) lines.push(`  ${name}`);
	}
	return `${lines.join("\n")}\n`;
}
