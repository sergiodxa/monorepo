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
	"target-size":
		"Smallest pointer target hitArea() grows a small control to; 2.75rem on a coarse pointer",
	"shadow-ring": "Ring plus lift an elevated surface draws in place of a solid border",
	"shadow-ring-hover": "That ring while the pointer is over the surface",
	"image-outline": "Inset hairline that holds an image's edge against a same-tone background",
	"marketing-measure": "Max content width of a marketing column",
	"marketing-gutter": "Inline padding at the narrowest marketing container step",
	"marketing-section-space": "Block padding for a normal marketing band",
	"marketing-section-space-compact": "Block padding for a compact marketing band",
	"marketing-section-space-hero": "Block padding for a hero marketing band",
	"marketing-display-tracking": "Letter-spacing for marketing display headlines",
	"marketing-display-weight": "Font weight for marketing display headlines",
	"marketing-display-leading": "Line-height for marketing display headlines",
	"marketing-lead-measure": "Max width of supporting lead copy under a headline",
	"marketing-lead-size": "Font size of supporting lead copy",
	"marketing-chapter-size": "Font size of a marketing section H2",
	"marketing-logo-height": "Forced height of a logo-cloud mark",
	"marketing-header-height": "Sticky marketing header target height",
	"marketing-cta-radius": "Corner radius language for brand CTAs on landings",
};

/**
 * Variables no stylesheet declares, which components read with a fallback. Each is
 * listed only when a component reaches it, and says its default because no scheme
 * block prints one.
 */
const FALLBACK_TOKENS: Record<string, string> = {
	"--ui-surface-padding":
		"Padding inside a floating panel, 0.25rem; the panel's radius grows with it so rows stay concentric",
	"--ui-button-icon-size-sm": "Side of a small icon-only Button, 2rem",
	"--ui-button-icon-size-md": "Side of a medium icon-only Button, 2.5rem",
	"--ui-button-icon-size-lg": "Side of a large icon-only Button, 3rem",
	"--ui-tag-remove-size": "Glyph size of TagGroup.Remove, 1rem",
	"--ui-checkbox-size": "Side of the Checkbox box, 1.25rem",
};

/** How each band of the theme table is introduced. */
const GROUP_INTROS: Record<string, string> = {
	surface: "The page itself, which a tone sits on rather than replaces, and the edges drawn on it.",
	spacing: "One step, multiplied by every spacing utility.",
	sizing: "The sizes small controls and their pointer targets are drawn at.",
	"type scale": "The named font sizes.",
	"font stacks": "The three families, resolved to system faces.",
	"container scale": "The named widths a container query compares against.",
	chart: "The categorical sequence a multi-series chart walks in order.",
	marketing: "Layout and display tokens for landing bands, overridden per brand.",
};

/** The order the theme page reads its bands in. */
const GROUP_ORDER = [
	...TONES,
	"surface",
	"spacing",
	"sizing",
	"type scale",
	"font stacks",
	"container scale",
	"chart",
	"marketing",
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

	for (let [name, controls] of Object.entries(FALLBACK_TOKENS)) {
		let components = usage.get(name);
		if (!components || light.some((declaration) => declaration.name === name)) continue;

		let title = groupOf(name.slice("--ui-".length));
		let tokens = grouped.get(title) ?? [];
		tokens.push({ name, controls, components: Array.from(components).sort() });
		grouped.set(title, tokens);
	}

	return { groups: describeGroups(grouped), light, dark };
}

/**
 * Which components reach which token. Components are scanned once each and their
 * tokens collected, rather than each token searched for across the catalogue, because
 * a hundred sources times a hundred tokens is ten thousand passes over the same text.
 *
 * A token a shared style module reads counts for a component importing the export
 * that reaches it.
 *
 * @param sources - Every component module's text.
 * @param modules - Shared style modules' text, keyed by the specifier a component imports.
 * @returns Component names keyed by the token each one reads.
 */
export function collectUsage(
	sources: string[],
	modules: Map<string, string> = new Map(),
): Map<string, Set<string>> {
	let usage = new Map<string, Set<string>>();

	for (let source of sources) {
		let name = componentName(source);
		if (name === null) continue;

		let reached = tokensIn(source);
		for (let match of source.matchAll(/import\s*\{([^}]*)\}\s*from "([^"]+)"/g)) {
			let imported = modules.get(match[2] as string);
			if (imported === undefined) continue;

			let names = (match[1] as string)
				.split(",")
				.map(
					(specifier) =>
						specifier
							.replace(/^\s*type\s+/, "")
							.trim()
							.split(/\s+/)[0] ?? "",
				)
				.filter(Boolean);
			for (let token of tokensIn(reachedThrough(imported, names))) reached.add(token);
		}

		for (let token of reached) {
			let users = usage.get(token) ?? new Set<string>();
			users.add(name);
			usage.set(token, users);
		}
	}

	return usage;
}

/**
 * Escapes every character that would change a RegExp's meaning, so an identifier
 * can be interpolated as a literal without becoming an operator.
 */
function escapeRegExp(value: string): string {
	return value.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Whether `body` names `identifier` as a whole token. `$` is an identifier
 * character in JavaScript, so the edges are checked against that alphabet
 * rather than `\b`, which would treat `$` as a boundary.
 */
function mentionsIdentifier(body: string, identifier: string): boolean {
	return new RegExp(`(?<![A-Za-z0-9_$])${escapeRegExp(identifier)}(?![A-Za-z0-9_$])`).test(body);
}

/**
 * The code of the named exports of a module and of every module-level declaration
 * they reference, with comments removed, so a token counts only where code reads it.
 *
 * @param source - The module's text.
 * @param names - The exports an importer names.
 * @returns The reached declarations' text, concatenated.
 */
export function reachedThrough(source: string, names: string[]): string {
	let code = source.replace(/\/\*[\s\S]*?\*\//g, "");
	let starts = Array.from(
		code.matchAll(
			/^(?:export )?(?:const|let|function|interface|namespace|type) ([A-Za-z_$][\w$]*)/gm,
		),
	);
	let declarations = new Map<string, string>();
	starts.forEach((match, index) => {
		declarations.set(match[1] as string, code.slice(match.index, starts[index + 1]?.index));
	});

	let seen = new Set<string>();
	let queue = names.filter((name) => declarations.has(name));
	while (queue.length > 0) {
		let name = queue.pop() as string;
		if (seen.has(name)) continue;
		seen.add(name);

		let body = declarations.get(name) ?? "";
		for (let other of declarations.keys()) {
			if (!seen.has(other) && mentionsIdentifier(body, other)) {
				queue.push(other);
			}
		}
	}

	return Array.from(seen, (name) => declarations.get(name)).join("\n");
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
 * looking for `padding` finds it by that name rather than by `p`. Only a utility whose
 * first output sets one property, counting its vendor-prefixed copies as the same one,
 * is titled this way; a composite such as `zstack`, or a variant keyed by a selector or an
 * at-rule, keeps its own name.
 */
export function cssProperty(examples: UtilityExample[]): string | null {
	let first = examples[0]?.output;
	if (!first?.startsWith("css(")) return null;

	let keys = topLevelKeys(first);
	if (keys.some((key) => !/^[A-Za-z][A-Za-z0-9]*$/.test(key))) return null;

	let properties = new Set(
		keys.map((key) => {
			let unprefixed = key.replace(/^(Webkit|Moz|ms)(?=[A-Z])/, "");
			return unprefixed.charAt(0).toLowerCase() + unprefixed.slice(1);
		}),
	);
	if (properties.size !== 1) return null;

	let [property = ""] = properties;
	return property.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * The keys of the outermost object literal in a `css({ … })` output, in order. Nested
 * objects, calls and strings are skipped whole, so a selector's declarations never read
 * as the host's own; a quoted key is returned with its quotes, which no property name has.
 */
function topLevelKeys(output: string): string[] {
	let keys: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let token = "";

	for (let index = output.indexOf("{"); index < output.length; index++) {
		let char = output[index] ?? "";

		if (quote !== null) {
			token += char;
			if (char === "\\") token += output[++index] ?? "";
			else if (char === quote) quote = null;
			continue;
		}

		if (char === '"' || char === "'" || char === "`") {
			quote = char;
			token += char;
		} else if (char === "{" || char === "(" || char === "[") {
			depth++;
			token = "";
		} else if (char === "}" || char === ")" || char === "]") {
			depth--;
			token = "";
			if (depth === 0) break;
		} else if (char === ":" && depth === 1) {
			keys.push(token.trim());
			token = "";
		} else if (char === "," && depth === 1) {
			token = "";
		} else if (depth === 1) {
			token += char;
		}
	}

	return keys;
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
	if (segment.startsWith("marketing-")) return "marketing";
	if (segment.startsWith("text-")) return "type scale";
	if (segment.startsWith("font-")) return "font stacks";
	if (segment.startsWith("container-")) return "container scale";
	if (segment === "spacing") return "spacing";
	if (segment.endsWith("-size") || /-size-[a-z]+$/.test(segment)) return "sizing";
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
