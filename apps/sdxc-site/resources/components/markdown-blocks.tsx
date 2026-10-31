/**
 * The markdown nodes and tags that draw as `@sdxc/ui` docs blocks: fences as `CodeBlock`,
 * `code-tabs` and `install-command` as synced `CodeTabs`, GitHub alerts as `Callout` and
 * the `files` tags as `FileTree`. Each one maps what a content file wrote onto those props.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement, RemixNode } from "remix/component";

import { Callout, CodeBlock, CodeTabs, FileTree, InstallCommand } from "@sdxc/ui";

import type { RememberedTabKey } from "~/app/services/remembered-tabs";
import type { MarkdownProps } from "~/resources/components/markdown-props";

import { parseInstallCommand } from "~/app/services/install-command";
import {
	PACKAGE_MANAGER_KEY,
	REMEMBERED_TAB_KEYS,
	REMEMBERED_TABS,
	rememberedTab,
} from "~/app/services/remembered-tabs";
import { CODE_LABELS, TERMINAL_TITLE } from "~/resources/components/docs-labels";

/** The kind and label each GitHub alert kind draws as; the two `Callout` lacks borrow a kind. */
const ALERT_KINDS: Record<string, { kind: Callout.Kind; label: string }> = {
	note: { kind: "note", label: "Note" },
	tip: { kind: "tip", label: "Tip" },
	important: { kind: "note", label: "Important" },
	warning: { kind: "warning", label: "Warning" },
	caution: { kind: "danger", label: "Caution" },
};

/** What an alert of an unknown kind draws as. */
const DEFAULT_ALERT = { kind: "note", label: "Note" } satisfies {
	kind: Callout.Kind;
	label: string;
};

namespace RememberedTabsScope {
	export interface Props {
		/** The request's `Cookie` header, which remembered strips render their choice from. */
		cookie: string | null | undefined;
		children: RemixNode;
	}
}

/**
 * Publishes the request's cookies to every strip rendered beneath it, so a strip written
 * inside a markdown document opens on the reader's choice without the document passing props.
 */
export function RememberedTabsScope(handle: Handle<RememberedTabsScope.Props, string | undefined>) {
	return () => {
		handle.context.set(handle.props.cookie ?? undefined);
		return handle.props.children;
	};
}

namespace Fence {
	export interface Props extends MarkdownProps {
		content: string;
		language?: string;
		/** Runs the markdown pass already painted, read as unknown because any plugin may set it. */
		tokens?: unknown;
		/** The header; a fence's `path` wins over its `title` when it wrote both. */
		title?: unknown;
		path?: unknown;
		highlight?: unknown;
		add?: unknown;
		remove?: unknown;
	}
}

/**
 * Draws every fenced code block. `{% title="…" %}` names the file, and `highlight`, `add`
 * and `remove` (`{% highlight={[2, 3]} %}`) mark lines; a malformed value is dropped rather
 * than thrown, so a typo in one annotation never takes the page down.
 */
export function Fence(handle: Handle<Fence.Props>) {
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
			/>
		);
	};
}

/** Languages whose fences are commands typed at a prompt, which read as a terminal. */
const SHELL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh", "console"]);

/** "Terminal" for an untitled shell fence, so the header names where the lines are typed. */
function shellTitle(language: string | undefined): string | undefined {
	return language && SHELL_LANGUAGES.has(language.toLowerCase()) ? TERMINAL_TITLE : undefined;
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

namespace CodeTabsTag {
	export interface Props extends MarkdownProps {
		/** The remembered choice the strip shares with every other strip naming it, site-wide. */
		name?: RememberedTabKey;
	}

	export interface TabProps extends MarkdownProps {
		label: string;
		/** Marks the tab an unnamed strip opens on. */
		selected?: boolean;
	}
}

/**
 * Draws the `code-tabs` tag from the `code-tab` tags inside it. A named strip syncs with
 * every strip naming the same key and opens on the choice the reader's cookie remembers;
 * an unnamed one opens on the tab the author marked `selected`.
 */
export function CodeTabsTag(handle: Handle<CodeTabsTag.Props>) {
	return () => {
		let { children, name } = handle.props;
		let tabs = elementsOf(children).filter((element) => element.type === CodeTabTag);
		let authored = tabs.find((tab) => tab.props.selected === true);
		let named = name !== undefined && REMEMBERED_TAB_KEYS.includes(name) ? name : undefined;

		return (
			<CodeTabs
				aria-label={named ? REMEMBERED_TABS[named].label : "Code examples"}
				syncKey={named}
				persist={named ? "cookie" : undefined}
				selected={
					named
						? rememberedTab(handle.context.get(RememberedTabsScope), named)
						: authored && String(authored.props.label)
				}
				tabs={tabs.map((tab) => ({
					label: String(tab.props.label),
					value: String(tab.props.label),
					children: tab.props.children as RemixNode,
				}))}
			/>
		);
	};
}

/**
 * One `code-tab`, which its strip reads rather than renders; outside a strip it draws its
 * content, so a stray tab loses its label rather than its code.
 */
export function CodeTabTag(handle: Handle<CodeTabsTag.TabProps>) {
	return () => handle.props.children;
}

namespace InstallCommandTag {
	export interface Props extends MarkdownProps {
		/** The command as authored, in npm's spelling. */
		command: string;
	}
}

/**
 * Draws the `install-command` tag as every package manager's spelling of the line, opened
 * on the manager the reader picked last. A line no other manager spells the same way, such
 * as a global install, prints as written.
 */
export function InstallCommandTag(handle: Handle<InstallCommandTag.Props>) {
	return () => {
		let { command } = handle.props;
		let parsed = parseInstallCommand(command);

		if (parsed === null) {
			return <CodeBlock code={command} language="sh" title={TERMINAL_TITLE} labels={CODE_LABELS} />;
		}

		return (
			<InstallCommand
				packages={parsed.packages}
				dev={parsed.dev}
				persist="cookie"
				selected={rememberedTab(handle.context.get(RememberedTabsScope), PACKAGE_MANAGER_KEY)}
				title={TERMINAL_TITLE}
				labels={CODE_LABELS}
				aria-label={REMEMBERED_TABS[PACKAGE_MANAGER_KEY].label}
			/>
		);
	};
}

/**
 * Draws a GitHub `> [!KIND]` alert as a callout. `IMPORTANT` reads as a note and `CAUTION`
 * as a danger, each keeping its own label, and an unknown kind draws as a note.
 */
export function AlertTag(handle: Handle<MarkdownProps>) {
	return () => {
		let { children, kind } = handle.props;
		let { kind: calloutKind, label } =
			(typeof kind === "string" ? ALERT_KINDS[kind] : undefined) ?? DEFAULT_ALERT;

		return (
			<Callout kind={calloutKind} label={label}>
				{children}
			</Callout>
		);
	};
}

namespace FilesTag {
	export interface Props extends MarkdownProps {
		/** What the layout is of, drawn above the tree. */
		title?: string;
	}

	export interface EntryProps extends MarkdownProps {
		name: string;
	}
}

/** Draws the `files` tag as a tree built from the `folder` and `file` tags inside it. */
export function FilesTag(handle: Handle<FilesTag.Props>) {
	return () => {
		let { children, title } = handle.props;

		return (
			<FileTree aria-label={title ?? "Project layout"} title={title} nodes={treeNodes(children)} />
		);
	};
}

/** One `folder`, which its tree reads rather than renders; it draws nothing on its own. */
export function FolderTag(_handle: Handle<FilesTag.EntryProps>) {
	return () => null;
}

/** One `file`, which its tree reads rather than renders; it draws nothing on its own. */
export function FileTag(_handle: Handle<FilesTag.EntryProps>) {
	return () => null;
}

/** The entries one level of `folder` and `file` tags wrote, a folder holding its own level. */
function treeNodes(children: unknown): FileTree.Node[] {
	return elementsOf(children).flatMap((element): FileTree.Node[] => {
		let name = String(element.props.name);
		if (element.type === FolderTag) return [{ name, children: treeNodes(element.props.children) }];
		if (element.type === FileTag) return [{ name }];
		return [];
	});
}

/**
 * The elements a tag's rendered children hold, in order. The whitespace between two tags
 * carries nothing a reader sees, so only elements are kept.
 */
function elementsOf(children: unknown): RemixElement[] {
	if (Array.isArray(children)) return children.flatMap((child: unknown) => elementsOf(child));
	if (typeof children === "object" && children !== null && "$rmx" in children) {
		return [children as RemixElement];
	}
	return [];
}
