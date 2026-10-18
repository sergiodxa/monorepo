/**
 * The `env` check: every secret `cloudflare.config.ts` declares has a line in `.env.example`.
 * CI copies `.env.example` to `.dev.vars` before it generates the Worker's `Env` types, so a
 * secret only a local `.dev.vars` holds type checks on a laptop and fails in CI.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/** The Worker configuration file the check reads. */
export const CONFIG_FILE = "cloudflare.config.ts";

/** The file CI builds `.dev.vars` from. */
export const ENV_EXAMPLE_FILE = ".env.example";

/**
 * A binding as the config writes it, `KEY: bindings.secret(`, with the key optionally quoted.
 * The key must start a property, so a mention inside prose does not count.
 */
const BINDING = /(?:^|[\s{,(])["']?([A-Za-z_$][\w$]*)["']?\s*:\s*bindings\.(\w+)\s*\(/g;

/** A `.env` assignment, `KEY=value` or `export KEY=value`. */
const ASSIGNMENT = /^(?:export\s+)?([A-Za-z_][\w.-]*)\s*=/;

/**
 * Fails on a secret `.env.example` leaves out, with the command that appends it, and warns on a
 * key `.env.example` lists that no binding declares, since CI types it into `Env` and the
 * deployed Worker never receives it.
 */
export const envCheck: Check = {
	name: "env",
	async run(context): Promise<CheckResult> {
		let config = await wrap(() => readFile(join(context.root, CONFIG_FILE), "utf8"));
		if (isFailure(config)) return skipped(`No ${CONFIG_FILE} in the project`);
		let declared = declaredBindings(config.data);
		let example = await wrap(() => readFile(join(context.root, ENV_EXAMPLE_FILE), "utf8"));
		let listed = isFailure(example) ? new Set<string>() : exampleKeys(example.data);

		let missing = [...declared]
			.filter(([key, kind]) => kind === "secret" && !listed.has(key))
			.map(([key]) => key);
		if (missing.length > 0) {
			let lines = missing.map((key) => `${key}=`).join("\\n");
			return {
				status: "fail",
				message: `${ENV_EXAMPLE_FILE} leaves out ${missing.length === 1 ? "a secret" : `${missing.length} secrets`} ${CONFIG_FILE} declares`,
				findings: missing.map((key) => `${key} is declared with bindings.secret()`),
				fix: `printf '\\n${lines}\\n' >> ${ENV_EXAMPLE_FILE}`,
			};
		}
		let undeclared = [...listed].filter((key) => !declared.has(key));
		if (undeclared.length > 0) {
			return {
				status: "warn",
				message: `${ENV_EXAMPLE_FILE} lists ${undeclared.length === 1 ? "a key" : `${undeclared.length} keys`} no binding declares`,
				findings: undeclared.map((key) => `${key} is in ${ENV_EXAMPLE_FILE} only`),
				fix: `Declare each with bindings.secret() in ${CONFIG_FILE}, or delete its line from ${ENV_EXAMPLE_FILE}`,
			};
		}
		let secrets = [...declared.values()].filter((kind) => kind === "secret").length;
		if (secrets === 0) return passed(`${CONFIG_FILE} declares no secret`);
		return passed(`${ENV_EXAMPLE_FILE} lists every secret ${CONFIG_FILE} declares`);
	},
};

/**
 * Every binding the config source declares, as key and `bindings` helper name, comments
 * stripped first so a documented example in one stays out of the result.
 */
export function declaredBindings(source: string): Map<string, string> {
	let code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
	let bindings = new Map<string, string>();
	for (let match of code.matchAll(BINDING)) {
		let [, key, kind] = match;
		if (key !== undefined && kind !== undefined) bindings.set(key, kind);
	}
	return bindings;
}

/** Every key a `.env` file assigns, comments and blank lines skipped. */
export function exampleKeys(source: string): Set<string> {
	let keys = new Set<string>();
	for (let line of source.split(/\r?\n/)) {
		let key = ASSIGNMENT.exec(line.trim())?.[1];
		if (key !== undefined) keys.add(key);
	}
	return keys;
}
