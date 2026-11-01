/**
 * The component `toRemix` draws every fenced code block with, as `@sdxc/ui`'s `CodeBlock`:
 * a header naming the fence's file, a copy button, and the lines its `{% add highlight remove %}`
 * annotations mark, so one `ts` fence shows a diff and still highlights as TypeScript.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { mbe } from "@sdxc/u/size";
import { CodeBlock } from "@sdxc/ui";

/** The copy button's strings; the blog's pages are English. */
const CODE_LABELS: CodeBlock.Labels = { copy: "Copy code", copied: "Copied" };

/** Languages whose fences are commands typed at a prompt, which read as a terminal. */
const SHELL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh", "console"]);

/** Props `toRemix` passes a fence: the code node's fields, then whatever its annotation wrote. */
export interface CodeFenceProps {
	content: string;
	language?: string;
	/** Runs the highlight pass painted, read as unknown because any plugin may set the field. */
	tokens?: unknown;
	/** The header; a fence's `path` wins over its `title` when it wrote both. */
	path?: unknown;
	title?: unknown;
	highlight?: unknown;
	add?: unknown;
	remove?: unknown;
	children?: RemixNode;
}

/**
 * Draws a fence such as `ts {% path="vite.config.ts" add=[3] remove=[2] highlight=[5] %}`.
 * Removed lines stay on screen and off the clipboard, and a malformed annotation is dropped
 * rather than thrown, so a typo in one never takes the post down.
 *
 * @example toRemix(document, { components: { code: CodeFence } })
 */
export function CodeFence(handle: Handle<CodeFenceProps>) {
	return () => {
		let { add, content, highlight, language, path, remove, title, tokens } = handle.props;

		return (
			<CodeBlock
				code={content}
				language={language}
				tokens={tokenList(tokens)}
				title={stringOf(path) ?? stringOf(title) ?? shellTitle(language)}
				highlight={lineList(highlight)}
				add={lineList(add)}
				remove={lineList(remove)}
				labels={CODE_LABELS}
				mix={[mbe(4)]}
			/>
		);
	};
}

/** "Terminal" for an untitled shell fence, so the header names where the lines are typed. */
function shellTitle(language: string | undefined): string | undefined {
	return language && SHELL_LANGUAGES.has(language.toLowerCase()) ? "Terminal" : undefined;
}

/** A string attribute, or nothing for any other value. */
function stringOf(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

/** A list of line numbers, or nothing when the attribute holds anything else. */
function lineList(value: unknown): number[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value.every((line) => typeof line === "number") ? value : undefined;
}

/** Painted runs, or nothing when the field is missing or malformed so the block paints itself. */
function tokenList(value: unknown): CodeBlock.Token[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined;
	return value.every(isToken) ? value : undefined;
}

/** Whether one run has the `{ type, value }` shape every painter writes. */
function isToken(value: unknown): value is CodeBlock.Token {
	if (typeof value !== "object" || value === null) return false;
	let candidate = value as { type?: unknown; value?: unknown };
	return typeof candidate.type === "string" && typeof candidate.value === "string";
}
