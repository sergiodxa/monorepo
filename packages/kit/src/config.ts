/**
 * The `sdxc` project configuration: one schema holds every key with its default and its
 * description, so validating a project's file, rendering `sdxc init`'s output and emitting
 * `config.schema.json` for editors all read the same definition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import * as JSONC from "@sdxc/jsonc";
import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import { resolveInside } from "./project.js";

/** Where the CLI looks for the configuration, relative to the project root, in lookup order. */
export const CONFIG_LOCATIONS = [".config/sdxc.jsonc", "sdxc.jsonc"] as const;

/** The `ui` group as a project with no `ui` key gets it. */
const UI_DEFAULTS = { directory: "resources/components/ui", tests: false };

/** The `make` group as a project with no `make` key gets it. */
const MAKE_DEFAULTS = {
	routes: "web",
	migrations: { default: "database/migrations" },
	tests: true,
	specs: true,
	stubs: ".config/sdxc/stubs",
};

/**
 * A migration error `sdxc doctor` accepts: the file that raised it and the column the error
 * names, narrow enough that a different error in the same file still fails.
 */
const ACCEPTED_MIGRATION_FAILURE = s.object(
	{
		file: s.string().meta({ description: "Migration file name, without its folder" }),
		column: s.string().meta({ description: "Column SQLite's error names" }),
	},
	{ unknownKeys: "error" },
);

/** The `doctor.migrations` group as a project with no such key gets it. */
const DOCTOR_MIGRATIONS_DEFAULTS: { accept: s.InferOutput<typeof ACCEPTED_MIGRATION_FAILURE>[] } = {
	accept: [],
};

/** The `doctor` group as a project with no `doctor` key gets it. */
const DOCTOR_DEFAULTS = { checks: ".config/sdxc/checks", migrations: DOCTOR_MIGRATIONS_DEFAULTS };

/** The `run` group as a project with no `run` key gets it. */
const RUN_DEFAULTS = { entry: "bootstrap/cli.ts" };

/**
 * Every configuration key. Each leaf carries its default, or an example when it has none, and
 * a description that becomes its comment in `sdxc init`'s output; an unknown key is an error, so
 * a misspelt key is reported instead of silently ignored.
 */
export const CONFIG_SCHEMA = s.object(
	{
		$schema: s.optional(s.string()).meta({
			description: "The JSON Schema editors check this file against",
		}),
		ui: s.defaulted(
			s.object(
				{
					directory: s
						.defaulted(s.string(), UI_DEFAULTS.directory)
						.meta({ description: "Where `sdxc ui add` writes components" }),
					alias: s.optional(s.string()).meta({
						description:
							"Import prefix for the copies; inferred from tsconfig `paths` when omitted",
						examples: ["~/components/ui"],
					}),
					tests: s
						.defaulted(s.boolean(), UI_DEFAULTS.tests)
						.meta({ description: "Copy a component's tests beside it" }),
				},
				{ unknownKeys: "error" },
			),
			UI_DEFAULTS,
		),
		make: s.defaulted(
			s.object(
				{
					routes: s.defaulted(s.string(), MAKE_DEFAULTS.routes).meta({
						description: "Route contract `sdxc make controller` adds to, a module in routes/",
					}),
					migrations: s
						.defaulted(s.record(s.string(), s.string()), MAKE_DEFAULTS.migrations)
						.meta({ description: "Migration chains by name; `--chain <name>` picks one" }),
					tests: s.defaulted(s.boolean(), MAKE_DEFAULTS.tests).meta({
						description: "Write a test beside every generated file except migrations and factories",
					}),
					specs: s.defaulted(s.boolean(), MAKE_DEFAULTS.specs).meta({
						description:
							"Write a pairing .spec under spec/ for controllers, commands, MCP tools and scaffolds",
					}),
					stubs: s.defaulted(s.string(), MAKE_DEFAULTS.stubs).meta({
						description: "Stubs here replace the built-in ones; `sdxc make stubs` copies them out",
					}),
				},
				{ unknownKeys: "error" },
			),
			MAKE_DEFAULTS,
		),
		doctor: s.defaulted(
			s.object(
				{
					checks: s.defaulted(s.string(), DOCTOR_DEFAULTS.checks).meta({
						description: "Folder of the project's own checks, each module run by `sdxc doctor`",
					}),
					migrations: s.defaulted(
						s.object(
							{
								accept: s
									.defaulted(s.array(ACCEPTED_MIGRATION_FAILURE), DOCTOR_MIGRATIONS_DEFAULTS.accept)
									.meta({
										description:
											"Migration errors `sdxc doctor` steps past, each a file that already ran and the column its error names",
									}),
							},
							{ unknownKeys: "error" },
						),
						DOCTOR_MIGRATIONS_DEFAULTS,
					),
				},
				{ unknownKeys: "error" },
			),
			DOCTOR_DEFAULTS,
		),
		run: s.defaulted(
			s.object(
				{
					entry: s.defaulted(s.string(), RUN_DEFAULTS.entry).meta({
						description:
							"Module `sdxc run` starts, relative to the project root; apps keep the default",
					}),
				},
				{ unknownKeys: "error" },
			),
			RUN_DEFAULTS,
		),
		format: s.optional(s.array(s.string()).pipe(checks.minItems(1))).meta({
			description: "Command run on every file the CLI writes or edits, paths appended",
			examples: [["bunx", "vp", "fmt", "--no-error-on-unmatched-pattern"]],
		}),
		lock: s.defaulted(s.string(), ".config/sdxc.lock.jsonl").meta({
			description: "Where the CLI keeps its state; commit it with the project",
		}),
	},
	{ unknownKeys: "error" },
);

/** A validated configuration with every default filled in. */
export type Config = s.InferOutput<typeof CONFIG_SCHEMA>;

/** The configuration a command runs with, and the file it came from when the project has one. */
export interface LoadedConfig {
	/** Path relative to the project root, or `null` when the defaults apply. */
	path: string | null;
	config: Config;
}

/**
 * The configuration schema as a JSON Schema 2020-12 document, which `config.schema.json`
 * ships and `sdxc init` renders.
 */
export function configJSONSchema(): Result<s.JSONSchema, Error> {
	return s.toJSONSchema(CONFIG_SCHEMA);
}

/**
 * The configuration file of the project at `root`, relative to it, or `null` when there is
 * none. A file at both locations is a failure naming them, since either could be the one meant.
 */
export async function findConfigFile(root: string): Promise<Result<string | null, Error>> {
	let present: string[] = [];
	for (let location of CONFIG_LOCATIONS) {
		let found = await wrap(() => stat(join(root, location)));
		if (isSuccess(found) && found.data.isFile()) present.push(location);
	}
	if (present.length > 1) {
		return failure(
			new Error(
				`Found both ${present.join(" and ")}; keep one configuration file and delete the other`,
			),
		);
	}
	return success(present[0] ?? null);
}

/**
 * Reads, validates and completes the configuration of the project at `root`. Every failing key
 * is reported on its own line with its path, and every configured path must stay inside the
 * project; a project without a file runs with the defaults.
 */
export async function loadConfig(root: string): Promise<Result<LoadedConfig, Error>> {
	let path = await findConfigFile(root);
	if (isFailure(path)) return path;
	if (path.data === null) return parseConfig({}, root, null);
	let location = path.data;
	let text = await wrap(() => readFile(join(root, location), "utf8"));
	if (isFailure(text)) return failure(new Error(`${location}: ${text.error.message}`));
	let parsed = JSONC.parse(text.data);
	if (isFailure(parsed)) return failure(new Error(`${location}: ${parsed.error.message}`));
	return parseConfig(parsed.data, root, location);
}

/**
 * Validates an already parsed configuration value against {@link CONFIG_SCHEMA} and the project
 * boundary. Messages read `<file>: <key path>: <problem>`, one per line.
 *
 * @param value - The parsed file, or `{}` for a project without one.
 * @param root - The project root every configured path resolves against.
 * @param location - The file the value came from, named in every message.
 */
export function parseConfig(
	value: unknown,
	root: string,
	location: string | null,
): Result<LoadedConfig, Error> {
	let label = location ?? "configuration";
	let checked = s.parseSafe(CONFIG_SCHEMA, value);
	if (!checked.success) {
		let lines = checked.issues.map((issue) => {
			let key = (issue.path ?? []).map(pathSegment).join(".");
			return `${label}: ${key === "" ? "(root)" : key}: ${issue.message}`;
		});
		return failure(new Error(lines.join("\n")));
	}
	let config = checked.value;
	let outside: string[] = [];
	for (let [key, configured] of configuredPaths(config)) {
		let resolved = resolveInside(root, configured);
		if (isFailure(resolved)) outside.push(`${label}: ${key}: ${resolved.error.message}`);
	}
	if (outside.length > 0) return failure(new Error(outside.join("\n")));
	return success({ path: location, config });
}

/** Every key whose value is a path in the project, with that path, for the boundary check. */
function configuredPaths(config: Config): Array<[string, string]> {
	let paths: Array<[string, string]> = [
		["ui.directory", config.ui.directory],
		["make.stubs", config.make.stubs],
		["doctor.checks", config.doctor.checks],
		["run.entry", config.run.entry],
		["lock", config.lock],
	];
	for (let [chain, folder] of Object.entries(config.make.migrations)) {
		paths.push([`make.migrations.${chain}`, folder]);
	}
	return paths;
}

/** One segment of a Standard Schema issue path, which may be a bare key or a `{ key }` record. */
function pathSegment(segment: PropertyKey | { key: PropertyKey }): string {
	return String(typeof segment === "object" ? segment.key : segment);
}
