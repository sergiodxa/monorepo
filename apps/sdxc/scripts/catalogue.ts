/**
 * Reads the two catalogue packages into the documents the site serves. Everything
 * here takes source text and returns plain data, so the work is done once at build
 * time and the site ships records rather than a parser: `@sdxc/jsdoc` reaches for the
 * TypeScript compiler, which is larger than the whole rest of the Worker and reads
 * CommonJS globals a Worker has no answer for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocNode, DocSignature } from "@sdxc/jsdoc";

import { extract, inlineLinks } from "@sdxc/jsdoc";
import { isFailure } from "@sdxc/result";

import type {
	ComponentPart,
	ComponentReference,
	ComponentType,
	PropRow,
	PropsTable,
} from "~/app/services/components";
import type {
	ThemeDeclaration,
	ThemeGroup,
	ThemeReference,
	ThemeToken,
} from "~/app/services/theming";
import type {
	UtilityEntry,
	UtilityExample,
	UtilityLink,
	UtilityReference,
} from "~/app/services/utilities";

/** What every component module names its host's prop interface. */
const HOST_PROPS = "Props";

/** The tones every component colors itself with, which the theme table groups by. */
const TONES = ["brand", "neutral", "success", "warning", "danger"] as const;

/**
 * Suffix a call site writes, and the variable segment it resolves to. A component
 * asks for `bg("brand.tint")` rather than for the variable, so the scan has to read
 * the same aliases the mixins do to know which token that call reaches.
 */
const SUFFIX_SEGMENTS: Record<string, string> = {
	tint: "bg-tint",
	solid: "bg-solid",
	muted: "fg-muted",
	emphasis: "fg-emphasis",
	onSolid: "fg-on-solid",
	strong: "border-strong",
};

/** Mixins that take a bare tone, and the variable segment each one defaults to. */
const BARE_TONE_MIXINS: Record<string, string> = {
	bg: "bg",
	fg: "fg",
	border: "border",
	ring: "ring",
};

/** What a variable controls, keyed by the segment after its tone. */
const SEGMENT_MEANING: Record<string, string> = {
	bg: "Surface behind the tone's content",
	"bg-tint": "Tinted fill, for a quiet emphasis",
	"bg-solid": "Solid fill, for the loudest emphasis",
	"bg-tint-hover": "Tinted fill while the pointer is over it",
	"bg-tint-pressed": "Tinted fill while it is held down",
	"bg-solid-hover": "Solid fill while the pointer is over it",
	"bg-solid-pressed": "Solid fill while it is held down",
	fg: "Text and icons in the tone",
	"fg-muted": "Secondary text, one step back from the body",
	"fg-emphasis": "The tone's strongest text",
	"fg-on-solid": "Text drawn on the solid fill",
	border: "Ordinary border",
	"border-strong": "Border where the edge carries the emphasis",
	ring: "Focus ring",
};

/** How each band of the theme table is introduced. */
const GROUP_INTROS: Record<string, string> = {
	surface: "The page itself, which a tone sits on rather than replaces.",
	spacing: "One step, multiplied by every spacing utility.",
	"type scale": "The named font sizes.",
	"font stacks": "The three families, resolved to system faces.",
	"container scale": "The named widths a container query compares against.",
	chart: "The categorical sequence a multi-series chart walks in order.",
};

/** The order the theme page reads its bands in. */
const GROUP_ORDER = [
	...TONES,
	"surface",
	"spacing",
	"type scale",
	"font stacks",
	"container scale",
	"chart",
];

/**
 * Pairs each documented call with the CSS it emits.
 *
 * The two halves are written as consecutive `@example` tags, but not every utility
 * has a second half and the ones that do are not all `css({…})` calls: nine of them
 * emit a bare value and document it as a quoted string. So position alone cannot
 * decide it — an example takes the one after it only when that one is shaped like an
 * output, and otherwise stands on its own.
 *
 * @param examples - Every `@example` on one symbol, in the order they were written.
 * @returns One entry per call, each carrying its output when the source wrote one.
 */
export function pairExamples(examples: string[]): UtilityExample[] {
	let paired: UtilityExample[] = [];

	for (let index = 0; index < examples.length;) {
		let call = examples[index] as string;
		let next = examples[index + 1];

		if (next !== undefined && isOutput(next)) {
			paired.push({ call, output: next });
			index += 2;
			continue;
		}

		paired.push({ call, output: null });
		index += 1;
	}

	return paired;
}

/**
 * The value exports of one family barrel. Every line forwards from one module and
 * names what it publishes, so the listing is read without parsing the source the
 * names are declared in; `export type` lines are skipped, since a type has no page.
 *
 * @param source - The barrel's own text.
 * @param family - The subpath the barrel is imported as.
 * @returns One entry per published utility, in the order the barrel forwards them.
 */
export function readBarrel(source: string, family: string): UtilityEntry[] {
	let entries: UtilityEntry[] = [];

	for (let line of source.matchAll(/^export \{([^}]*)\} from "\.\/([^"]+)\.js";$/gm)) {
		let module = line[2] as string;

		for (let name of (line[1] as string).split(",")) {
			let trimmed = name.trim();
			if (trimmed.length > 0) entries.push({ name: trimmed, family, module });
		}
	}

	return entries;
}

/**
 * One utility's reference, read from the module it is declared in.
 *
 * @param source - The module's text.
 * @param entry - The catalogue entry naming what to read out of it.
 * @returns The page's content, or `null` when the module will not parse or declares
 * nothing under that name.
 */
export function readUtility(source: string, entry: UtilityEntry): UtilityReference | null {
	let extracted = extract(source, { path: `${entry.family}/${entry.module}.ts` });
	if (isFailure(extracted)) return null;

	let node = extracted.data.children.find((child) => child.name === entry.name);
	if (!node) return null;

	let tags = node.comment?.tags ?? [];
	let examples = pairExamples(
		tags.filter((tag) => tag.tag === "example").map((tag) => tag.text.trim()),
	);
	let description = toProse(node.comment?.description ?? "");

	return {
		name: entry.name,
		family: entry.family,
		property: cssProperty(examples) ?? entry.name,
		description,
		summary: toSummary(description),
		signature: signature(node.name, node.signatures[0] ?? null),
		examples,
		see: tags.filter((tag) => tag.tag === "see").flatMap((tag) => readLink(tag.text)),
		tokens: readTokens(source),
	};
}

/**
 * The component a module publishes, named by its own export line so a file called
 * `listbox.tsx` still reports itself as `ListBox`.
 *
 * @param source - The module's text.
 * @returns The exported name, or `null` when the module exports no component.
 */
export function componentName(source: string): string | null {
	return /^export function ([A-Z][A-Za-z0-9]*)\(/m.exec(source)?.[1] ?? null;
}

/**
 * One component's reference, read from its module.
 *
 * @param source - The module's text.
 * @param slug - The module's file name, which is what its URL carries.
 * @param shared - Text of the modules declaring the types several components share.
 * @returns The page's content, or `null` when the module will not parse or publishes
 * no component.
 */
export function readComponent(
	source: string,
	slug: string,
	shared: string[],
): ComponentReference | null {
	let extracted = extract(source, { path: `${slug}.tsx` });
	if (isFailure(extracted)) return null;

	let components = extracted.data.children.filter((child) => child.kind === "function");
	let host = components[0];
	if (!host) return null;

	let unions = new Map<string, ComponentType>();
	for (let child of host.children) {
		if (child.kind !== "type-alias") continue;
		let values = unionMembers(child.type, shared);
		if (values.length > 0) {
			unions.set(child.name, {
				name: child.name,
				description: toSummary(child.comment?.description ?? ""),
				values,
			});
		}
	}

	let parts: ComponentPart[] = [];
	for (let child of host.children) {
		if (child.kind !== "function") continue;
		parts.push({
			name: `${host.name}.${child.name}`,
			description: toSummary(child.comment?.description ?? ""),
			props: readProps(host, `${child.name}${HOST_PROPS}`, unions, shared),
		});
	}

	let definition = toProse(extracted.data.comment?.description ?? "");

	return {
		name: host.name,
		slug,
		definition,
		summary: toSummary(definition),
		description: toProse(host.comment?.description ?? ""),
		examples: (host.comment?.tags ?? [])
			.filter((tag) => tag.tag === "example")
			.map((tag) => tag.text.trim()),
		props: readProps(host, HOST_PROPS, unions, shared),
		parts,
		types: Array.from(unions.values()),
		related: components.slice(1).map((child) => ({ name: child.name, slug })),
	};
}

/**
 * The theme contract, assembled from the stylesheets and the usage scan.
 *
 * @param stylesheets - Every stylesheet declaring part of the contract.
 * @param usage - Which components reach which token.
 * @returns Every declared token grouped by tone, and each scheme's values.
 */
export function collectTheme(
	stylesheets: string[],
	usage: Map<string, Set<string>>,
): ThemeReference {
	let light: ThemeDeclaration[] = [];
	let dark: ThemeDeclaration[] = [];

	for (let source of stylesheets) {
		light.push(...readBlock(source, ":root"));
		dark.push(...readBlock(source, ":is(.dark, .dark *)"));
	}

	let grouped = new Map<string, ThemeToken[]>();

	for (let { name } of light) {
		let tone = TONES.find((candidate) => name.startsWith(`--ui-${candidate}-`)) ?? null;
		let segment = tone === null ? name.slice("--ui-".length) : name.slice(`--ui-${tone}-`.length);
		let title = tone ?? groupOf(segment);

		let tokens = grouped.get(title) ?? [];
		tokens.push({
			name,
			controls: SEGMENT_MEANING[segment] ?? meaningOf(segment),
			components: Array.from(usage.get(name) ?? []).sort(),
		});
		grouped.set(title, tokens);
	}

	return { groups: describeGroups(grouped), light, dark };
}

/**
 * Which components reach which token. Components are scanned once each and their
 * tokens collected, rather than each token searched for across the catalogue, because
 * a hundred sources times a hundred tokens is ten thousand passes over the same text.
 *
 * @param sources - Every component module's text.
 * @returns Component names keyed by the token each one reads.
 */
export function collectUsage(sources: string[]): Map<string, Set<string>> {
	let usage = new Map<string, Set<string>>();

	for (let source of sources) {
		let name = componentName(source);
		if (name === null) continue;

		for (let token of tokensIn(source)) {
			let users = usage.get(token) ?? new Set<string>();
			users.add(name);
			usage.set(token, users);
		}
	}

	return usage;
}

/** Every token one component's source reaches, whether by name or through a mixin. */
export function tokensIn(source: string): Set<string> {
	let tokens = new Set<string>();

	for (let match of source.matchAll(/--ui-[a-z0-9-]+/g)) tokens.add(match[0]);

	for (let match of source.matchAll(/"(brand|neutral|success|warning|danger)\.([A-Za-z]+)"/g)) {
		let suffix = match[2] as string;
		tokens.add(`--ui-${match[1]}-${SUFFIX_SEGMENTS[suffix] ?? suffix}`);
	}

	for (let match of source.matchAll(
		/\b(bg|fg|border|ring)\(\s*"(brand|neutral|success|warning|danger)"/g,
	)) {
		tokens.add(`--ui-${match[2]}-${BARE_TONE_MIXINS[match[1] as string]}`);
	}

	return tokens;
}

/**
 * One comment's prose, with every inline link replaced by its label. A comment is
 * written for someone reading the source, so it carries `{@link}` tags a type checker
 * resolves and a reader of the rendered page cannot.
 *
 * @param description - The description as the extractor reported it.
 * @returns The same prose, readable without the source beside it.
 */
export function toProse(description: string): string {
	let resolved = description;

	for (let link of inlineLinks(description).reverse()) {
		let label = link.text ?? link.target;
		resolved = resolved.slice(0, link.index) + label + resolved.slice(link.index + link.raw.length);
	}

	return resolved.trim();
}

/** The opening sentence of a description, which is the line a listing has room for. */
export function toSummary(description: string): string {
	let collapsed = toProse(description).replace(/\s+/g, " ");
	let stop = collapsed.indexOf(". ");
	return stop === -1 ? collapsed : collapsed.slice(0, stop + 1);
}

/** Whether an example is the emitted half of a pair rather than a call of its own. */
function isOutput(example: string): boolean {
	return example.startsWith("css(") || /^["'`]/.test(example);
}

/**
 * The CSS property the utility sets, which is what the page is titled after: a reader
 * looking for `padding` finds it by that name rather than by `p`. A utility whose
 * first declaration is keyed by a selector or an at-rule sets no single property —
 * every variant does this — so it keeps its own name instead.
 */
function cssProperty(examples: UtilityExample[]): string | null {
	let first = examples[0]?.output;
	if (!first) return null;

	let key = /^css\(\s*\{\s*([A-Za-z][A-Za-z0-9]*)\s*:/.exec(first)?.[1];
	if (!key) return null;

	return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** How the function is called, written the way the package is imported. */
function signature(name: string, declared: DocSignature | null): string {
	let parameters = (declared?.parameters ?? []).map((parameter) => {
		let prefix = parameter.rest ? "..." : "";
		let mark = parameter.optional && !parameter.rest ? "?" : "";
		let type = parameter.type ? `: ${parameter.type}` : "";
		return `${prefix}${parameter.name}${mark}${type}`;
	});

	return `u.${name}(${parameters.join(", ")})`;
}

/** A `@see` written as a markdown link, which is how the source points at MDN. */
function readLink(text: string): UtilityLink[] {
	let link = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/.exec(text.trim());
	return link ? [{ label: link[1] as string, href: link[2] as string }] : [];
}

/** Every `--ui-*` custom property the module reads, which is what a theme overrides. */
function readTokens(source: string): string[] {
	let names = new Set<string>();
	for (let match of source.matchAll(/--ui-[a-z0-9-]+/g)) names.add(match[0]);
	return Array.from(names).sort();
}

/**
 * The rows of one prop interface. A prop annotated with a union declared beside it
 * carries that union's members, because "which strings are allowed" is the question
 * a `variant` prop raises and the type name alone never answers.
 */
function readProps(
	host: DocNode,
	interfaceName: string,
	unions: Map<string, ComponentType>,
	shared: string[],
): PropsTable {
	let declared = host.children.find(
		(child) => child.kind === "interface" && child.name === interfaceName,
	);
	if (!declared) return { rows: [], inherits: [] };

	let rows: PropRow[] = [];

	for (let member of declared.children) {
		let type = member.type ?? "unknown";
		rows.push({
			name: member.name,
			type,
			description: toProse(member.comment?.description ?? "").replace(/\s+/g, " "),
			optional: member.flags.optional,
			values: unions.get(type)?.values ?? unionMembers(type, shared),
		});
	}

	return { rows, inherits: declared.extends };
}

/**
 * The string members of a union type. A type written as a name rather than as members
 * is looked up among the shared modules, which is where the roles every component
 * colors itself with are declared.
 */
export function unionMembers(type: string | null, shared: string[]): string[] {
	if (!type) return [];

	if (/^[A-Za-z][A-Za-z0-9]*$/.test(type)) {
		let declared = findSharedType(type, shared);
		return declared === null ? [] : unionMembers(declared, shared);
	}

	let members = type
		.split("|")
		.map((member) => member.trim())
		.filter((member) => /^"[^"]*"$/.test(member));

	return members.length > 1 ? members : [];
}

/** The right-hand side of a shared type alias, or `null` when none declares it. */
function findSharedType(name: string, shared: string[]): string | null {
	let pattern = new RegExp(`^export type ${name} =([\\s\\S]*?);$`, "m");

	for (let source of shared) {
		let declared = pattern.exec(source)?.[1];
		if (declared) return declared.trim();
	}

	return null;
}

/** Every declaration inside one selector's block, in the order it declares them. */
function readBlock(source: string, selector: string): ThemeDeclaration[] {
	let start = source.indexOf(`${selector} {`);
	if (start === -1) return [];

	let end = source.indexOf("\n}", start);
	let body = source.slice(start, end === -1 ? undefined : end);
	let declarations: ThemeDeclaration[] = [];

	for (let match of body.matchAll(/(--ui-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
		declarations.push({ name: match[1] as string, value: (match[2] as string).trim() });
	}

	return declarations;
}

/** Which band a token with no tone belongs to, read from the family its name starts with. */
function groupOf(segment: string): string {
	if (segment.startsWith("chart-")) return "chart";
	if (segment.startsWith("text-")) return "type scale";
	if (segment.startsWith("font-")) return "font stacks";
	if (segment.startsWith("container-")) return "container scale";
	if (segment === "spacing") return "spacing";
	return "surface";
}

/** What a token with no entry in the table controls, read from the name itself. */
function meaningOf(segment: string): string {
	if (segment.startsWith("chart-")) return `Series ${segment.slice("chart-".length)} of a chart`;
	if (segment.startsWith("text-")) return `Font size named ${segment.slice("text-".length)}`;
	if (segment.startsWith("font-")) return `The ${segment.slice("font-".length)} family stack`;
	if (segment.startsWith("container-")) {
		return `Container width named ${segment.slice("container-".length)}`;
	}
	if (segment === "spacing") return "The step every spacing utility multiplies";
	return "The page's own surface, outside any tone";
}

/** Each band, titled and introduced, in the order the page reads them. */
function describeGroups(grouped: Map<string, ThemeToken[]>): ThemeGroup[] {
	return GROUP_ORDER.flatMap((title) => {
		let tokens = grouped.get(title);
		if (!tokens) return [];

		return [
			{
				title,
				description:
					GROUP_INTROS[title] ??
					`Every variable a component reads when its \`data-color\` is \`${title}\`.`,
				tokens,
			},
		];
	});
}
