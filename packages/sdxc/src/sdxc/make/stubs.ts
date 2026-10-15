/**
 * The stubs `sdxc make` writes files from. A project overrides any of them by keeping a file
 * of the same name in `make.stubs`; every other stub comes from the `sdxc` package. A stub is
 * the file's text with `{{placeholder}}`s, and one the kind does not define is an error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import type { KindName } from "./kinds.js";

/** A stub's text and where it was read from, for messages that name it. */
export interface Stub {
	name: string;
	text: string;
	/** Relative to the project root for a project stub, `sdxc/stubs/<name>` for a built-in one. */
	source: string;
}

/** What `sdxc make stubs` did with each stub, by path relative to the project root. */
export interface CopiedStubs {
	written: string[];
	kept: string[];
}

/** A placeholder as stubs spell it: `{{name}}`, spaces inside the braces allowed. */
const PLACEHOLDER = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

/** The stub file name for `kind`, its `variant` and whether it is the test stub. */
export function stubName(kind: KindName, variant: string | null, test: boolean): string {
	return [kind, variant, test ? "test" : null, "stub"].filter((part) => part !== null).join(".");
}

/** The folder of built-in stubs in the `sdxc` package at `packageRoot`. */
export function builtinStubsDir(packageRoot: string): string {
	return join(packageRoot, "stubs");
}

/**
 * The first of `names` that exists, looking in the project's `stubsDir` before the built-in
 * folder for each name in turn; a failure naming every one when none exists.
 *
 * @param root - The project root.
 * @param stubsDir - The configured `make.stubs`, relative to the root.
 */
export async function loadStub(
	names: readonly string[],
	root: string,
	stubsDir: string,
	packageRoot: string,
): Promise<Result<Stub, Error>> {
	for (let name of names) {
		let candidates: Array<[string, string]> = [
			[join(root, stubsDir, name), `${stubsDir}/${name}`],
			[join(builtinStubsDir(packageRoot), name), `sdxc/stubs/${name}`],
		];
		for (let [path, source] of candidates) {
			let text = await wrap(() => readFile(path, "utf8"));
			if (isSuccess(text)) return success({ name, text: text.data, source });
		}
	}
	return failure(new Error(`No stub ${names.join(" or ")} in ${stubsDir} or sdxc`));
}

/**
 * `stub`'s text with every placeholder replaced by its value. A placeholder without a value is
 * a failure naming the stub, the placeholder and the ones the kind accepts.
 */
export function renderStub(
	stub: Stub,
	values: Readonly<Record<string, string>>,
): Result<string, Error> {
	let unknown = [...stub.text.matchAll(PLACEHOLDER)]
		.map((match) => match[1] ?? "")
		.filter((name) => !Object.hasOwn(values, name));
	if (unknown.length > 0) {
		let accepted = Object.keys(values)
			.map((name) => `{{${name}}}`)
			.join(", ");
		return failure(
			new Error(
				`${stub.source} uses {{${unknown[0]}}}, which this kind does not define; it accepts ${accepted}`,
			),
		);
	}
	return success(stub.text.replace(PLACEHOLDER, (_, name: string) => values[name] ?? ""));
}

/**
 * Copies the built-in stubs of `kinds` (all of them when empty) into the project's `stubsDir`,
 * creating it. A stub already there is kept as it is, so a project's edits survive.
 */
export async function copyStubs(
	kinds: readonly KindName[],
	root: string,
	stubsDir: string,
	packageRoot: string,
): Promise<Result<CopiedStubs, Error>> {
	let builtin = await wrap(() => readdir(builtinStubsDir(packageRoot)));
	if (isFailure(builtin)) return builtin;
	let selected = builtin.data
		.filter((name) => name.endsWith(".stub"))
		.filter((name) => kinds.length === 0 || kinds.some((kind) => name.startsWith(`${kind}.`)))
		.sort();
	let outcome: CopiedStubs = { written: [], kept: [] };
	let copied = await wrap(async () => {
		await mkdir(join(root, stubsDir), { recursive: true });
		for (let name of selected) {
			let target = join(root, stubsDir, name);
			let relative = `${stubsDir}/${name}`;
			if (isSuccess(await wrap(() => stat(target)))) {
				outcome.kept.push(relative);
				continue;
			}
			let text = await readFile(join(builtinStubsDir(packageRoot), name), "utf8");
			await writeFile(target, text, { flag: "wx" });
			outcome.written.push(relative);
		}
	});
	if (isFailure(copied)) return copied;
	return success(outcome);
}
