/**
 * The README's per-command reference, rendered from the contract's description: one heading per
 * command with its arguments, its description and a table of its flags. Rendering it from the
 * contract keeps the README in step with `sdxc <command> --help`, and a test fails when it drifts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CommandDescription, FlagDescription } from "@sdxc/cli";

/** The first line of the reference section, the heading every command's entry starts with. */
const SECTION_START = "#### `sdxc ";

/** The heading right after the reference section, which the section ends before. */
const SECTION_END = "### Configuration";

/**
 * Every command under `root` as Markdown, in contract order, its tables padded as the formatter
 * writes them. A group with no arguments or flags of its own gets no entry; its members do.
 *
 * @example let reference = renderReference(createSDXC().describe()!);
 */
export function renderReference(root: CommandDescription): string {
	let blocks: string[] = [];
	for (let command of root.commands) blocks.push(...renderCommand(command));
	return `${blocks.join("\n\n")}\n`;
}

/**
 * The reference section of `readme`: from the first command heading up to the blank line before
 * the `### Configuration` heading, so it compares equal to `renderReference`'s output. `null`
 * when either heading is missing.
 */
export function readReference(readme: string): string | null {
	let range = referenceRange(readme);
	return range === null ? null : readme.slice(range.start, range.end);
}

/**
 * `readme` with its reference section replaced by `reference`, or `null` when either heading
 * bounding the section is missing.
 */
export function replaceReference(readme: string, reference: string): string | null {
	let range = referenceRange(readme);
	if (range === null) return null;
	return `${readme.slice(0, range.start)}${reference}${readme.slice(range.end)}`;
}

/** Where the reference section starts and ends in `readme`. */
function referenceRange(readme: string): { start: number; end: number } | null {
	let start = readme.indexOf(SECTION_START);
	if (start === -1) return null;
	let end = readme.indexOf(`\n${SECTION_END}\n`, start);
	if (end === -1) return null;
	return { start, end };
}

/** One command's entry followed by its members', each a Markdown block. */
function renderCommand(command: CommandDescription): string[] {
	let flags = command.flags.filter((flag) => !flag.builtin);
	let blocks: string[] = [];
	if (command.commands.length === 0 || command.arguments.length > 0 || flags.length > 0) {
		blocks.push(`#### \`${heading(command)}\``);
		if (command.description) blocks.push(escapeHTML(command.description));
		if (flags.length > 0) {
			blocks.push(
				table(
					["Flag", "Does"],
					flags.map((flag) => [
						`\`${flagName(flag)}\``,
						escapeHTML(flag.description ?? "").replaceAll("|", "\\|"),
					]),
				),
			);
		}
	}
	for (let member of command.commands) blocks.push(...renderCommand(member));
	return blocks;
}

/** The command line as the help's usage writes it: `<name>` required, `[name]` optional. */
function heading(command: CommandDescription): string {
	let words = command.arguments.map((argument) => {
		if (argument.variadic || argument.rest) return `[${argument.name}...]`;
		return argument.required ? `<${argument.name}>` : `[${argument.name}]`;
	});
	return [command.title, ...words].join(" ");
}

/**
 * The flag as typed: its short alias first, a boolean on by default spelled `--no-<name>`, and
 * the value name a non-boolean takes.
 */
function flagName(flag: FlagDescription): string {
	let long = `--${flag.negatable && flag.default === true ? "no-" : ""}${flag.name}`;
	let names = flag.short ? `-${flag.short}, ${long}` : long;
	return flag.value ? `${names} <${flag.value}>` : names;
}

/**
 * A description as Markdown text: `<` and `>` as entities, so a placeholder such as `<name>`
 * renders instead of reading as an HTML tag.
 */
function escapeHTML(text: string): string {
	return text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** A Markdown table with every column padded to its widest cell. */
function table(header: string[], rows: string[][]): string {
	let widths = header.map((cell, column) =>
		Math.max(cell.length, ...rows.map((row) => (row[column] ?? "").length)),
	);
	let line = (cells: string[]) =>
		`| ${cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join(" | ")} |`;
	return [line(header), line(widths.map((width) => "-".repeat(width))), ...rows.map(line)].join(
		"\n",
	);
}
