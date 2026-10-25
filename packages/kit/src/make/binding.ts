/**
 * `sdxc make secret`, `make binding` and `make do`: edit `cloudflare.config.ts`, append
 * `.env.example` for secrets, re-export a Durable Object from `bootstrap/worker.ts`, and note
 * `sdxc run typegen`, answering what changed for the project's `format` like every other kind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import { addHeaderTags, headerTags, resolveAuthor } from "../author.js";
import { unifiedDiff } from "../diff.js";
import { CONFIG_FILE, ENV_EXAMPLE_FILE, declaredBindings, exampleKeys } from "../doctor/env.js";

import { parseName } from "./names.js";

import type { Made } from "./index.js";

/** Binding kinds `make binding` accepts; `secret` also appends `.env.example`. */
export const BINDING_KINDS = [
	"secret",
	"kv",
	"d1",
	"r2",
	"queue",
	"rateLimit",
	"sendEmail",
	"durableObject",
] as const;

/** One of {@link BINDING_KINDS}. */
export type BindingKind = (typeof BINDING_KINDS)[number];

/** Where a Durable Object class lives. */
export type DoRole = "model" | "service";

/** Context these makers need to print. */
export type BindingContext = Pick<AnyCommandContext, "stdout">;

/** The entry point a Durable Object class is re-exported from, where Cloudflare finds it. */
const WORKER_FILE = "bootstrap/worker.ts";

/** The note every maker here ends with, since `env` is typed from the config it edited. */
const TYPEGEN_NOTE = "Next: sdxc run typegen\n";

/** What a dry run answers: nothing changed and nothing left to note. */
const NOTHING_MADE: Made = { changed: [], notes: [] };

/**
 * Plans and optionally writes a `bindings.<kind>()` entry for `NAME`; `--force` replaces an
 * existing declaration of `NAME` where it stands.
 */
export async function makeBinding(
	ctx: BindingContext,
	root: string,
	input: { kind: BindingKind; name: string; dryRun: boolean; force: boolean },
): Promise<Result<Made, Error>> {
	let key = bindingKey(input.name);
	if (isFailure(key)) return key;
	let config = await wrap(() => readFile(join(root, CONFIG_FILE), "utf8"));
	if (isFailure(config)) return failure(new Error(`No ${CONFIG_FILE} in the project`));
	let existing = declaredBindings(config.data);
	if (existing.has(key.data) && !input.force) {
		return failure(
			new Error(`${key.data} is already declared in ${CONFIG_FILE}; pass --force to replace it`),
		);
	}
	let bindingLine = bindingCall(input.kind, key.data, config.data);
	let afterConfig = insertEnvBinding(config.data, key.data, bindingLine);
	if (isFailure(afterConfig)) return afterConfig;
	let exampleEdit: { before: string; after: string } | null = null;
	if (input.kind === "secret") {
		let example = await wrap(() => readFile(join(root, ENV_EXAMPLE_FILE), "utf8"));
		let before = isFailure(example) ? "" : example.data;
		if (!exampleKeys(before).has(key.data)) {
			let after;
			if (before === "") after = `${key.data}=\n`;
			else if (before.endsWith("\n")) after = `${before}${key.data}=\n`;
			else after = `${before}\n${key.data}=\n`;
			exampleEdit = { before, after };
		}
	}
	if (input.dryRun) {
		ctx.stdout(unifiedDiff(CONFIG_FILE, config.data, afterConfig.data));
		if (exampleEdit !== null) {
			ctx.stdout(
				unifiedDiff(
					ENV_EXAMPLE_FILE,
					exampleEdit.before === "" ? null : exampleEdit.before,
					exampleEdit.after,
				),
			);
		}
		return success(NOTHING_MADE);
	}
	await writeFile(join(root, CONFIG_FILE), afterConfig.data);
	ctx.stdout(`Edited ${CONFIG_FILE}\n`);
	let changed = [CONFIG_FILE];
	if (exampleEdit !== null) {
		await writeFile(join(root, ENV_EXAMPLE_FILE), exampleEdit.after);
		ctx.stdout(`Edited ${ENV_EXAMPLE_FILE}\n`);
		changed.push(ENV_EXAMPLE_FILE);
	}
	return success({ changed, notes: [TYPEGEN_NOTE] });
}

/** `make secret NAME` — shorthand for `make binding secret NAME`. */
export async function makeSecret(
	ctx: BindingContext,
	root: string,
	input: { name: string; dryRun: boolean; force: boolean },
): Promise<Result<Made, Error>> {
	return makeBinding(ctx, root, { ...input, kind: "secret" });
}

/**
 * Writes a Durable Object class stub, re-exports it from `bootstrap/worker.ts`, and declares
 * the binding plus `exports.durableObject` in `cloudflare.config.ts`. A name ending in `do`,
 * in any case, gets the `DO` suffix once: `feed-do` and `FeedDO` both write `FeedDO`.
 */
export async function makeDo(
	ctx: BindingContext,
	root: string,
	input: {
		name: string;
		role: DoRole;
		binding?: string;
		dryRun: boolean;
		force: boolean;
	},
): Promise<Result<Made, Error>> {
	let parsed = parseName(input.name);
	if (isFailure(parsed)) return parsed;
	let stem = parseName(parsed.data.base.replace(/(.)-do$/, "$1"));
	if (isFailure(stem)) return stem;
	let className = `${stem.data.pascal}DO`;
	let binding =
		input.binding !== undefined ? bindingKey(input.binding) : success(snakeUpper(stem.data.base));
	if (isFailure(binding)) return binding;
	let folder = input.role === "model" ? "app/models" : "app/services";
	let file = `${folder}/${parsed.data.segments.join("/")}.ts`;
	let stub = addHeaderTags(
		durableObjectStub(className),
		headerTags(await resolveAuthor(join(root, dirname(file)))),
	);
	let config = await wrap(() => readFile(join(root, CONFIG_FILE), "utf8"));
	if (isFailure(config)) return failure(new Error(`No ${CONFIG_FILE} in the project`));
	let worker = await wrap(() => readFile(join(root, WORKER_FILE), "utf8"));
	if (isFailure(worker)) return failure(new Error("No bootstrap/worker.ts in the project"));
	let existing = declaredBindings(config.data);
	if (existing.has(binding.data) && !input.force) {
		return failure(
			new Error(`${binding.data} is already declared in ${CONFIG_FILE}; pass --force`),
		);
	}
	let afterConfig = insertDurableObject(config.data, binding.data, className);
	if (isFailure(afterConfig)) return afterConfig;
	let exportLine = `export { ${className} } from "~/${file.replace(/\.ts$/, "")}";\n`;
	let afterWorker = worker.data.includes(`export { ${className} }`)
		? worker.data
		: `${worker.data.trimEnd()}\n\n${exportLine}`;
	if (input.dryRun) {
		ctx.stdout(unifiedDiff(file, null, stub));
		ctx.stdout(unifiedDiff(CONFIG_FILE, config.data, afterConfig.data));
		ctx.stdout(unifiedDiff(WORKER_FILE, worker.data, afterWorker));
		return success(NOTHING_MADE);
	}
	let replaced = input.force && (await exists(join(root, file)));
	await mkdir(dirname(join(root, file)), { recursive: true });
	let written = await wrap(() =>
		writeFile(join(root, file), stub, { flag: input.force ? "w" : "wx" }),
	);
	if (isFailure(written)) {
		if ((written.error as NodeJS.ErrnoException).code === "EEXIST") {
			return failure(new Error(`${file} already exists; pass --force to replace it`));
		}
		return written;
	}
	ctx.stdout(`${replaced ? "Replaced" : "Wrote"} ${file}\n`);
	await writeFile(join(root, CONFIG_FILE), afterConfig.data);
	ctx.stdout(`Edited ${CONFIG_FILE}\n`);
	let changed = [file, CONFIG_FILE];
	if (afterWorker !== worker.data) {
		await writeFile(join(root, WORKER_FILE), afterWorker);
		ctx.stdout(`Edited ${WORKER_FILE}\n`);
		changed.push(WORKER_FILE);
	}
	return success({ changed, notes: [TYPEGEN_NOTE] });
}

/** Whether `path` exists. */
async function exists(path: string): Promise<boolean> {
	return !isFailure(await wrap(() => stat(path)));
}

/** `NAME` as an env binding key: already `SCREAMING_SNAKE` or derived from kebab/camel. */
function bindingKey(name: string): Result<string, Error> {
	if (/^[A-Z][A-Z0-9_]*$/.test(name)) return success(name);
	let parsed = parseName(name.replaceAll("_", "-"));
	if (isFailure(parsed)) {
		return failure(new Error(`"${name}" is not a binding name`));
	}
	return success(snakeUpper(parsed.data.base));
}

function snakeUpper(kebab: string): string {
	return kebab.replaceAll("-", "_").toUpperCase();
}

/**
 * The declaration `make binding` writes for `kind`. Named resources take the key in kebab case,
 * after the Worker for a database or a queue, so a new binding never shares the template's; a
 * rate limit takes the next namespace number `config` leaves free.
 */
function bindingCall(kind: BindingKind, key: string, config: string): string {
	let kebab = key.toLowerCase().replaceAll("_", "-");
	switch (kind) {
		case "secret":
		case "sendEmail":
			return `${key}: bindings.${kind}()`;
		case "rateLimit":
			return `${key}: bindings.rateLimit({ namespace: "${freeNamespace(config)}", simple: { limit: 100, period: 60 } })`;
		case "kv":
			return `${key}: bindings.kv({ id: "00000000000000000000000000000000" })`;
		case "d1":
			return `${key}: bindings.d1({ name: \`\${manifest.name}-${kebab}\`, id: "00000000-0000-4000-8000-000000000000" })`;
		case "r2":
			return `${key}: bindings.r2({ name: "${kebab}" })`;
		case "queue":
			return `${key}: bindings.queue({ name: \`\${manifest.name}-${kebab}\` })`;
		default:
			return `${key}: bindings.durableObject({ worker: manifest.name, exportName: "${pascalOf(kebab)}DO" })`;
	}
}

/** One above the highest rate-limit namespace `config` declares, and `1001` when it declares none. */
function freeNamespace(config: string): number {
	let taken = [...config.matchAll(/namespace\s*:\s*"(\d+)"/g)].map((match) => Number(match[1]));
	return Math.max(1000, ...taken) + 1;
}

/** `user-uploads` as `UserUploads`. */
function pascalOf(kebab: string): string {
	return kebab
		.split("-")
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join("");
}

/**
 * Puts `line` into the Worker's `env: { … }` object: in place of an existing declaration of
 * `key`, keeping its comment and position, or as the object's first entry.
 */
function insertEnvBinding(source: string, key: string, line: string): Result<string, Error> {
	let declared = new RegExp(`^([ \\t]*)${key}\\s*:\\s*bindings\\.\\w+\\s*\\([^)]*\\)\\s*,?`, "m");
	let existing = declared.exec(source);
	if (existing !== null) {
		let indent = existing[1] ?? "";
		return success(
			`${source.slice(0, existing.index)}${indent}${line},${source.slice(existing.index + existing[0].length)}`,
		);
	}
	let env = /env\s*:\s*\{/.exec(source);
	if (env === null) {
		return failure(new Error(`${CONFIG_FILE} has no env: { … } block to edit`));
	}
	let start = env.index + env[0].length;
	return success(`${source.slice(0, start)}\n\t\t\t${line},${source.slice(start)}`);
}

/** Declares the DO export and env binding in `cloudflare.config.ts`. */
function insertDurableObject(
	source: string,
	binding: string,
	className: string,
): Result<string, Error> {
	let withExport = source;
	if (!source.includes(`exports`) || !/exports\s*:\s*\{/.test(source)) {
		let worker = /worker\s*:\s*\{/.exec(source);
		if (worker === null || worker.index === undefined) {
			return failure(new Error(`${CONFIG_FILE} has no worker: { … } block`));
		}
		let insertAt = worker.index + worker[0].length;
		withExport = `${source.slice(0, insertAt)}\n\t\texports: {\n\t\t\t${className}: exports.durableObject({ storage: "sqlite" }),\n\t\t},${source.slice(insertAt)}`;
		if (
			!/import\s*\{[^}]*\bexports\b/.test(withExport) &&
			withExport.includes('from "cf/config"')
		) {
			withExport = withExport.replace(
				/import\s*\{([^}]+)\}\s*from\s*"cf\/config"/,
				(_match, names: string) => {
					let list = names.split(",").map((part: string) => part.trim());
					if (!list.includes("exports")) list.push("exports");
					return `import { ${list.join(", ")} } from "cf/config"`;
				},
			);
		}
	} else if (!withExport.includes(`${className}:`)) {
		let exportsBlock = /exports\s*:\s*\{/.exec(withExport);
		if (exportsBlock === null || exportsBlock.index === undefined) {
			return failure(new Error(`${CONFIG_FILE} exports block is malformed`));
		}
		let at = exportsBlock.index + exportsBlock[0].length;
		withExport = `${withExport.slice(0, at)}\n\t\t\t${className}: exports.durableObject({ storage: "sqlite" }),${withExport.slice(at)}`;
	}
	let line = `${binding}: bindings.durableObject({ worker: manifest.name, exportName: "${className}" })`;
	return insertEnvBinding(withExport, binding, line);
}

/** Minimal Durable Object class stub; `@author` / `@copyright` are added by {@link makeDo}. */
function durableObjectStub(className: string): string {
	return `/**
 * The ${className} Durable Object: one instance per name, with storage of its own.
 */

import { DurableObject } from "cloudflare:workers";

/** Durable Object class re-exported from bootstrap/worker.ts for its binding. */
export class ${className} extends DurableObject<Cloudflare.Env> {
	/** Answers every request a stub forwards with the class name, until the object serves its own. */
	override fetch(): Response {
		return new Response("${className}");
	}
}
`;
}
