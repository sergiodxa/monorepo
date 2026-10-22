/**
 * `sdxc fix emails`: maps every email `app/emails/index.ts` declares that
 * `app/initializers/mail.ts` leaves unmapped, through the same codemod `sdxc make email` uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { findModuleReferences, tokenize } from "@sdxc/codemod";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Node } from "../routes/parse.js";

import { unifiedDiff } from "../diff.js";
import { EMAILS_INDEX, MAIL_INITIALIZER } from "../doctor/emails.js";
import { declare } from "../make/declare.js";
import { parseName } from "../make/names.js";
import { Reader } from "../routes/parse.js";

/** Extensions a template specifier without one may resolve to. */
const EXTENSIONS = [".tsx", ".ts", "/index.tsx", "/index.ts"];

/** One mapping the fix applies. */
export interface EmailFix {
	name: string;
	template: string;
	diffs: string[];
}

/**
 * Maps each unmapped declared email onto its template under `app/emails/`. Refuses a name with
 * no template file, or whose declaration cannot be placed automatically.
 */
export async function fixEmails(
	root: string,
	options: { dryRun: boolean },
): Promise<Result<EmailFix[], Error>> {
	let unmapped = await unmappedEmails(root);
	if (isFailure(unmapped)) return unmapped;
	if (unmapped.data.length === 0) return success([]);
	let fixed: EmailFix[] = [];
	for (let name of unmapped.data) {
		let template = await resolveTemplate(root, name);
		if (template === null) {
			return failure(
				new Error(
					`No template under app/emails/ for declared email ${name}; write one with sdxc make email`,
				),
			);
		}
		let parsed = parseName(name.replaceAll(".", "/"));
		if (isFailure(parsed)) return parsed;
		let declared = await declare(
			{
				kind: "email",
				name: parsed.data,
				variant: null,
				method: "get",
				routes: "web",
				handler: template.replace(/\.[cm]?[jt]sx?$/, ""),
				tool: parsed.data.snake,
				uri: "",
				title: parsed.data.title,
			},
			root,
		);
		if (declared.kind === "manual") {
			return failure(
				new Error(
					`Cannot map ${name} automatically (${declared.reason}):\n${declared.instructions}`,
				),
			);
		}
		let diffs: string[] = [];
		for (let edit of declared.edits) {
			diffs.push(unifiedDiff(edit.path, edit.before, edit.after));
			if (!options.dryRun) await writeFile(join(root, edit.path), edit.after);
		}
		fixed.push({ name, template, diffs });
	}
	return success(fixed);
}

/** Declared email names that have no `mail.map` entry. */
async function unmappedEmails(root: string): Promise<Result<string[], Error>> {
	let index = await readModule(root, EMAILS_INDEX);
	if (index === null) return failure(new Error(`No ${EMAILS_INDEX} in the project`));
	let declared = declaredEmails(index);
	if (declared === null) {
		return failure(new Error(`${EMAILS_INDEX} declares no emails({ … })`));
	}
	let initializer = await readModule(root, MAIL_INITIALIZER);
	let mapped = initializer === null ? new Set<string>() : new Set(mappings(initializer).keys());
	return success(declared.filter((name) => !mapped.has(name)));
}

/** The template path under `app/emails/` for a dotted email name, or `null`. */
async function resolveTemplate(root: string, name: string): Promise<string | null> {
	let base = `app/emails/${name.replaceAll(".", "/")}`;
	for (let extension of EXTENSIONS) {
		let path = `${base}${extension}`.replace(/\/index\/index/, "/index");
		if (await exists(root, path)) return path;
	}
	return null;
}

async function exists(root: string, path: string): Promise<boolean> {
	return isFailure(await wrap(() => access(join(root, path)))) === false;
}

interface ReadModule {
	reader: Reader;
	imports: Map<string, { specifier: string; imported: string }>;
}

async function readModule(root: string, path: string): Promise<ReadModule | null> {
	let source = await wrap(() => readFile(join(root, path), "utf8"));
	if (isFailure(source)) return null;
	let tokens = tokenize(path, source.data);
	let references = findModuleReferences(path, source.data);
	if (isFailure(tokens) || isFailure(references)) return null;
	let imports = new Map<string, { specifier: string; imported: string }>();
	for (let reference of references.data) {
		if (reference.kind !== "import") continue;
		for (let bound of reference.names) {
			imports.set(bound.local, { specifier: reference.specifier, imported: bound.imported });
		}
	}
	return { reader: new Reader(tokens.data, source.data), imports };
}

function declaredEmails(module: ReadModule): string[] | null {
	let declarations = module.reader.declarations();
	let exported = declarations.defaultExport;
	if (exported?.kind === "identifier") exported = declarations.locals.get(exported.name) ?? null;
	if (exported?.kind !== "call" || !isImportOf(module, exported.callee, "emails")) return null;
	let tree = exported.args[0]?.node;
	if (tree?.kind !== "object") return null;
	return leaves(module, tree, []);
}

function leaves(module: ReadModule, node: Node, path: readonly string[]): string[] {
	if (node.kind === "call" && isImportOf(module, node.callee, "email")) return [path.join(".")];
	let group = node;
	if (node.kind === "call" && isImportOf(module, node.callee, "emails")) {
		group = node.args[0]?.node ?? node;
	}
	if (group.kind !== "object") return [];
	return group.entries.flatMap((entry) =>
		"key" in entry ? leaves(module, entry.value, [...path, entry.key]) : [],
	);
}

function isImportOf(module: ReadModule, callee: Node, imported: string): boolean {
	return callee.kind === "identifier" && module.imports.get(callee.name)?.imported === imported;
}

function mappings(module: ReadModule): Map<string, string | null> {
	let reader = module.reader;
	let found = new Map<string, string | null>();
	for (let index = 0; index < reader.tokens.length; index += 1) {
		if (!reader.is(index, ".") || !reader.isWord(index + 1, "map") || !reader.is(index + 2, "(")) {
			continue;
		}
		let start = index - 1;
		let call = reader.expression(start, reader.tokens.length).node;
		if (call.kind !== "call") continue;
		let [target] = call.args;
		let name = target === undefined ? null : emailName(target.node);
		if (name === null) continue;
		found.set(name, null);
	}
	return found;
}

function emailName(node: Node): string | null {
	let path: string[] = [];
	let current = node;
	while (current.kind === "member") {
		path.unshift(current.property);
		current = current.object;
	}
	return current.kind === "identifier" && path.length > 0 ? path.join(".") : null;
}
