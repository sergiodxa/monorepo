/**
 * The catalogue pages written as markdown: a `@sdxc/u` utility, a `@sdxc/ui` component,
 * subpath export or theme contract. Each is generated from the record its HTML page
 * draws, so what a model reads at a page's `.md` twin and what a person reads agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ComponentReference, PropRow, PropsTable } from "~/app/services/components";
import type { ThemeDeclaration, ThemeReference } from "~/app/services/theming";
import type { UiExportReference, UiSymbol } from "~/app/services/ui-exports";
import type { UtilityReference } from "~/app/services/utilities";

import {
	atWidth,
	customValue,
	onState,
	RESPONSIVE_FAMILY,
	STATE_FAMILY,
} from "~/app/services/utility-calls";

/** The theme page's heading and lead, which its HTML page states too. */
export const THEMING_TITLE = "Theming";

/** What the theme page is, in the one line a listing shows. */
export const THEMING_SUMMARY =
	"Every theme variable the catalogue reads, and the two schemes that answer them.";

/**
 * One utility's page, titled by the CSS property it sets the way the HTML page is.
 *
 * @param reference - The utility as the catalogue document holds it.
 * @returns The page as markdown: every documented call beside the CSS it emits, the
 * same call with a custom value, on a state and at a width, and the variables it reads.
 */
export function utilityMarkdown(reference: UtilityReference): string {
	let paired = reference.examples.filter((example) => example.output !== null);
	let snippets = reference.examples.filter((example) => example.output === null);
	let blocks = [
		`# ${reference.property}`,
		`> ${oneLine(reference.summary)}`,
		fence(`import { ${reference.name} } from "@sdxc/u/${reference.family}";`, "ts"),
		reference.description,
		reference.see.map((link) => `- [${link.label}](${link.href})`).join("\n"),
	];

	if (paired.length > 0) {
		blocks.push(
			"## Quick reference",
			"Every documented call, beside the CSS it emits.",
			table(
				["Call", "CSS"],
				paired.map((example) => [code(example.call), code(example.output ?? "")]),
			),
		);
	}

	if (snippets.length > 0) {
		blocks.push("## Examples", ...snippets.map((example) => fence(example.call, "ts")));
	}

	blocks.push(
		"## Using a custom value",
		"Every scale argument also takes a raw CSS value, which passes through untouched.",
		fence(customValue(reference), "ts"),
	);

	if (reference.family !== STATE_FAMILY) {
		blocks.push(
			"## Applying on a state",
			"Wrap the call in a state utility to scope it to one selector.",
			fence(onState(reference), "ts"),
		);
	}

	if (reference.family !== RESPONSIVE_FAMILY) {
		blocks.push(
			"## Responsive design",
			"Wrap the call in a container query to scope it to one width.",
			fence(atWidth(reference), "ts"),
		);
	}

	if (reference.tokens.length > 0) {
		blocks.push(
			"## Customizing the theme",
			"The custom properties this utility reads, which a theme redefines.",
			reference.tokens.map((token) => `- ${code(token)}`).join("\n"),
		);
	}

	blocks.push("## Signature", fence(reference.signature, "ts"));

	return join(blocks);
}

/**
 * One component's page.
 *
 * @param reference - The component as the catalogue document holds it.
 * @returns The page as markdown, opening with its name and the line that says what it is.
 */
export function componentMarkdown(reference: ComponentReference): string {
	let blocks = [
		`# ${reference.name}`,
		`> ${oneLine(reference.summary)}`,
		fence(`import { ${reference.name} } from "@sdxc/ui";`, "ts"),
		reference.description,
	];

	if (reference.examples.length > 0) {
		blocks.push("## Examples", ...reference.examples.map((example) => fence(example, "tsx")));
	}

	blocks.push("## Props", propsMarkdown(reference.props));

	for (let part of reference.parts) {
		blocks.push(`### ${part.name}`);
		if (part.description) blocks.push(part.description);
		blocks.push(propsMarkdown(part.props));
	}

	if (reference.types.length > 0) {
		blocks.push(
			"## Types",
			table(
				["Name", "Values", "What it decides"],
				reference.types.map((type) => [
					code(type.name),
					code(type.values.join(" | ")),
					type.description,
				]),
			),
		);
	}

	if (reference.related.length > 0) {
		blocks.push(
			"## Also exported",
			reference.related.map((entry) => `- ${code(entry.name)}`).join("\n"),
		);
	}

	return join(blocks);
}

/**
 * One mixin, behavior class, animation or style recipe.
 *
 * @param reference - The export as the subpath document holds it.
 * @returns The page as markdown, its companions after it under their own headings.
 */
export function uiExportMarkdown(reference: UiExportReference): string {
	let { companions, symbol } = reference;
	let module = `@sdxc/ui/${reference.subpath}`;
	let blocks = [
		`# ${reference.name}`,
		`> ${oneLine(reference.summary)}`,
		fence(`import { ${symbol.name.split(".")[0] ?? symbol.name} } from "${module}";`, "ts"),
		symbol.description,
		...symbolMarkdown(symbol, "##"),
	];

	if (companions.length > 0) {
		blocks.push(
			"## Used with it",
			`The events, constants and types its module publishes, each imported from \`${module}\` too.`,
		);

		for (let companion of companions) {
			blocks.push(`### ${companion.name}`);
			if (companion.description) blocks.push(companion.description);
			blocks.push(...symbolMarkdown(companion, "####"));
		}
	}

	return join(blocks);
}

/**
 * The theme contract: every variable under the role it belongs to, then both schemes.
 *
 * @param theme - The contract as the theme document holds it.
 * @returns The page as markdown.
 */
export function themeMarkdown(theme: ThemeReference): string {
	let blocks = [
		`# ${THEMING_TITLE}`,
		`> ${THEMING_SUMMARY}`,
		fence(`import "@sdxc/ui/theme.css";`, "ts"),
		"A component picks a role — brand, neutral, success, warning, danger — and the role resolves to a fill, the text on that fill, a border and a focus ring. Redefine the variables and the whole catalogue moves with them.",
	];

	for (let group of theme.groups) {
		blocks.push(
			`## ${group.title}`,
			group.description,
			table(
				["Token", "What it controls", "Components that read it"],
				group.tokens.map((token) => [
					code(token.name),
					token.controls,
					token.components.join(", ") || "—",
				]),
			),
		);
	}

	blocks.push(
		"## Light",
		fence(scheme(":root", theme.light), "css"),
		"## Dark",
		"The same names, redefined under a dark ancestor. Add `.dark` to force it, or `.system` to follow the reader's own setting.",
		fence(scheme(":is(.dark, .dark *)", theme.dark), "css"),
	);

	return join(blocks);
}

/** The blocks a symbol's own reference is made of, under headings at the given depth. */
function symbolMarkdown(symbol: UiSymbol, depth: string): string[] {
	let blocks: string[] = [];

	if (symbol.signature) {
		blocks.push(`${depth} Signature`, fence(symbol.signature, "ts"));
		if (symbol.returns) blocks.push(`Returns: ${symbol.returns}`);
	}

	if (symbol.parameters.length > 0 && symbol.kind !== "event") {
		blocks.push(`${depth} Parameters`, rowsMarkdown("Parameter", symbol.parameters));
	}

	if (symbol.members.length > 0) {
		let label = symbol.kind === "interface" ? "Member" : "Property";
		blocks.push(`${depth} ${label === "Member" ? "Members" : "Properties"}`);
		blocks.push(rowsMarkdown(label, symbol.members));
	}

	if (symbol.methods.length > 0) {
		blocks.push(
			`${depth} Methods`,
			table(
				["Method", "Description"],
				symbol.methods.map((method) => [code(method.signature), method.description]),
			),
		);
	}

	if (symbol.values.length > 0 && symbol.kind === "type") {
		blocks.push(`One of ${symbol.values.map(code).join(", ")}.`);
	}

	if (symbol.examples.length > 0) {
		blocks.push(`${depth} Examples`, ...symbol.examples.map((example) => fence(example, "tsx")));
	}

	return blocks;
}

/** A props interface: its rows, then what it inherits the rest of its surface from. */
function propsMarkdown(props: PropsTable): string {
	let blocks = props.rows.length > 0 ? [rowsMarkdown("Prop", props.rows)] : [];
	for (let inherited of props.inherits) {
		blocks.push(`Also accepts everything in ${code(inherited)}.`);
	}
	return blocks.length > 0 ? join(blocks) : "Takes no props of its own.";
}

/** Parameters, properties or members as one table, a union written as its members. */
function rowsMarkdown(first: string, rows: PropRow[]): string {
	return table(
		[first, "Type", "Description"],
		rows.map((row) => [
			code(row.optional ? `${row.name}?` : row.name),
			code(row.values.length > 0 ? row.values.join(" | ") : row.type),
			row.description,
		]),
	);
}

/**
 * A GitHub-flavored table. A cell's pipes are escaped and its line breaks folded, since
 * either one would end the cell early and shift every column after it.
 */
function table(columns: string[], rows: string[][]): string {
	let cell = (value: string) => oneLine(value).replace(/\|/g, "\\|");

	return [
		`| ${columns.join(" | ")} |`,
		`| ${columns.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
	].join("\n");
}

/** Inline code, with a fence long enough that a backtick inside it stays literal. */
function code(value: string): string {
	let marker = value.includes("`") ? "``" : "`";
	let pad = value.startsWith("`") || value.endsWith("`") ? " " : "";
	return `${marker}${pad}${value}${pad}${marker}`;
}

/** A fenced block, its fence longer than any run of backticks inside the code. */
function fence(content: string, language: string): string {
	let longest = Math.max(2, ...(content.match(/`+/g) ?? []).map((run) => run.length));
	let marker = "`".repeat(longest + 1);
	return `${marker}${language}\n${content}\n${marker}`;
}

/** One scheme printed back as the rule that declares it. */
function scheme(selector: string, declarations: ThemeDeclaration[]): string {
	let body = declarations.map((entry) => `\t${entry.name}: ${entry.value};`).join("\n");
	return `${selector} {\n${body}\n}`;
}

/** Prose folded onto one line, which a quote or a table cell needs. */
function oneLine(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

/** The blocks of a page, a blank line between each and one at the end of the file. */
function join(blocks: string[]): string {
	return `${blocks.filter((block) => block.trim() !== "").join("\n\n")}\n`;
}
