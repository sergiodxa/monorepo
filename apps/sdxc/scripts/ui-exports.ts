/**
 * Reads one `@sdxc/ui` subpath module into the pages the site draws for it. A module
 * publishes one or more exports a reader imports by name — a mixin, a behavior class,
 * an animation — and around them the events, constants and types they are used with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocNode } from "@sdxc/jsdoc";

import { extract } from "@sdxc/jsdoc";
import { isFailure } from "@sdxc/result";

import type { PropRow } from "~/app/services/components";
import type { UiExportReference, UiMethod, UiSymbol } from "~/app/services/ui-exports";
import type { UiSubpath } from "~/app/services/ui-subpaths";

import { toProse, toSummary, unionMembers } from "~/scripts/catalogue";

/** The kind of export each subpath is made of, which is what earns a page of its own. */
const PAGE_KINDS: Record<UiSubpath, UiSymbol["kind"]> = {
	mixins: "mixin",
	behaviors: "class",
	animations: "function",
	styles: "function",
};

/** The order companions are listed in: what a caller listens for or passes, then types. */
const COMPANION_ORDER: UiSymbol["kind"][] = [
	"event",
	"constant",
	"mixin",
	"function",
	"class",
	"interface",
	"type",
];

/** A constant whose initializer runs longer than this is shown by its type instead. */
const MAX_INITIALIZER_LINES = 24;

/** A symbol as read, with the name of what it was declared inside. */
interface Declared {
	symbol: UiSymbol;
	/** The namespace or class it was nested in, which ties `Fade.Options` to `fade`. */
	owner: string;
}

/**
 * Every page one module contributes. Each export of the subpath's own kind gets a page;
 * a module holding none of that kind — a set of motion tokens, a helper the mixins
 * share — gives each of its value exports a page instead, so nothing it publishes goes
 * undocumented. A companion nested under a page's name joins that page alone; any other
 * joins every page of the module.
 *
 * @param source - The module's text.
 * @param subpath - The subpath whose barrel forwards it.
 * @param shared - Text of the modules declaring the unions several modules share.
 * @returns One reference per page, or `null` when the module will not parse.
 */
export function readUiModule(
	source: string,
	subpath: UiSubpath,
	shared: string[],
): UiExportReference[] | null {
	let extracted = extract(source, { path: `${subpath}/module.ts` });
	if (isFailure(extracted)) return null;

	let unions = [...shared, source];
	let declared = extracted.data.children.flatMap((node) => declare(node, "", source, unions));

	let kind = PAGE_KINDS[subpath];
	let pages = declared.filter((entry) => entry.symbol.kind === kind);
	if (pages.length === 0) {
		pages = declared.filter((entry) =>
			["mixin", "function", "class", "constant"].includes(entry.symbol.kind),
		);
	}

	let definition = toProse(extracted.data.comment?.description ?? "");
	let alone = pages.length === 1 && definition !== "";

	return pages.map(({ symbol }) => {
		let companions = declared
			.filter((entry) => !pages.some((page) => page.symbol === entry.symbol))
			.filter((entry) => {
				let owner = entry.owner.toLowerCase();
				let owned = pages.some((page) => page.symbol.name.toLowerCase() === owner);
				return !owned || owner === symbol.name.toLowerCase();
			})
			.map((entry) => entry.symbol)
			.sort((a, b) => COMPANION_ORDER.indexOf(a.kind) - COMPANION_ORDER.indexOf(b.kind));

		return {
			name: symbol.name,
			subpath,
			slug: toKebab(symbol.name),
			summary: toSummary(alone ? definition : symbol.description || definition),
			symbol,
			companions,
		};
	});
}

/** A camelCase or PascalCase name as the URL segment it is addressed by. */
export function toKebab(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

/**
 * One export as the symbols it documents. A namespace holds only types, so it
 * contributes its members under its own name; a class keeps its members and hands on
 * the interfaces declared in the namespace merged with it.
 */
function declare(node: DocNode, owner: string, source: string, unions: string[]): Declared[] {
	let name = owner ? `${owner}.${node.name}` : node.name;

	if (node.kind === "namespace") {
		return node.children.flatMap((child) => declare(child, name, source, unions));
	}

	let nested =
		node.kind === "class"
			? node.children
					.filter((child) => child.kind === "interface" || child.kind === "type-alias")
					.flatMap((child) => declare(child, name, source, unions))
			: [];

	let symbol = readSymbol(node, name, source, unions);
	return symbol === null ? nested : [{ symbol, owner: owner || node.name }, ...nested];
}

/** One declaration as the page prints it, or `null` for a kind with no page section. */
function readSymbol(
	node: DocNode,
	name: string,
	source: string,
	unions: string[],
): UiSymbol | null {
	let tags = node.comment?.tags ?? [];
	let symbol: UiSymbol = {
		name,
		kind: "constant",
		description: toProse(node.comment?.description ?? ""),
		signature: null,
		parameters: [],
		returns: toProse(tags.find((tag) => tag.tag === "returns")?.text ?? ""),
		examples: tags.filter((tag) => tag.tag === "example").map((tag) => tag.text.trim()),
		members: [],
		methods: [],
		values: [],
	};

	if (node.kind === "variable") {
		let mixin = mixinArguments(node, source);
		if (mixin === null) return { ...symbol, signature: constant(node, source) };

		let descriptions = new Map(
			tags
				.filter((tag) => tag.tag === "param")
				.map((tag) => [tag.name, toProse(tag.text).replace(/\s+/g, " ")]),
		);
		let parameters = tupleMembers(mixin.parameters).map((parameter) => ({
			...parameter,
			description: descriptions.get(parameter.name) ?? "",
			values: unionMembers(parameter.type, unions),
		}));

		return {
			...symbol,
			kind: "mixin",
			signature: `${name}(${parameters.map(written).join(", ")}): MixinDescriptor<${mixin.host}>`,
			parameters,
		};
	}

	if (node.kind === "function") {
		let declared = node.signatures[0];
		let parameters = rows(declared, unions);
		let returns = declared?.returns ? `: ${declared.returns}` : "";

		return {
			...symbol,
			kind: "function",
			signature: `${name}${typeParameters(node, declared)}(${parameters.map(written).join(", ")})${returns}`,
			parameters,
		};
	}

	if (node.kind === "class") {
		let constructor = node.children.find((child) => child.kind === "constructor");
		let parameters = rows(constructor?.signatures[0], unions);
		let isEvent = node.extends.some((base) => /^(\w+)?Event$/.test(base));
		let visible = node.children.filter((child) => child.flags.visibility === "public");

		return {
			...symbol,
			kind: isEvent ? "event" : "class",
			signature: `new ${name}${typeParameters(node)}(${parameters.map(written).join(", ")})`,
			parameters,
			members: visible
				.filter((child) => child.kind === "property" || child.kind === "accessor")
				.map((child) => member(child, unions)),
			methods: visible.filter((child) => child.kind === "method").map(method),
		};
	}

	if (node.kind === "interface") {
		return {
			...symbol,
			kind: "interface",
			members: node.children.map((child) => member(child, unions)),
		};
	}

	if (node.kind === "type-alias") {
		return {
			...symbol,
			kind: "type",
			signature: `type ${name}${typeParameters(node)} = ${node.type ?? "unknown"}`,
			values: unionMembers(node.type, unions),
		};
	}

	return null;
}

/** The parameters of one signature as table rows, defaults counted as optional. */
function rows(declared: DocNode["signatures"][number] | undefined, unions: string[]): PropRow[] {
	return (declared?.parameters ?? []).map((parameter) => ({
		name: parameter.rest ? `...${parameter.name}` : parameter.name,
		type: parameter.type ?? typeOfDefault(parameter.default),
		description: toProse(parameter.description ?? "").replace(/\s+/g, " "),
		optional: parameter.optional || parameter.default !== null,
		values: unionMembers(parameter.type, unions),
	}));
}

/** One property, accessor or interface member as a table row. */
function member(node: DocNode, unions: string[]): PropRow {
	let type = node.type ?? node.signatures[0]?.returns ?? "unknown";

	return {
		name: node.flags.static ? `static ${node.name}` : node.name,
		type: node.flags.readonly ? `readonly ${type}` : type,
		description: toProse(node.comment?.description ?? "").replace(/\s+/g, " "),
		optional: node.flags.optional,
		values: unionMembers(type, unions),
	};
}

/** One public method as the methods table lists it. */
function method(node: DocNode): UiMethod {
	let declared = node.signatures[0];
	let parameters = rows(declared, []).map(written).join(", ");
	let returns = declared?.returns ? `: ${declared.returns}` : "";
	let prefix = node.flags.static ? "static " : "";

	return {
		name: node.name,
		signature: `${prefix}${node.name}${typeParameters(node, declared)}(${parameters})${returns}`,
		description: toProse(node.comment?.description ?? "").replace(/\s+/g, " "),
	};
}

/** A parameter the way a signature writes it. */
function written(row: PropRow): string {
	return `${row.name}${row.optional && !row.name.startsWith("...") ? "?" : ""}: ${row.type}`;
}

/**
 * The type an unannotated parameter takes from its default, which is the type a caller
 * has to pass when they pass one.
 */
function typeOfDefault(fallback: string | null): string {
	if (fallback === null) return "unknown";
	if (/^["'`]/.test(fallback)) return "string";
	if (/^-?\d/.test(fallback)) return "number";
	if (fallback === "true" || fallback === "false") return "boolean";
	return "unknown";
}

/**
 * The `<…>` a generic declaration is written with, or nothing. A function records its
 * type parameters on its signature, a class or an alias on itself.
 */
function typeParameters(node: DocNode, signature?: DocNode["signatures"][number]): string {
	let declared =
		node.typeParameters.length > 0 ? node.typeParameters : (signature?.typeParameters ?? []);
	if (declared.length === 0) return "";

	return `<${declared
		.map((parameter) => {
			let constraint = parameter.constraint ? ` extends ${parameter.constraint}` : "";
			let fallback = parameter.default ? ` = ${parameter.default}` : "";
			return `${parameter.name}${constraint}${fallback}`;
		})
		.join(", ")}>`;
}

/**
 * The host element and argument tuple of a mixin, read from its annotation or, when it
 * carries none, from the `createMixin<…>` call that builds it.
 *
 * @returns `null` when the variable is something other than a mixin.
 */
function mixinArguments(
	node: DocNode,
	source: string,
): { host: string; parameters: string } | null {
	let generics: string | null = null;

	if (node.type?.startsWith("MixinFactory<")) {
		generics = node.type.slice("MixinFactory<".length, closing(node.type, "MixinFactory".length));
	} else {
		let call = new RegExp(`export const ${node.name}\\s*=\\s*createMixin<`).exec(source);
		if (call) {
			let open = call.index + call[0].length - 1;
			generics = source.slice(open + 1, closing(source, open));
		}
	}

	if (generics === null) return null;

	let [host = "Element", parameters = "[]"] = splitTopLevel(generics);
	return { host: host.trim(), parameters: parameters.trim() };
}

/**
 * The labelled members of an argument tuple, `[combo: string]` reading as one required
 * `combo`. An unlabelled member is named by its position, since the tuple gives it none.
 */
function tupleMembers(tuple: string): Omit<PropRow, "description" | "values">[] {
	let inner = tuple.replace(/^\[/, "").replace(/\]$/, "").trim();
	if (inner === "") return [];

	return splitTopLevel(inner).map((member, index) => {
		let labelled = /^(\.\.\.)?([A-Za-z_$][\w$]*)(\?)?\s*:\s*([\s\S]+)$/.exec(member.trim());
		if (!labelled) return { name: `arg${index}`, type: member.trim(), optional: false };

		return {
			name: `${labelled[1] ?? ""}${labelled[2]}`,
			type: (labelled[4] as string).trim(),
			optional: labelled[3] === "?",
		};
	});
}

/**
 * How a constant is declared: its initializer when it fits on the page, which for a
 * command name or a token table is the value a caller needs, or its annotation otherwise.
 */
function constant(node: DocNode, source: string): string {
	let start = new RegExp(`export const ${node.name}(\\s*:[^=]+)?\\s*=\\s*`).exec(source);
	if (!start) return `const ${node.name}${node.type ? `: ${node.type}` : ""}`;

	let from = start.index + start[0].length;
	let to = statementEnd(source, from);
	let initializer = source.slice(from, to).trim();
	let annotation = start[1]?.trim() ?? "";

	if (initializer.split("\n").length > MAX_INITIALIZER_LINES) {
		return `const ${node.name}${annotation ? ` ${annotation}` : node.type ? `: ${node.type}` : ""}`;
	}

	return `const ${node.name}${annotation ? ` ${annotation}` : ""} = ${outdent(initializer)}`;
}

/** Where the statement starting at `from` ends: its first `;` outside any bracket. */
function statementEnd(source: string, from: number): number {
	let depth = 0;

	for (let index = from; index < source.length; index++) {
		let char = source[index];
		if (char === "(" || char === "[" || char === "{") depth++;
		else if (char === ")" || char === "]" || char === "}") depth--;
		else if (char === ";" && depth === 0) return index;
	}

	return source.length;
}

/** An initializer's continuation lines, moved left to sit under the declaration. */
function outdent(text: string): string {
	let lines = text.split("\n");
	let indents = lines
		.slice(1)
		.filter((line) => line.trim() !== "")
		.map((line) => /^\t*/.exec(line)?.[0].length ?? 0);
	let shift = Math.max(0, Math.min(...indents, Number.POSITIVE_INFINITY) - 1);

	return lines.map((line, index) => (index === 0 ? line : line.slice(shift))).join("\n");
}

/**
 * The index of the `>` that closes the `<` at `open`. An arrow's `=>` is part of a type
 * written inside the brackets, so it never closes one.
 */
function closing(text: string, open: number): number {
	let depth = 0;

	for (let index = open; index < text.length; index++) {
		let char = text[index];
		if (char === "<" || char === "(" || char === "[" || char === "{") depth++;
		else if (char === ")" || char === "]" || char === "}") depth--;
		else if (char === ">" && text[index - 1] !== "=") {
			depth--;
			if (depth === 0) return index;
		}
	}

	return text.length;
}

/** A comma-separated list split only at the commas outside every bracket. */
function splitTopLevel(text: string): string[] {
	let parts: string[] = [];
	let depth = 0;
	let start = 0;

	for (let index = 0; index < text.length; index++) {
		let char = text[index];
		if (char === "<" || char === "(" || char === "[" || char === "{") depth++;
		else if (char === ")" || char === "]" || char === "}") depth--;
		else if (char === ">" && text[index - 1] !== "=") depth--;
		else if (char === "," && depth === 0) {
			parts.push(text.slice(start, index));
			start = index + 1;
		}
	}

	parts.push(text.slice(start));
	return parts.filter((part) => part.trim() !== "");
}
