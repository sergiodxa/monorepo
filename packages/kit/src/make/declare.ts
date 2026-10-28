/**
 * Declares and maps what `make job`, `make controller`, `make mcp` and `make command` generate:
 * the entry in the job map, route contract, MCP or command declaration module, and the mapping
 * in the initializer that serves it, plus a page's sitemap decision; `make model` registers the
 * model in `app/models/index.ts` and `make policy` a resource's abilities and grants the same
 * way. Every edit is computed before anything is written; when one cannot be placed, none is
 * made and the command prints them for the user instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";

import type { ModuleReference } from "@sdxc/codemod";
import type { Result } from "@sdxc/result";

import { addElement, addProperty, findModuleReferences, insertAfterLast } from "@sdxc/codemod";
import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import type { Name } from "./names.js";

import { literal, memberAccess } from "./generate.js";
import { ensureImport, ensureTypeImport, resolvesTo, specifierFor } from "./imports.js";
import { camel } from "./names.js";

/** What to declare and map, as the command line asked for it. */
export interface DeclarationRequest {
	kind: "job" | "controller" | "mcp" | "command" | "model" | "policy" | "email";
	name: Name;
	/** `cron` for a scheduled job, `resource` for an MCP resource, `null` otherwise. */
	variant: string | null;
	/** The schedule of a `cron` job. */
	cron?: string;
	/** A controller's route method: `get`, `post`, `put`, `patch`, `delete` or `form`. */
	method: string;
	/** A controller's route pattern; `/<name>` when omitted. */
	pattern?: string;
	/** The route contract a controller is declared in, a module in `routes/`. */
	routes: string;
	/** The generated handler, relative to the project root, without its extension. */
	handler: string;
	/** The MCP tool name or resource URI, and the title its description is written from. */
	tool: string;
	uri: string;
	title: string;
	/** A page's sitemap decision in place of the one its pattern implies. */
	sitemap?: string;
	/** A tool's or a command's options in place of the empty ones `make` declares; an email's props. */
	options?: DeclarationOptions;
}

/**
 * The options of a tool or a command whose input the caller knows: the object literal's lines,
 * written with the local name each of `imports` is bound to in the declarations module, which
 * gains the import when it lacks it. A tool's lines replace its description and input too.
 */
export interface DeclarationOptions {
	/** The schema builder `s`, and a command's `argument` and `flag`. */
	imports: readonly ("s" | "argument" | "flag")[];
	lines: (locals: Readonly<Record<string, string>>) => string[];
}

/** One file's text before and after an edit, by path relative to the project root. */
export interface FileEdit {
	path: string;
	before: string;
	after: string;
}

/**
 * What `declare` decided. `path` is the declaration's key path in its map, which the handler's
 * stub reads as `{{path}}`. `manual` carries the reason and both edits to make by hand.
 */
export type Declared =
	| { kind: "edits"; path: string; edits: FileEdit[] }
	| { kind: "manual"; path: string; reason: string; instructions: string };

/** A file read from the project, with the module references its imports and mappings hold. */
interface SourceFile {
	path: string;
	source: string;
	references: ModuleReference[];
	/** Whether the project's `tsconfig.json` declares the `~/app/*` alias. */
	aliased?: boolean;
}

/** The `remix/routes` helper each `--method` declares with; `form` adds a page and an action. */
const ROUTE_HELPERS: Readonly<Record<string, string>> = {
	get: "get",
	post: "post",
	put: "put",
	patch: "patch",
	delete: "del",
	form: "form",
};

/** The route helpers that declare a page, which a sitemap built with `fromRoutes` must decide. */
const PAGE_HELPERS = new Set(["get", "form"]);

/** The name an instance gets when the initializer that creates it cannot be read, by factory. */
const INSTANCE_NAMES: Readonly<Record<string, string>> = {
	createRouter: "router",
	createHandler: "mcp",
	createCLI: "cli",
	createMail: "mail",
};

/** Plans the declaration and mapping for `request` in the project at `root`. */
export async function declare(request: DeclarationRequest, root: string): Promise<Declared> {
	if (request.kind === "job") return declareJob(request, root);
	if (request.kind === "controller") return declareController(request, root);
	if (request.kind === "command") return declareCommand(request, root);
	if (request.kind === "model") return declareModel(request, root);
	if (request.kind === "policy") return declarePolicy(request, root);
	if (request.kind === "email") return declareEmail(request, root);
	return declareMcp(request, root);
}

/** Declares a job in `app/jobs/index.ts` and maps it on the job dispatcher. */
async function declareJob(request: DeclarationRequest, root: string): Promise<Declared> {
	let declarations = "app/jobs/index.ts";
	let module = "app/jobs/index";
	let { name } = request;
	let initializer = await findInitializer(root, module, "createJobDispatcher");
	let instance =
		initializer === null ? "dispatcher" : instanceOf(initializer, "createJobDispatcher");
	let local = initializer === null ? "jobs" : (defaultLocal(initializer, module) ?? "jobs");
	let groups = initializer === null ? null : reusedGroup(initializer, instance, local, name);
	let path = [...(groups ?? name.segments.slice(0, -1).map(camel)), name.key];
	let value =
		request.variant === "cron"
			? `job({ cron: ${literal(request.cron ?? "")} })`
			: "job({ input: s.object({}) })";
	let handler =
		initializer === null ? `~/${request.handler}` : handlerSpecifier(initializer, request.handler);
	let statement = `${instance}.map(${local}.${path.join(".")}, () => import(${literal(handler)}));`;
	let manual = (reason: string): Declared => ({
		kind: "manual",
		path: path.join("."),
		reason,
		instructions: instructions(
			`${declarations}, in jobs({ … })${groupNote(path)}`,
			`${path.at(-1)}: ${value},`,
			initializer?.path ?? "the job dispatcher's initializer",
			statement,
		),
	});
	if (initializer === null)
		return manual("no initializer in app/initializers/ creates the job dispatcher");
	let file = await readSource(root, declarations);
	if (isFailure(file)) return manual(`${declarations} could not be read`);

	let jobsSpecifier = file.data.references.find(
		(reference) =>
			reference.kind === "import" && reference.names.some((bound) => bound.imported === "jobs"),
	)?.specifier;
	if (jobsSpecifier === undefined) return manual(`${declarations} does not import jobs()`);
	let builder = ensureImport(
		declarations,
		file.data.source,
		{ kind: "named", name: "job" },
		(specifier) => specifier === jobsSpecifier,
		jobsSpecifier,
		"job",
	);
	if (isFailure(builder)) return manual(builder.error.message);
	let jobLocal = builder.data.local;
	let source = builder.data.source;
	value = value.replace(/^job\(/, `${jobLocal}(`);
	if (request.variant !== "cron") {
		let schema = ensureImport(
			declarations,
			source,
			{ kind: "namespace" },
			(specifier) => specifier === "remix/data-schema",
			"remix/data-schema",
			"s",
		);
		if (isFailure(schema)) return manual(schema.error.message);
		value = `${jobLocal}({ input: ${schema.data.local}.object({}) })`;
		source = schema.data.source;
	}
	let added = addProperty(declarations, source, {
		call: "jobs",
		path: path.slice(0, -1),
		key: name.key,
		value,
	});
	if (isFailure(added)) return manual(added.error.message);

	let mapped = mapAfter(
		initializer,
		module,
		local,
		statement,
		`${instance}.map`,
		"createJobDispatcher",
	);
	if (isFailure(mapped)) return manual(mapped.error.message);
	return {
		kind: "edits",
		path: path.join("."),
		edits: [
			{ path: declarations, before: file.data.source, after: added.data.source },
			{ path: initializer.path, before: initializer.source, after: mapped.data },
		],
	};
}

/** Declares a route in the contract `routes/<contract>.ts` and maps it on the router. */
async function declareController(request: DeclarationRequest, root: string): Promise<Declared> {
	let { name } = request;
	let module = `routes/${request.routes}`;
	let contract = await findContract(root, module);
	let initializer = await findInitializer(root, module, "createRouter", "required");
	let instance = initializer === null ? "router" : instanceOf(initializer, "createRouter");
	let local = initializer === null ? "routes" : (defaultLocal(initializer, module) ?? "routes");
	let path = [...name.segments.slice(0, -1).map(camel), name.key];
	let helper = ROUTE_HELPERS[request.method] ?? "get";
	let pattern = request.pattern ?? `/${name.segments.join("/")}`;
	let value = `${helper}(${literal(pattern)})`;
	let handler =
		initializer === null ? `~/${request.handler}` : handlerSpecifier(initializer, request.handler);
	let lazyLocal = "lazy";
	let statement = (lazy: string) =>
		`${instance}.map(${local}.${path.join(".")}, ${lazy}(() => import(${literal(handler)})));`;
	let sitemap = PAGE_HELPERS.has(helper) ? await findSitemap(root, module) : null;
	let decision = request.sitemap ?? sitemapDecision(helper, pattern);
	let manual = (reason: string): Declared => ({
		kind: "manual",
		path: path.join("."),
		reason,
		instructions: [
			instructions(
				`${contract ?? `${module}.ts`}, in route({ … })${groupNote(path)}`,
				`${path.at(-1)}: ${value},`,
				initializer?.path ?? `the initializer that maps ${module}`,
				statement(lazyLocal),
			),
			sitemap === null
				? null
				: [
						`In ${sitemap.path}, in fromRoutes(…)'s decisions${groupNote(path)}:`,
						indent(`${path.at(-1)}: ${decision},`),
					].join("\n"),
		]
			.filter((text) => text !== null)
			.join("\n"),
	});
	if (contract === null) return manual(`there is no route contract ${module}.ts`);
	if (initializer === null) return manual(`no initializer in app/initializers/ imports ${module}`);
	let file = await readSource(root, contract);
	if (isFailure(file)) return manual(`${contract} could not be read`);

	let imported = ensureImport(
		contract,
		file.data.source,
		{ kind: "named", name: helper },
		(specifier) => specifier === "remix/routes",
		"remix/routes",
		helper,
	);
	if (isFailure(imported)) return manual(imported.error.message);
	value = `${imported.data.local}(${literal(pattern)})`;
	let added = addProperty(contract, imported.data.source, {
		call: "route",
		path: path.slice(0, -1),
		key: name.key,
		value,
	});
	if (isFailure(added)) return manual(added.error.message);

	let lazy = ensureImport(
		initializer.path,
		initializer.source,
		{ kind: "named", name: "lazy" },
		(specifier) => specifier.endsWith("lazy-route"),
		"@sdxc/lazy-route",
		"lazy",
	);
	if (isFailure(lazy)) return manual(lazy.error.message);
	lazyLocal = lazy.data.local;
	let withLazy = { ...initializer, source: lazy.data.source };
	let mapped = mapAfter(
		withLazy,
		module,
		local,
		statement(lazyLocal),
		`${instance}.map`,
		"createRouter",
	);
	if (isFailure(mapped)) return manual(mapped.error.message);
	let edits: FileEdit[] = [
		{ path: contract, before: file.data.source, after: added.data.source },
		{ path: initializer.path, before: initializer.source, after: mapped.data },
	];
	if (sitemap !== null) {
		let decided = addProperty(sitemap.path, sitemap.source, {
			call: "fromRoutes",
			argument: 2,
			path: path.slice(0, -1),
			key: name.key,
			value: decision,
		});
		if (isSuccess(decided)) {
			edits.push({ path: sitemap.path, before: sitemap.source, after: decided.data.source });
		} else if (decided.error.code === "invalid-output") {
			return manual(decided.error.message);
		}
	}
	return { kind: "edits", path: path.join("."), edits };
}

/**
 * The sitemap decision a new page starts with: listed, or an empty list of pages when its pattern
 * has required params, so it is in the sitemap until the developer changes it. A `form` route
 * decides its page under `index`.
 */
function sitemapDecision(helper: string, pattern: string): string {
	let required = /[:*][A-Za-z_$]/.test(pattern.replace(/\([^)]*\)/g, ""));
	let page = required ? "[]" : "true";
	return helper === "form" ? `{ index: ${page} }` : page;
}

/**
 * The controller that builds a sitemap with `fromRoutes` over the contract `module`, which needs
 * a decision for every page the contract declares; `null` when the app has none.
 */
async function findSitemap(root: string, module: string): Promise<SourceFile | null> {
	let folder = "app/http/controllers";
	let entries = await wrap(() => readdir(join(root, folder), { recursive: true }));
	if (isFailure(entries)) return null;
	for (let entry of entries.data.sort()) {
		if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
		let file = await readSource(root, posix.join(folder, entry.split("\\").join("/")));
		if (isFailure(file) || !file.data.source.includes("fromRoutes(")) continue;
		let local = defaultLocal(file.data, module);
		if (local === null) continue;
		if (new RegExp(`\\bfromRoutes\\(\\s*${escape(local)}\\s*,`).test(file.data.source)) {
			return file.data;
		}
	}
	return null;
}

/** Declares an MCP tool or resource beside the others and maps it on the MCP handler. */
async function declareMcp(request: DeclarationRequest, root: string): Promise<Declared> {
	let resource = request.variant === "resource";
	let group = resource ? "resources" : "tools";
	let module = `app/mcp/${group}/index`;
	let declarations = `${module}.ts`;
	let { name } = request;
	let initializer = await findInitializer(root, module, "createHandler");
	let instance = initializer === null ? "mcp" : instanceOf(initializer, "createHandler");
	let preferred = resource ? "resourceset" : "toolset";
	let local = initializer === null ? preferred : (defaultLocal(initializer, module) ?? preferred);
	let path = [...name.segments.slice(0, -1).map(camel), name.key];
	let builder = resource ? "resource" : "tool";
	let body = resource
		? [`name: ${literal(request.title)},`, 'mimeType: "text/markdown",']
		: [`description: ${literal(`${request.title}.`)},`, "input: s.object({}),"];
	let first = resource ? request.uri : request.tool;
	let valueWith = (callee: string, lines: string[]) =>
		`${callee}(${literal(first)}, {\n${lines.map((line) => `\t${line}`).join("\n")}\n})`;
	let value = valueWith(builder, body);
	let handler =
		initializer === null ? `~/${request.handler}` : handlerSpecifier(initializer, request.handler);
	let statement = (lazy: string) =>
		`${instance}.${group}.map(${local}.${path.join(".")}, ${lazy}(() => import(${literal(handler)})));`;
	let manual = (reason: string): Declared => ({
		kind: "manual",
		path: path.join("."),
		reason,
		instructions: instructions(
			`${declarations}, in ${group}({ … })${groupNote(path)}`,
			`${path.at(-1)}: ${value},`,
			initializer?.path ?? "the MCP handler's initializer",
			statement("lazy"),
		),
	});
	if (initializer === null)
		return manual("no initializer in app/initializers/ creates the MCP handler");
	let file = await readSource(root, declarations);
	if (isFailure(file)) return manual(`${declarations} could not be read`);

	let mcpSpecifier = file.data.references.find(
		(reference) =>
			reference.kind === "import" && reference.names.some((bound) => bound.imported === group),
	)?.specifier;
	if (mcpSpecifier === undefined) return manual(`${declarations} does not import ${group}()`);
	let builderImport = ensureImport(
		declarations,
		file.data.source,
		{ kind: "named", name: builder },
		(specifier) => specifier === mcpSpecifier,
		mcpSpecifier,
		builder,
	);
	if (isFailure(builderImport)) return manual(builderImport.error.message);
	let source = builderImport.data.source;
	if (!resource) {
		let schemaSpecifier = jsonSchemaBeside(mcpSpecifier);
		let schema = ensureImport(
			declarations,
			source,
			{ kind: "namespace" },
			(specifier) => specifier === schemaSpecifier,
			schemaSpecifier,
			"s",
		);
		if (isFailure(schema)) return manual(schema.error.message);
		source = schema.data.source;
		body[1] = `input: ${schema.data.local}.object({}),`;
		if (request.options !== undefined) body = request.options.lines({ s: schema.data.local });
	}
	let added = addProperty(declarations, source, {
		call: group,
		path: path.slice(0, -1),
		key: name.key,
		value: valueWith(builderImport.data.local, body),
	});
	if (isFailure(added)) return manual(added.error.message);

	let handlerSource = initializer.references.find(
		(reference) =>
			reference.kind === "import" &&
			reference.names.some((bound) => bound.imported === "createHandler"),
	)?.specifier;
	if (handlerSource === undefined)
		return manual(`${initializer.path} does not import createHandler`);
	let lazy = ensureImport(
		initializer.path,
		initializer.source,
		{ kind: "named", name: "lazy" },
		(specifier) => specifier === handlerSource,
		handlerSource,
		"lazy",
	);
	if (isFailure(lazy)) return manual(lazy.error.message);
	let withLazy = { ...initializer, source: lazy.data.source };
	let mapped = mapAfter(
		withLazy,
		module,
		local,
		statement(lazy.data.local),
		`${instance}.${group}.map`,
		"createHandler",
	);
	if (isFailure(mapped)) return manual(mapped.error.message);
	return {
		kind: "edits",
		path: path.join("."),
		edits: [
			{ path: declarations, before: file.data.source, after: added.data.source },
			{ path: initializer.path, before: initializer.source, after: mapped.data },
		],
	};
}

/**
 * Declares an email in `app/emails/index.ts`, with the props its fields describe, and maps its
 * template on the email registry through `lazy()`, imported from the package that provides
 * `createMail`.
 */
async function declareEmail(request: DeclarationRequest, root: string): Promise<Declared> {
	let module = "app/emails/index";
	let declarations = `${module}.ts`;
	let { name } = request;
	let initializer = await findInitializer(root, module, "createMail");
	let instance = initializer === null ? "mail" : instanceOf(initializer, "createMail");
	let local = initializer === null ? "emails" : (defaultLocal(initializer, module) ?? "emails");
	let path = [...name.segments.slice(0, -1).map(camel), name.key];
	let lines = (s: string) => request.options?.lines({ s }) ?? [`props: ${s}.object({}),`];
	let valueWith = (callee: string, s: string) =>
		`${callee}({\n${lines(s)
			.map((line) => `\t${line}`)
			.join("\n")}\n})`;
	let handler =
		initializer === null ? `~/${request.handler}` : handlerSpecifier(initializer, request.handler);
	let statement = (lazy: string) =>
		`${instance}.map(${local}.${path.join(".")}, ${lazy}(() => import(${literal(handler)})));`;
	let manual = (reason: string): Declared => ({
		kind: "manual",
		path: path.join("."),
		reason,
		instructions: instructions(
			`${declarations}, in emails({ … })${groupNote(path)}`,
			`${path.at(-1)}: ${valueWith("email", "s")},`,
			initializer?.path ?? "the email registry's initializer",
			statement("lazy"),
		),
	});
	if (initializer === null)
		return manual("no initializer in app/initializers/ creates the email registry");
	let file = await readSource(root, declarations);
	if (isFailure(file)) return manual(`${declarations} could not be read`);

	let mailSpecifier = file.data.references.find(
		(reference) =>
			reference.kind === "import" && reference.names.some((bound) => bound.imported === "emails"),
	)?.specifier;
	if (mailSpecifier === undefined) return manual(`${declarations} does not import emails()`);
	let builder = ensureImport(
		declarations,
		file.data.source,
		{ kind: "named", name: "email" },
		(specifier) => specifier === mailSpecifier,
		mailSpecifier,
		"email",
	);
	if (isFailure(builder)) return manual(builder.error.message);
	let schema = ensureImport(
		declarations,
		builder.data.source,
		{ kind: "namespace" },
		(specifier) => specifier === "remix/data-schema",
		"remix/data-schema",
		"s",
	);
	if (isFailure(schema)) return manual(schema.error.message);
	let added = addProperty(declarations, schema.data.source, {
		call: "emails",
		path: path.slice(0, -1),
		key: name.key,
		value: valueWith(builder.data.local, schema.data.local),
	});
	if (isFailure(added)) return manual(added.error.message);

	let mailSource = initializer.references.find(
		(reference) =>
			reference.kind === "import" &&
			reference.names.some((bound) => bound.imported === "createMail"),
	)?.specifier;
	if (mailSource === undefined) return manual(`${initializer.path} does not import createMail`);
	let lazy = ensureImport(
		initializer.path,
		initializer.source,
		{ kind: "named", name: "lazy" },
		(specifier) => specifier === mailSource,
		mailSource,
		"lazy",
	);
	if (isFailure(lazy)) return manual(lazy.error.message);
	let withLazy = { ...initializer, source: lazy.data.source };
	let mapped = mapAfter(
		withLazy,
		module,
		local,
		statement(lazy.data.local),
		`${instance}.map`,
		"createMail",
	);
	if (isFailure(mapped)) return manual(mapped.error.message);
	return {
		kind: "edits",
		path: path.join("."),
		edits: [
			{ path: declarations, before: file.data.source, after: added.data.source },
			{ path: initializer.path, before: initializer.source, after: mapped.data },
		],
	};
}

/**
 * Declares a command in `app/commands/index.ts` and maps it on the command line. Each folder of
 * the name is a `commands({ … })` group, created when missing, and the command's key is the
 * word typed to run it, so `users/send-digest` runs as `users send-digest`.
 */
async function declareCommand(request: DeclarationRequest, root: string): Promise<Declared> {
	let module = "app/commands/index";
	let declarations = `${module}.ts`;
	let segments = request.name.segments;
	let groups = segments.slice(0, -1);
	let leaf = segments.at(-1) ?? "";
	let initializer = await findInitializer(root, module, "createCLI");
	let instance = initializer === null ? "cli" : instanceOf(initializer, "createCLI");
	let local =
		initializer === null ? "commandset" : (defaultLocal(initializer, module) ?? "commandset");
	let description = literal(request.title);
	let handler =
		initializer === null ? `~/${request.handler}` : handlerSpecifier(initializer, request.handler);
	let statement = (lazy: string) =>
		`${instance}.map(${local}${memberAccess(segments)}, ${lazy}(() => import(${literal(handler)})));`;
	let manual = (reason: string): Declared => ({
		kind: "manual",
		path: segments.join("."),
		reason,
		instructions: instructions(
			`${declarations}, in commands({ … })${groups.length > 0 ? `, inside a commands({ … }) group for each of ${groups.join(", ")}` : ""}`,
			`${keyText(leaf)}: command({ description: ${description} }),`,
			initializer?.path ?? "the command line's initializer",
			statement("lazy"),
		),
	});
	if (initializer === null)
		return manual("no initializer in app/initializers/ creates the command line");
	let file = await readSource(root, declarations);
	if (isFailure(file)) return manual(`${declarations} could not be read`);

	let group = file.data.references.find(
		(reference) =>
			reference.kind === "import" && reference.names.some((bound) => bound.imported === "commands"),
	);
	let groupLocal = group?.names.find((bound) => bound.imported === "commands")?.local;
	if (group === undefined || groupLocal === undefined)
		return manual(`${declarations} does not import commands()`);
	let builder = ensureImport(
		declarations,
		file.data.source,
		{ kind: "named", name: "command" },
		(specifier) => specifier === group.specifier,
		group.specifier,
		"command",
	);
	if (isFailure(builder)) return manual(builder.error.message);
	let source = builder.data.source;

	let depth = 0;
	for (; depth < groups.length; depth += 1) {
		let level = groups[depth] ?? "";
		let probe = addProperty(declarations, source, {
			call: groupLocal,
			path: groups.slice(0, depth),
			key: level,
			value: "0",
		});
		if (isSuccess(probe)) break;
		if (probe.error.code !== "duplicate-key") return manual(probe.error.message);
		let isGroup = new RegExp(
			`(?:^|[\\s{,])["']?${escape(level)}["']?\\s*:\\s*${escape(groupLocal)}\\(`,
		);
		if (!isGroup.test(source)) {
			return manual(`\`${groups.slice(0, depth + 1).join(".")}\` is a command, not a group`);
		}
	}
	let value = `${builder.data.local}({ description: ${description} })`;
	if (request.options !== undefined) {
		let locals: Record<string, string> = {};
		for (let wanted of request.options.imports) {
			let imported =
				wanted === "s"
					? ensureImport(
							declarations,
							source,
							{ kind: "namespace" },
							(specifier) => specifier === "remix/data-schema",
							"remix/data-schema",
							"s",
						)
					: ensureImport(
							declarations,
							source,
							{ kind: "named", name: wanted },
							(specifier) => specifier === group.specifier,
							group.specifier,
							wanted,
						);
			if (isFailure(imported)) return manual(imported.error.message);
			source = imported.data.source;
			locals[wanted] = imported.data.local;
		}
		let lines = [`description: ${description},`, ...request.options.lines(locals)];
		value = `${builder.data.local}({\n${indentTab(lines.join("\n"))}\n})`;
	}
	let entry = `${keyText(leaf)}: ${value}`;
	let added =
		depth === groups.length
			? addProperty(declarations, source, {
					call: groupLocal,
					path: groups,
					key: leaf,
					value,
				})
			: addProperty(declarations, source, {
					call: groupLocal,
					path: groups.slice(0, depth),
					key: groups[depth] ?? "",
					value: groupValue(groupLocal, groups.slice(depth + 1), entry),
				});
	if (isFailure(added)) return manual(added.error.message);

	let cliSource = initializer.references.find(
		(reference) =>
			reference.kind === "import" &&
			reference.names.some((bound) => bound.imported === "createCLI"),
	)?.specifier;
	if (cliSource === undefined) return manual(`${initializer.path} does not import createCLI`);
	let lazy = ensureImport(
		initializer.path,
		initializer.source,
		{ kind: "named", name: "lazy" },
		(specifier) => specifier === cliSource,
		cliSource,
		"lazy",
	);
	if (isFailure(lazy)) return manual(lazy.error.message);
	let withLazy = { ...initializer, source: lazy.data.source };
	let mapped = mapAfter(
		withLazy,
		module,
		local,
		statement(lazy.data.local),
		`${instance}.map`,
		"createCLI",
	);
	if (isFailure(mapped)) return manual(mapped.error.message);
	return {
		kind: "edits",
		path: segments.join("."),
		edits: [
			{ path: declarations, before: file.data.source, after: added.data.source },
			{ path: initializer.path, before: initializer.source, after: mapped.data },
		],
	};
}

/**
 * Registers a model in `app/models/index.ts`'s `createModels({ … })` under its key, as an import
 * the registry runs on first use, so `ctx.models.<key>` reaches it on every request, job and
 * command once the command finishes.
 */
async function declareModel(request: DeclarationRequest, root: string): Promise<Declared> {
	let declarations = "app/models/index.ts";
	let key = request.name.key;
	let file = await readSource(root, declarations);
	let specifier = isFailure(file)
		? `./${request.name.segments.join("/")}`
		: specifierFor(declarations, request.handler, staticSpecifiers(file.data), false);
	let value = `() => import(${literal(specifier)})`;
	let manual = (reason: string): Declared => ({
		kind: "manual",
		path: key,
		reason,
		instructions: [
			`In ${declarations}, in createModels({ … }):`,
			indent(`${keyText(key)}: ${value},`),
		].join("\n"),
	});
	if (isFailure(file)) return manual(`${declarations} could not be read`);
	let call = file.data.references
		.find(
			(reference) =>
				reference.kind === "import" &&
				reference.names.some((bound) => bound.imported === "createModels"),
		)
		?.names.find((bound) => bound.imported === "createModels")?.local;
	if (call === undefined) return manual(`${declarations} does not import createModels()`);
	let added = addProperty(declarations, file.data.source, { call, path: [], key, value });
	if (isFailure(added)) return manual(added.error.message);
	return {
		kind: "edits",
		path: key,
		edits: [{ path: declarations, before: file.data.source, after: added.data.source }],
	};
}

/** The abilities of a resource `make policy` grants to `member`; its `read` goes to `everyone`. */
const WRITE_ACTIONS = ["create", "update", "delete"] as const;

/**
 * Declares a resource's `create`, `read`, `update` and `delete` abilities in
 * `app/policies/abilities.ts` and grants them in `app/policies/policy.ts`, reads to `everyone` and
 * writes to `member`. A refused read answers as not found, so a hidden row looks like a missing one.
 */
async function declarePolicy(request: DeclarationRequest, root: string): Promise<Declared> {
	let catalog = "app/policies/abilities.ts";
	let policyFile = "app/policies/policy.ts";
	let { name } = request;
	let groups = name.segments.slice(0, -1).map(camel);
	let path = [...groups, name.key];
	let ability = path.join(".");
	let id = name.segments.join("-");
	let row = await findRow(root, name);
	let rowType = row?.type ?? "{ id: string }";
	let group = (abilityLocal: string, contextLocal: string, type: string) => {
		let context = `${contextLocal}<{ ${name.key}: ${type} }>(${literal(name.key)})`;
		return [
			"{",
			`	create: ${abilityLocal}(),`,
			`	read: ${abilityLocal}({ context: ${context}, deniedAs: "notFound" }),`,
			`	update: ${abilityLocal}({ context: ${context} }),`,
			`	delete: ${abilityLocal}({ context: ${context} }),`,
			"}",
		].join("\n");
	};
	let reads = (allow: string) =>
		`${allow}(${literal(`${ability}.read`)}, { id: ${literal(`${id}-read`)} })`;
	let writes = (allow: string) => {
		let names = WRITE_ACTIONS.map((action) => literal(`${ability}.${action}`)).join(", ");
		return `${allow}([${names}], { id: ${literal(`${id}-write`)} })`;
	};
	let manual = (reason: string): Declared => ({
		kind: "manual",
		path: ability,
		reason,
		instructions: [
			...(row === null
				? []
				: [`In ${catalog}:`, indent(`import type { ${row.type} } from "~/${row.path}";`)]),
			`In ${catalog}, in abilities({ … })${groupNote(path)}:`,
			indent(`${name.key}: ${group("ability", "context", rowType)},`),
			`In ${policyFile}, in definePolicy(…)'s everyone:`,
			indent(`${reads("allow")},`),
			`In ${policyFile}, in definePolicy(…)'s roles.member:`,
			indent(`${writes("allow")},`),
		].join("\n"),
	});

	let file = await readSource(root, catalog);
	if (isFailure(file)) return manual(`${catalog} could not be read`);
	let catalogImport = importOf(file.data, "abilities");
	if (catalogImport === null) return manual(`${catalog} does not import abilities()`);
	let source = file.data.source;
	let locals: Record<string, string> = {};
	for (let helper of ["ability", "context"]) {
		let imported = ensureImport(
			catalog,
			source,
			{ kind: "named", name: helper },
			(specifier) => specifier === catalogImport.specifier,
			catalogImport.specifier,
			helper,
		);
		if (isFailure(imported)) return manual(imported.error.message);
		source = imported.data.source;
		locals[helper] = imported.data.local;
	}
	let type = rowType;
	if (row !== null) {
		let aliased = await declaresAlias(root);
		let specifier = specifierFor(catalog, row.path, staticSpecifiers(file.data), aliased);
		let imported = ensureTypeImport(catalog, source, row.type, specifier);
		if (isFailure(imported)) return manual(imported.error.message);
		source = imported.data.source;
		type = imported.data.local;
	}
	let declared = addProperty(catalog, source, {
		call: catalogImport.local,
		path: groups,
		key: name.key,
		value: group(locals.ability ?? "ability", locals.context ?? "context", type),
	});
	if (isFailure(declared)) return manual(declared.error.message);

	let policy = await readSource(root, policyFile);
	if (isFailure(policy)) return manual(`${policyFile} could not be read`);
	let defined = importOf(policy.data, "definePolicy");
	if (defined === null) return manual(`${policyFile} does not import definePolicy()`);
	let allow = ensureImport(
		policyFile,
		policy.data.source,
		{ kind: "named", name: "allow" },
		(specifier) => specifier === defined.specifier,
		defined.specifier,
		"allow",
	);
	if (isFailure(allow)) return manual(allow.error.message);
	let granted = grant(
		policyFile,
		allow.data.source,
		defined.local,
		[["everyone"]],
		reads(allow.data.local),
	);
	if (isFailure(granted)) return manual(granted.error.message);
	granted = grant(
		policyFile,
		granted.data,
		defined.local,
		[
			["roles", "member"],
			["roles", "member", "grants"],
		],
		writes(allow.data.local),
	);
	if (isFailure(granted)) return manual(granted.error.message);
	return {
		kind: "edits",
		path: ability,
		edits: [
			{ path: catalog, before: file.data.source, after: declared.data.source },
			{ path: policyFile, before: policy.data.source, after: granted.data },
		],
	};
}

/**
 * Whether `app/policies/abilities.ts` declares a group at `path` in its `abilities({ … })`, as
 * `make policy` does for a resource. An unreadable catalog, or one without the call, declares none.
 */
export async function declaresAbilities(root: string, path: readonly string[]): Promise<boolean> {
	let catalog = "app/policies/abilities.ts";
	let file = await readSource(root, catalog);
	if (isFailure(file)) return false;
	let call = importOf(file.data, "abilities");
	if (call === null) return false;
	let [key = "", ...rest] = [...path].reverse();
	let probe = addProperty(catalog, file.data.source, {
		call: call.local,
		path: rest.reverse(),
		key,
		value: "{}",
	});
	return isFailure(probe) && probe.error.code === "duplicate-key";
}

/**
 * `source` with `value` appended to the first of `lists` the policy's options hold, each a key
 * path in `definePolicy`'s second argument; with none of them, the first is created holding it.
 */
function grant(
	filename: string,
	source: string,
	call: string,
	lists: readonly (readonly string[])[],
	value: string,
): Result<string, Error> {
	for (let path of lists) {
		let added = addElement(filename, source, { call, argument: 1, path: [...path], value });
		if (isSuccess(added)) return success(added.data.source);
		if (added.error.code !== "not-found") return added;
	}
	let [first = []] = lists;
	let created = addProperty(filename, source, {
		call,
		argument: 1,
		path: first.slice(0, -1),
		key: first.at(-1) ?? "",
		value: `[${value}]`,
	});
	if (isFailure(created)) return created;
	return success(created.data.source);
}

/**
 * The row type a resource's model exports, `PostRow` from `app/models/post.ts`, or `null` when
 * the resource has no model or its model exports no such type.
 */
export async function findRow(
	root: string,
	name: Name,
): Promise<{ path: string; type: string } | null> {
	let path = `app/models/${name.segments.join("/")}`;
	let type = `${name.pascal}Row`;
	for (let extension of [".ts", ".tsx"]) {
		let source = await wrap(() => readFile(join(root, `${path}${extension}`), "utf8"));
		if (isFailure(source)) continue;
		let exported = new RegExp(`export\\s+(?:type|interface)\\s+${escape(type)}\\b`);
		return exported.test(source.data) ? { path, type } : null;
	}
	return null;
}

/** The local name and specifier `file` imports the named export `name` under, or `null`. */
function importOf(file: SourceFile, name: string): { local: string; specifier: string } | null {
	for (let reference of file.references) {
		if (reference.kind !== "import") continue;
		let bound = reference.names.find((each) => each.imported === name && !each.typeOnly);
		if (bound !== undefined) return { local: bound.local, specifier: reference.specifier };
	}
	return null;
}

/** Whether the project's `tsconfig.json` declares the `~/app/*` alias. */
async function declaresAlias(root: string): Promise<boolean> {
	let tsconfig = await wrap(() => readFile(join(root, "tsconfig.json"), "utf8"));
	return !isFailure(tsconfig) && tsconfig.data.includes('"~/app/*"');
}

/**
 * A `commands({ … })` group holding `entry`, wrapped in one more group for each of `levels`,
 * outermost first, for the folders of a command name that have no group yet.
 */
function groupValue(call: string, levels: readonly string[], entry: string): string {
	let inner = entry;
	for (let level of [...levels].reverse()) {
		inner = `${keyText(level)}: ${call}({\n${indentTab(inner)},\n})`;
	}
	return `${call}({\n${indentTab(inner)},\n})`;
}

/** A command's key as an identifier when it is one, quoted otherwise. */
function keyText(key: string): string {
	return /^[A-Za-z_$][\w$]*$/.test(key) ? key : literal(key);
}

/** Every line of `text` indented by one tab. */
function indentTab(text: string): string {
	return text
		.split("\n")
		.map((line) => `\t${line}`)
		.join("\n");
}

/**
 * `file` with the declarations module imported as `local` (added when missing) and `statement`
 * after the last call to `call`, or after the instance `factory` creates when there is none.
 */
function mapAfter(
	file: SourceFile,
	module: string,
	local: string,
	statement: string,
	call: string,
	factory: string,
): Result<string, Error> {
	let examples = staticSpecifiers(file);
	let imported = ensureImport(
		file.path,
		file.source,
		{ kind: "default" },
		(specifier) => resolvesTo(specifier, file.path, module),
		specifierFor(file.path, module, examples, file.aliased ?? false),
		local,
	);
	if (isFailure(imported)) return imported;
	if (imported.data.local !== local)
		return failure(new Error(`${file.path} imports ${module} as ${imported.data.local}`));
	let inserted = insertAfterLast(file.path, imported.data.source, {
		call,
		statement,
		fallbackAfter: factory,
	});
	if (isFailure(inserted)) return inserted;
	return success(inserted.data.source);
}

/**
 * The initializer in `app/initializers/` that imports `module` and calls `factory`, else the
 * first that imports it, else (unless `importing` is required) one that calls `factory`; `null`
 * when none does. Test files are skipped.
 */
async function findInitializer(
	root: string,
	module: string,
	factory: string | null,
	importing: "required" | "preferred" = "preferred",
): Promise<SourceFile | null> {
	let folder = "app/initializers";
	let entries = await wrap(() => readdir(join(root, folder)));
	if (isFailure(entries)) return null;
	let files: SourceFile[] = [];
	for (let entry of entries.data.sort()) {
		if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry) || entry.endsWith(".d.ts")) continue;
		let file = await readSource(root, `${folder}/${entry}`);
		if (isSuccess(file)) files.push(file.data);
	}
	let aliased = await declaresAlias(root);
	for (let file of files) file.aliased = aliased;
	let calling = factory === null ? null : new RegExp(`\\b${factory}\\(`);
	let importers = files.filter((file) =>
		file.references.some(
			(reference) =>
				reference.kind === "import" && resolvesTo(reference.specifier, file.path, module),
		),
	);
	let found = importers.find((file) => calling?.test(file.source) ?? true) ?? importers[0];
	if (found !== undefined) return found;
	if (calling === null || importing === "required") return null;
	return files.find((file) => calling.test(file.source)) ?? null;
}

/** The route contract file for `module` (`routes/web`), `.ts` or `.tsx`, or `null`. */
async function findContract(root: string, module: string): Promise<string | null> {
	for (let extension of [".ts", ".tsx"]) {
		let path = `${module}${extension}`;
		if (isSuccess(await wrap(() => readFile(join(root, path))))) return path;
	}
	return null;
}

/** Reads a project file and scans its module references. */
async function readSource(root: string, path: string): Promise<Result<SourceFile, Error>> {
	let source = await wrap(() => readFile(join(root, path), "utf8"));
	if (isFailure(source)) return source;
	let references = findModuleReferences(path, source.data);
	if (isFailure(references)) return references;
	return success({ path, source: source.data, references: references.data });
}

/** The variable the instance `factory` creates is bound to, such as `dispatcher` or `router`. */
function instanceOf(file: SourceFile, factory: string): string {
	let match = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${factory}\\(`).exec(
		file.source,
	);
	return match?.[1] ?? INSTANCE_NAMES[factory] ?? "dispatcher";
}

/** The local name `file` binds the default export of `module` to, or `null`. */
function defaultLocal(file: SourceFile, module: string): string | null {
	for (let reference of file.references) {
		if (reference.kind !== "import" || !resolvesTo(reference.specifier, file.path, module))
			continue;
		let bound = reference.names.find((name) => name.imported === "default");
		if (bound !== undefined) return bound.local;
	}
	return null;
}

/**
 * The group keys of an existing job mapping whose handler lives in the folder `name` names,
 * so `activitypub/send` joins the `activityPub` group its siblings are mapped under.
 */
function reusedGroup(
	file: SourceFile,
	instance: string,
	local: string,
	name: Name,
): string[] | null {
	let folders = name.segments.slice(0, -1);
	if (folders.length === 0) return [];
	let mapping = new RegExp(
		`${escape(instance)}\\.map\\(\\s*${escape(local)}\\.([\\w$.]+)\\s*,[^;]*?import\\(\\s*["']([^"']+)["']`,
		"g",
	);
	for (let match of file.source.matchAll(mapping)) {
		let keys = (match[1] ?? "").split(".");
		let target = projectPath(match[2] ?? "", file.path);
		if (target === null || !target.startsWith("app/jobs/")) continue;
		let segments = target.slice("app/jobs/".length).split("/").slice(0, -1);
		let sameFolder =
			segments.length === folders.length &&
			segments.every((segment, index) => segment === folders[index]);
		if (sameFolder && keys.length === folders.length + 1) return keys.slice(0, -1);
	}
	return null;
}

/** A specifier written in `fromFile` as a project-relative path, or `null` for a package. */
function projectPath(specifier: string, fromFile: string): string | null {
	if (specifier.startsWith("~/")) return specifier.slice(2);
	if (specifier.startsWith(".")) return posix.join(dirname(fromFile), specifier);
	return null;
}

/** How the initializer imports a new handler, following the form its existing mappings use. */
function handlerSpecifier(file: SourceFile, handler: string): string {
	let dynamic = file.references
		.filter((reference) => reference.kind === "dynamic")
		.map((reference) => reference.specifier);
	let examples = dynamic.length > 0 ? dynamic : staticSpecifiers(file);
	return specifierFor(file.path, handler, examples, file.aliased ?? false);
}

/** The specifiers of a file's static imports. */
function staticSpecifiers(file: SourceFile): string[] {
	return file.references
		.filter((reference) => reference.kind === "import")
		.map((reference) => reference.specifier);
}

/**
 * The `@sdxc/json-schema` (or `sdxc/json-schema`) specifier that sits beside an MCP
 * import — whether that import is the bare package or its `/server` / `/client` entry.
 *
 * @param mcpSpecifier The MCP module the declarations already import.
 */
function jsonSchemaBeside(mcpSpecifier: string): string {
	return mcpSpecifier
		.replace(/\/mcp\/(?:server|client)$/, "/json-schema")
		.replace(/mcp$/, "json-schema");
}

/** Where a nested declaration goes, for the printed instructions. */
function groupNote(path: string[]): string {
	return path.length > 1 ? `, under ${path.slice(0, -1).join(".")}` : "";
}

/** The two edits to make by hand, as `make` prints them. */
function instructions(
	declarationsAt: string,
	declaration: string,
	initializer: string,
	mapping: string,
): string {
	return [`In ${declarationsAt}:`, indent(declaration), `In ${initializer}:`, indent(mapping)].join(
		"\n",
	);
}

/** Every line of `text` indented by two spaces. */
function indent(text: string): string {
	return text
		.split("\n")
		.map((line) => `  ${line}`)
		.join("\n");
}

/** `text` with every regular-expression metacharacter escaped. */
function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
