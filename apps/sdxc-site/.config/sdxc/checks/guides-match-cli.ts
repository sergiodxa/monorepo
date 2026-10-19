/**
 * Keeps the guides and the `sdxc` command line in step. Every `sdxc …` line a guide shows is
 * checked against the CLI this checkout builds, so a renamed flag fails `sdxc doctor`, and a
 * command or flag no guide shows is reported as a gap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CommandDescription } from "@sdxc/cli";

import { createSDXC } from "@sdxc/kit";
import { defineCheck } from "@sdxc/kit/doctor";
import { isFailure } from "@sdxc/result";

/** Where the guides live, relative to the project root. */
const GUIDES = "resources/docs";

/** The guides of the command line itself, which every command and flag must appear in. */
const CLI_GUIDES = "resources/docs/sdxc/";

/** Fence languages whose lines are commands a reader types. */
const SHELL_LANGUAGES: ReadonlySet<string> = new Set(["bash", "sh", "shell", "zsh", "console"]);

/** A token that stands for something the reader fills in, so the line is an outline. */
const PLACEHOLDER = /^[<[]|[>\]]$|\.\.\.|…|^\{/;

/** A usage error about a value left out rather than one written wrong. */
const MISSING = /^Missing argument |is required/;

/** One `sdxc` command line a guide shows. */
export interface Invocation {
	/** The guide, relative to the project root. */
	file: string;
	line: number;
	/** The arguments after `sdxc`, as a shell would split them. */
	argv: string[];
	/** Whether a reader fills in part of it, which leaves it unchecked. */
	outline: boolean;
	/**
	 * Shown as inline code in prose, which names a command as often as it runs one, so a missing
	 * argument there is no mistake.
	 */
	inline: boolean;
}

/**
 * Splits one shell line into words, honoring single and double quotes and backslashes; a `#`
 * starting a word ends the line.
 */
export function shellWords(line: string): string[] {
	let words: string[] = [];
	let word = "";
	let started = false;
	let quote: '"' | "'" | null = null;
	for (let index = 0; index < line.length; index += 1) {
		let char = line[index] as string;
		if (quote !== null) {
			if (char === quote) quote = null;
			else if (char === "\\" && quote === '"' && index + 1 < line.length) {
				index += 1;
				word += line[index];
			} else word += char;
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			started = true;
		} else if (char === "\\" && index + 1 < line.length) {
			index += 1;
			word += line[index];
			started = true;
		} else if (/\s/.test(char)) {
			if (started) words.push(word);
			word = "";
			started = false;
		} else if (char === "#" && !started) break;
		else {
			word += char;
			started = true;
		}
	}
	if (started) words.push(word);
	return words;
}

/**
 * The `sdxc` command lines in one shell line: each command a `&&`, `||`, `;` or `|` separates
 * that starts with `sdxc`, with a leading `$ ` prompt dropped.
 */
export function sdxcCommands(line: string): { argv: string[]; outline: boolean }[] {
	let commands: string[][] = [[]];
	for (let word of shellWords(line.replace(/^\s*\$\s+/, ""))) {
		if (word === "&&" || word === "||" || word === ";" || word === "|") commands.push([]);
		else (commands.at(-1) as string[]).push(word);
	}
	return commands
		.filter((words) => words[0] === "sdxc")
		.map((words) => {
			let argv = words.slice(1);
			return { argv, outline: argv.some((word) => PLACEHOLDER.test(word)) };
		});
}

/**
 * Every `sdxc` command line in one guide: each line of a shell fence, a backslash joining it to
 * the next, and every inline code span outside fences that starts with `sdxc `.
 */
export function findInvocations(file: string, text: string): Invocation[] {
	let invocations: Invocation[] = [];
	let lines = text.split("\n");
	let fence: { marker: string; shell: boolean } | null = null;
	let pending = "";
	let pendingLine = 0;
	lines.forEach((raw, index) => {
		let opener = /^\s*(`{3,}|~{3,})\s*([\w-]*)/.exec(raw);
		if (fence === null && opener !== null) {
			fence = { marker: opener[1] as string, shell: SHELL_LANGUAGES.has(opener[2] ?? "") };
			return;
		}
		if (fence !== null) {
			if (raw.trim().startsWith(fence.marker)) {
				fence = null;
				return;
			}
			if (!fence.shell) return;
			if (pending === "") pendingLine = index + 1;
			if (raw.endsWith("\\")) {
				pending += `${raw.slice(0, -1)} `;
				return;
			}
			let line = pending + raw;
			pending = "";
			for (let command of sdxcCommands(line)) {
				invocations.push({ file, line: pendingLine, inline: false, ...command });
			}
			return;
		}
		for (let match of raw.matchAll(/`(sdxc [^`]+)`/g)) {
			for (let command of sdxcCommands(match[1] as string)) {
				invocations.push({ file, line: index + 1, inline: true, ...command });
			}
		}
	});
	return invocations;
}

/** Every command under `description` that runs on its own: the leaves of the contract. */
export function commandsOf(description: CommandDescription): CommandDescription[] {
	if (description.commands.length === 0) return [description];
	return description.commands.flatMap(commandsOf);
}

/** The spellings of a flag a guide may show: `--name`, an alias, `--no-name`, `-s`. */
function spellings(flag: CommandDescription["flags"][number]): string[] {
	let names = [flag.name, ...flag.aliases];
	let spelled = names.map((name) => `--${name}`);
	if (flag.negatable) spelled.push(...names.map((name) => `--no-${name}`));
	if (flag.short !== null) spelled.push(`-${flag.short}`);
	return spelled;
}

export default defineCheck({
	name: "guides-match-cli",
	/**
	 * Fails on a guide line the CLI would refuse, since a reader copies it as written, and warns
	 * on a command or flag that no guide in the `sdxc` section shows, since a new flag can ship a
	 * release before its guide.
	 */
	async run(ctx) {
		let cli = createSDXC();
		let guides = (await ctx.files(GUIDES)).filter((file) => file.endsWith(".md"));
		let invocations: Invocation[] = [];
		let texts = new Map<string, string>();
		for (let file of guides) {
			let text = (await ctx.readFile(file)) ?? "";
			texts.set(file, text);
			invocations.push(...findInvocations(file, text));
		}

		let broken: string[] = [];
		/** The guides showing each command, by its path, for the coverage pass. */
		let shownIn = new Map<string, Set<string>>();
		let checked = 0;
		for (let invocation of invocations) {
			if (invocation.outline) continue;
			checked += 1;
			let result = await cli.check(invocation.argv);
			let shown = `sdxc ${invocation.argv.join(" ")}`;
			if (isFailure(result)) {
				let reasons = result.error.message
					.split("\n")
					.filter((reason) => !invocation.inline || !MISSING.test(reason));
				if (reasons.length > 0) {
					broken.push(`${invocation.file}:${invocation.line} ${shown} — ${reasons.join("; ")}`);
					continue;
				}
			}
			let key = (isFailure(result) ? invocation.argv : result.data.path).join(" ");
			let files = shownIn.get(key) ?? new Set<string>();
			files.add(invocation.file);
			shownIn.set(key, files);
		}

		let gaps: string[] = [];
		let root = cli.describe();
		for (let command of root === undefined ? [] : commandsOf(root)) {
			let key = command.path.join(" ");
			let files = [...(shownIn.get(key) ?? [])].filter((file) => file.startsWith(CLI_GUIDES));
			if (files.length === 0) {
				gaps.push(`${command.title}: no guide in ${CLI_GUIDES} runs it`);
				continue;
			}
			let text = files.map((file) => texts.get(file) ?? "").join("\n");
			for (let flag of command.flags) {
				if (flag.builtin) continue;
				if (spellings(flag).some((spelling) => text.includes(spelling))) continue;
				gaps.push(`${command.title} --${flag.name}: no guide that runs it mentions it`);
			}
		}

		if (broken.length > 0) {
			return {
				status: "fail",
				message: `${broken.length} sdxc command line${broken.length === 1 ? "" : "s"} in the guides the CLI refuses`,
				findings: [...broken, ...gaps],
				fix: "Correct each line from `sdxc <command> --help`, or change the CLI to accept it",
			};
		}
		if (gaps.length > 0) {
			return {
				status: "warn",
				message: `${gaps.length} command${gaps.length === 1 ? "" : "s"} or flags no guide shows`,
				findings: gaps,
				fix: `Show each one in its guide in ${CLI_GUIDES}`,
			};
		}
		return {
			status: "pass",
			message: `${checked} sdxc command lines in ${new Set(invocations.map((i) => i.file)).size} guides match the CLI`,
		};
	},
});
