/**
 * `sdxc destroy <kind> <name>`: the reverse of `sdxc make`. It removes the file, its test, its
 * pairing `.spec` and, for a model, its factory, then the mapping that loads the file, the
 * declaration that mapping names and the Worker trigger of a schedule no other job runs on.
 * Every other reference is listed for the user to remove.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, stat } from "node:fs/promises";
import { join, posix } from "node:path";

import type { Token } from "@sdxc/codemod";
import type { Result } from "@sdxc/result";

import { findStatements, removeProperty, removeStatements, tokenize } from "@sdxc/codemod";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { FileEdit } from "./make/declare.js";
import type { DestroyKind, KindName } from "./make/kinds.js";

import { listFiles } from "./doctor/files.js";
import { exists, folderOf, specPathOf } from "./make/generate.js";
import { KINDS } from "./make/kinds.js";
import { parseName } from "./make/names.js";
import { planUntrigger } from "./make/trigger.js";
import { declaredJobs, normalized } from "./schedule.js";

/** The builder call each declared kind's declarations module passes its object to. */
const DECLARATION_CALLS: Partial<Record<KindName, string>> = {
	controller: "route",
	job: "jobs",
	command: "commands",
	email: "emails",
};

/** The folders whose code may still reference a destroyed file. */
const REFERENCING_FOLDERS = ["app", "bootstrap", "config", "database", "resources", "routes"];

/** What one `destroy` would do. */
export interface DestroyPlan {
	/** The files it deletes, relative to the project root. */
	remove: string[];
	edits: FileEdit[];
	/** Each line of the project's code that still names the file or its declaration. */
	references: string[];
	/** What the user should know beside the edits, such as the migration a model keeps. */
	notes: string[];
}

/** What `destroy` was asked for. */
export interface DestroyInput {
	kind: DestroyKind;
	name: string;
	/** `mcp`: a resource in `app/mcp/resources/` instead of a tool. */
	resource: boolean;
}

/** Every spelling a module of the project may import `file` by, from the module `from`. */
function specifiers(file: string, from: string): string[] {
	let bare = file.replace(/\.[cm]?[jt]sx?$/, "");
	let relative = posix.relative(posix.dirname(from), bare);
	let local = relative.startsWith(".") ? relative : `./${relative}`;
	let extension = file.slice(bare.length);
	return [`~/${bare}`, `~/${file}`, `~/${bare}.js`, local, `${local}${extension}`, `${local}.js`];
}

/** The project file a specifier written in `from` names, or `null` for a package. */
async function resolveModule(
	root: string,
	from: string,
	specifier: string,
): Promise<string | null> {
	let base = specifier.startsWith("~/")
		? specifier.slice(2)
		: specifier.startsWith(".")
			? posix.normalize(posix.join(posix.dirname(from), specifier))
			: null;
	if (base === null) return null;
	let bare = base.replace(/\.[cm]?js$/, "");
	for (let candidate of [base, `${bare}.ts`, `${bare}.tsx`, `${bare}/index.ts`]) {
		let found = await wrap(() => stat(join(root, candidate)));
		if (!isFailure(found) && found.data.isFile()) return candidate;
	}
	return null;
}

/** The text of `path`: from `edits` when an earlier step changed it, from disk otherwise. */
async function current(
	root: string,
	edits: readonly FileEdit[],
	path: string,
): Promise<string | null> {
	let edited = edits.find((edit) => edit.path === path);
	if (edited !== undefined) return edited.after;
	let read = await wrap(() => readFile(join(root, path), "utf8"));
	return isFailure(read) ? null : read.data;
}

/** Records `after` as the new text of `path`, merging with an earlier edit of the same file. */
async function record(root: string, edits: FileEdit[], path: string, after: string): Promise<void> {
	let index = edits.findIndex((edit) => edit.path === path);
	if (index !== -1) {
		edits[index] = { ...(edits[index] as FileEdit), after };
		return;
	}
	let before = await wrap(() => readFile(join(root, path), "utf8"));
	if (!isFailure(before)) edits.push({ path, before: before.data, after });
}

/**
 * Removes the mapping of `file` from every initializer and, for a declared kind, the
 * declaration the mapping names; answers the declaration's dotted path, or `null`.
 */
async function unmap(
	root: string,
	kind: KindName,
	file: string,
	resource: boolean,
	edits: FileEdit[],
	notes: string[],
): Promise<string | null> {
	let declared: string | null = null;
	for (let initializer of await listFiles(root, "app/initializers")) {
		let source = await current(root, edits, initializer);
		if (source === null) continue;
		for (let specifier of specifiers(file, initializer)) {
			let found = findStatements(initializer, source, { specifier });
			if (isFailure(found) || found.data.length === 0) continue;
			for (let statement of found.data) {
				let member =
					/\.map\(\s*([A-Za-z_$][\w$]*)((?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[\s*"[^"]+"\s*\])+)/.exec(
						statement.text,
					);
				if (member === null) continue;
				let local = member[1] as string;
				let path = [
					...(member[2] ?? "").matchAll(/\.\s*([A-Za-z_$][\w$]*)|\[\s*"([^"]+)"\s*\]/g),
				].map((part) => (part[1] ?? part[2]) as string);
				declared = [local, ...path].join(".");
				let imported = new RegExp(`import\\s+${local}\\s+from\\s+"([^"]+)"`).exec(source)?.[1];
				let module =
					imported === undefined ? null : await resolveModule(root, initializer, imported);
				let call = kind === "mcp" ? (resource ? "resources" : "tools") : DECLARATION_CALLS[kind];
				if (module === null || call === undefined || path.length === 0) continue;
				let declarations = await current(root, edits, module);
				if (declarations === null) continue;
				let removed = { ok: false, source: declarations };
				for (let argument of [0, 1]) {
					let attempt = removeProperty(module, declarations, {
						call,
						argument,
						path: path.slice(0, -1),
						key: path.at(-1) as string,
					});
					if (!isFailure(attempt)) {
						removed = { ok: true, source: attempt.data.source };
						break;
					}
				}
				if (removed.ok) await record(root, edits, module, removed.source);
				else
					notes.push(
						`Remove ${path.join(".")} from ${module} by hand; sdxc destroy could not find it\n`,
					);
				if (kind === "controller") await undecideSitemap(root, path, edits);
			}
			let unmapped = removeStatements(initializer, source, { specifier });
			if (!isFailure(unmapped) && unmapped.data.changed) {
				source = unmapped.data.source;
				await record(root, edits, initializer, source);
			}
		}
	}
	return declared;
}

/**
 * Removes the sitemap decision `sdxc make controller` added for the route at `path` from every
 * controller that builds a sitemap with `fromRoutes(routes, origin, { … })`.
 */
async function undecideSitemap(
	root: string,
	path: readonly string[],
	edits: FileEdit[],
): Promise<void> {
	for (let file of await listFiles(root, "app/http/controllers")) {
		if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
		let source = await current(root, edits, file);
		if (source === null || !source.includes("fromRoutes(")) continue;
		let removed = removeProperty(file, source, {
			call: "fromRoutes",
			argument: 2,
			path: path.slice(0, -1),
			key: path.at(-1) as string,
		});
		if (!isFailure(removed)) await record(root, edits, file, removed.data.source);
	}
}

/** `text` matched literally inside a regular expression, every syntax character escaped. */
function escapeRegExp(text: string): string {
	return text.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");
}

/**
 * Whether `name` is used in the code of `source` outside its import declarations: as an
 * identifier that is no property name, or in JSX markup. Comments and strings never count, and a
 * file that does not scan counts every name as used, so nothing of it is pruned.
 */
function usedOutsideImports(filename: string, source: string, name: string): boolean {
	let tokens = tokenize(filename, source);
	if (isFailure(tokens)) return true;
	let code = tokens.data.filter((token) => token.type !== "comment");
	let markup = new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`);
	for (let index = 0; index < code.length; index += 1) {
		let token = code[index] as Token;
		let previous = code[index - 1];
		let next = code[index + 1];
		let statementStart =
			previous === undefined ||
			token.newlineBefore ||
			(previous.type === "punctuator" && previous.value === ";");
		if (token.type === "identifier" && token.value === "import" && statementStart) {
			if (next?.type === "punctuator" && next.value === "(") continue;
			while (index < code.length && code[index]?.type !== "string") index += 1;
			continue;
		}
		if (token.type === "jsx" && markup.test(token.value)) return true;
		let member = previous?.type === "punctuator" && previous.value === ".";
		if (token.type === "identifier" && token.value === name && !member) return true;
	}
	return false;
}

/**
 * `after` without the import bindings whose last use the edit removed: a binding used outside
 * imports in `before` and nowhere in `after` is dropped, and a declaration left with none goes
 * too, so an import `sdxc make` added for a mapping leaves with it. Every other import stays.
 */
export function pruneImports(filename: string, before: string, after: string): string {
	let gone = (local: string) =>
		usedOutsideImports(filename, before, local) && !usedOutsideImports(filename, after, local);
	return after.replace(
		/^import\s+(?!type\b)([^;"]*?)\s+from\s*("[^"]+");?[ \t]*\r?\n/gm,
		(statement: string, clause: string, specifier: string) => {
			let named = /\{([^}]*)\}/.exec(clause);
			let leading = clause
				.replace(/\{[^}]*\}/, "")
				.replace(/,/g, "")
				.trim();
			let keepLeading = leading !== "" && !gone(leading.replace(/^\*\s*as\s+/, ""));
			let names = (named?.[1] ?? "")
				.split(",")
				.map((part) => part.trim())
				.filter((part) => part !== "");
			let kept = names.filter((part) => {
				let local = part.split(/\s+as\s+/).at(-1) ?? part;
				return !gone(local.replace(/^type\s+/, "").trim());
			});
			if ((leading === "" || keepLeading) && kept.length === names.length) return statement;
			if (!keepLeading && kept.length === 0) return "";
			let parts = [
				...(keepLeading ? [leading] : []),
				...(kept.length === 0 ? [] : [`{ ${kept.join(", ")} }`]),
			];
			return `import ${parts.join(", ")} from ${specifier};\n`;
		},
	);
}

/** Removes the model's entry from `app/models/index.ts`, found by the import its value holds. */
async function unregisterModel(root: string, file: string, edits: FileEdit[]): Promise<void> {
	let registry = "app/models/index.ts";
	let source = await current(root, edits, registry);
	if (source === null) return;
	for (let specifier of specifiers(file, registry)) {
		let escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		let entry = new RegExp(
			`([A-Za-z_$][\\w$]*|"[^"]+")\\s*:\\s*\\(\\)\\s*=>\\s*import\\(\\s*"${escaped}"\\s*\\)`,
		).exec(source);
		if (entry === null) continue;
		let key = (entry[1] as string).replace(/^"|"$/g, "");
		let removed = removeProperty(registry, source, { call: "createModels", key });
		if (!isFailure(removed)) await record(root, edits, registry, removed.data.source);
		return;
	}
}

/**
 * Plans what `sdxc destroy` does for `input` in the project at `root`, writing nothing. A file
 * that does not exist is a failure, so a typo never edits declarations.
 */
export async function planDestroy(
	root: string,
	input: DestroyInput,
): Promise<Result<DestroyPlan, Error>> {
	let name = parseName(input.name);
	if (isFailure(name)) return name;
	let kind = KINDS[input.kind];
	let variant = input.kind === "mcp" && input.resource ? "resource" : null;
	let base = `${folderOf(input.kind, variant)}/${name.data.segments.join("/")}`;
	let file = `${base}${kind.extension}`;
	if (!(await exists(root, file))) {
		return failure(new Error(`${file} does not exist; sdxc destroy removes what sdxc make wrote`));
	}
	let candidates = [file, `${base}.test${kind.extension}`];
	if (kind.specs === true) {
		candidates.push(
			specPathOf({
				kind: input.kind,
				name: name.data,
			}),
		);
	}
	if (input.kind === "model")
		candidates.push(`database/factories/${name.data.segments.join("/")}.ts`);
	let remove: string[] = [];
	for (let candidate of candidates) if (await exists(root, candidate)) remove.push(candidate);

	let edits: FileEdit[] = [];
	let notes: string[] = [];
	let scheduled = input.kind === "job" ? await declaredJobs(root) : [];
	let declared = await unmap(root, input.kind, file, input.resource, edits, notes);
	let job = declared?.split(".").slice(1).join(".");
	let cron = scheduled.find((entry) => entry.job === job)?.cron;
	let shared = scheduled.some(
		(entry) =>
			entry.job !== job && cron !== undefined && normalized(entry.cron) === normalized(cron),
	);
	if (cron !== undefined && !shared) {
		let untrigger = await planUntrigger(root, cron);
		if (untrigger.edit !== null) edits.push(untrigger.edit);
		if (untrigger.note !== null) notes.push(untrigger.note);
	}
	if (input.kind === "model") {
		await unregisterModel(root, file, edits);
		notes.push(
			`The migrations that create its table stay, since a database may have applied them; write one that drops the table with sdxc make migration\n`,
		);
	}

	for (let edit of edits) edit.after = pruneImports(edit.path, edit.before, edit.after);

	let references: string[] = [];
	let removing = new Set([...remove, ...edits.map((edit) => edit.path)]);
	for (let folder of REFERENCING_FOLDERS) {
		for (let path of await listFiles(root, folder)) {
			if (removing.has(path) || !/\.[cm]?[jt]sx?$/.test(path)) continue;
			let source = await current(root, edits, path);
			if (source === null) continue;
			let names = specifiers(file, path).map((specifier) => `"${specifier}"`);
			let member =
				declared === null ? null : new RegExp(`\\b${declared.replaceAll(".", "\\.")}\\b`);
			source.split("\n").forEach((line, index) => {
				if (names.some((quoted) => line.includes(quoted)) || (member?.test(line) ?? false)) {
					references.push(`${path}:${index + 1}: ${line.trim()}`);
				}
			});
		}
	}
	for (let edit of edits) {
		let names = specifiers(file, edit.path).map((specifier) => `"${specifier}"`);
		edit.after.split("\n").forEach((line, index) => {
			if (names.some((quoted) => line.includes(quoted))) {
				references.push(`${edit.path}:${index + 1}: ${line.trim()}`);
			}
		});
	}
	return success({ remove, edits, references, notes });
}
