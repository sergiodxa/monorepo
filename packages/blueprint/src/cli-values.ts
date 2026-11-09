/**
 * Reads `sdxc-blueprint`'s command line: the blueprint's name, the program's own options, and
 * each value as a flag named after the placeholder in kebab case. How a flag reads depends on
 * the value's kind, so `--beta` stands alone while `--name users` takes the next token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { closest } from "@sdxc/cli";

import type { Value } from "./render.js";
import type { Variable } from "./variables.js";

import { FILTERS } from "./filters.js";

/** The options the program reads itself; a blueprint cannot use them as values. */
export interface ProgramOptions {
	help: boolean;
	list: boolean;
	dryRun: boolean;
	force: boolean;
	json: boolean;
}

/** The program's options by flag, with the key each sets. */
const OPTIONS: Readonly<Record<string, keyof ProgramOptions>> = {
	"--help": "help",
	"-h": "help",
	"--list": "list",
	"--dry-run": "dryRun",
	"--force": "force",
	"--json": "json",
};

/** The flag names a blueprint's values cannot take. */
export const RESERVED_FLAGS: ReadonlySet<string> = new Set([
	"help",
	"list",
	"dry-run",
	"force",
	"json",
]);

/** The command line split into the program's part and the blueprint's. */
export interface SplitArgv {
	options: ProgramOptions;
	blueprint: string | undefined;
	/** Every token that is not one of the program's options or the blueprint's name. */
	values: string[];
	issues: string[];
}

/** Whether `token` is a flag rather than a value. */
function isFlag(token: string): boolean {
	return token.startsWith("-") && token !== "-";
}

/**
 * Splits `argv`. The blueprint's name is the first token that is not a flag, and comes before
 * its values; the program's options may go anywhere.
 */
export function splitArgv(argv: readonly string[]): SplitArgv {
	let options: ProgramOptions = {
		help: false,
		list: false,
		dryRun: false,
		force: false,
		json: false,
	};
	let split: SplitArgv = { options, blueprint: undefined, values: [], issues: [] };
	for (let token of argv) {
		let option = OPTIONS[token];
		if (option !== undefined) {
			options[option] = true;
			continue;
		}
		if (split.blueprint === undefined && !isFlag(token) && split.values.length === 0) {
			split.blueprint = token;
			continue;
		}
		if (split.blueprint === undefined && isFlag(token) && split.values.length === 0) {
			split.issues.push(
				`Name the blueprint before its values: sdxc-blueprint <blueprint> ${token} …`,
			);
		}
		split.values.push(token);
	}
	return split;
}

/** The flag a value is set with: `routePath` is `route-path`. */
export function flagName(variable: string): string {
	let kebab = FILTERS.kebab;
	return kebab === undefined ? variable : kebab(variable);
}

/** The values a run gave, and what went wrong reading them. */
export interface ReadValues {
	values: Record<string, Value>;
	/** Text values no flag gave, as flag names. */
	missing: string[];
	issues: string[];
}

/**
 * Reads `tokens` as values for `variables`. A flag defaults to `false` and a list to empty;
 * text has no default and is reported missing. `--no-<flag>` turns a flag off.
 */
export function readValues(tokens: readonly string[], variables: readonly Variable[]): ReadValues {
	let byFlag = new Map(variables.map((variable) => [flagName(variable.name), variable]));
	let read: ReadValues = { values: {}, missing: [], issues: [] };
	for (let variable of variables) {
		if (variable.kind === "flag") read.values[variable.name] = false;
		if (variable.kind === "list") read.values[variable.name] = [];
	}

	for (let index = 0; index < tokens.length; index += 1) {
		let token = tokens[index] ?? "";
		if (!token.startsWith("--")) {
			read.issues.push(`Unexpected argument ${JSON.stringify(token)}`);
			continue;
		}
		let [name = "", inline] = token.slice(2).split(/=(.*)/s, 2);
		let negated = name.startsWith("no-") && byFlag.get(name.slice(3))?.kind === "flag";
		let variable = byFlag.get(negated ? name.slice(3) : name);
		if (variable === undefined) {
			let suggestion = closest(name, byFlag.keys());
			let hint = suggestion === undefined ? "" : `; did you mean --${suggestion}?`;
			read.issues.push(`Unknown value --${name}${hint}`);
			continue;
		}
		if (variable.kind === "flag") {
			if (inline !== undefined && inline !== "true" && inline !== "false") {
				read.issues.push(`--${name} is a flag; write --${name} or --no-${name}`);
				continue;
			}
			read.values[variable.name] = negated ? false : inline !== "false";
			continue;
		}
		let value = inline;
		if (value === undefined) {
			value = tokens[index + 1];
			index += 1;
		}
		if (value === undefined) {
			read.issues.push(`--${name} needs a value`);
			continue;
		}
		if (variable.kind === "list") {
			let list = read.values[variable.name];
			read.values[variable.name] = typeof list === "object" ? [...list, value] : [value];
			continue;
		}
		if (Object.hasOwn(read.values, variable.name)) {
			read.issues.push(`--${name} was given twice`);
			continue;
		}
		read.values[variable.name] = value;
	}

	for (let variable of variables) {
		if (variable.kind === "text" && !Object.hasOwn(read.values, variable.name)) {
			read.missing.push(flagName(variable.name));
		}
	}
	return read;
}
