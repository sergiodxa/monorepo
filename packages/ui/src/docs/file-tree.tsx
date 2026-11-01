/**
 * A project layout drawn as a tree: directories are native `<details>` that fold without
 * JavaScript, files carry an icon for their type, the file a page is about stands out as
 * an accent pill, and short comments explain an entry in muted text beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import {
	EllipsisIcon,
	FileBracesIcon,
	FileCodeIcon,
	FileCogIcon,
	FileIcon,
	FileImageIcon,
	FileLockIcon,
	FileTerminalIcon,
	FileTextIcon,
	FileTypeIcon,
	FolderIcon,
	FolderOpenIcon,
} from "@sdxc/icons";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, listStyle, mergeMix, raw } from "@sdxc/u/general";
import { hidden, hstack, inlineFlex, shrink, vstack } from "@sdxc/u/layout";
import { overflowX } from "@sdxc/u/overflow";
import { m, minIs, mis, p, pi, pis } from "@sdxc/u/size";
import { focusVisible, when } from "@sdxc/u/state";
import { font, nowrap, text, weight } from "@sdxc/u/typography";

/** Placeholder entry standing for "more files here" that a tree leaves out. */
const MORE = "…";

/** Matches an icon inside the summary row of an open directory, and only that directory's. */
const OPEN_ROW = ":is(details[open] > summary) &";

/**
 * Prop types for {@link FileTree}.
 */
export namespace FileTree {
	/**
	 * One file or directory. An entry with `children`, even an empty array, is a directory;
	 * one without is a file.
	 */
	export interface Node {
		name: string;
		/** A few muted words after the name saying what the entry is for. */
		comment?: string;
		/** Marks the file or directory the surrounding page is about, drawn as an accent pill. */
		highlight?: boolean;
		/** A directory's entries; the `"…"` string stands for files the tree leaves out. */
		children?: Entry[];
		/** Renders a directory folded; directories render open by default. */
		collapsed?: boolean;
	}

	/** A file, a directory, or the `"…"` placeholder for entries left out. */
	export type Entry = Node | typeof MORE;

	/** Native `<div>` attributes plus the tree's entries and its accessible name. */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		nodes: Entry[];
		/** Names the tree for assistive technology, such as "Project layout". */
		"aria-label": string;
		/** A caption drawn above the tree, such as the project or directory the tree shows. */
		title?: string;
		/** Accessible text for the `"…"` placeholder, such as "More files". */
		moreLabel?: string;
	}
}

/** Icons for file extensions whose type a reader recognises at a glance. */
const ICON_BY_EXTENSION: Record<string, typeof FileIcon> = {
	ts: FileCodeIcon,
	tsx: FileCodeIcon,
	js: FileCodeIcon,
	jsx: FileCodeIcon,
	mjs: FileCodeIcon,
	cjs: FileCodeIcon,
	mts: FileCodeIcon,
	cts: FileCodeIcon,
	html: FileCodeIcon,
	sql: FileCodeIcon,
	json: FileBracesIcon,
	jsonc: FileBracesIcon,
	md: FileTextIcon,
	mdx: FileTextIcon,
	txt: FileTextIcon,
	css: FileTypeIcon,
	png: FileImageIcon,
	jpg: FileImageIcon,
	jpeg: FileImageIcon,
	gif: FileImageIcon,
	svg: FileImageIcon,
	webp: FileImageIcon,
	avif: FileImageIcon,
	ico: FileImageIcon,
	sh: FileTerminalIcon,
	toml: FileCogIcon,
	yaml: FileCogIcon,
	yml: FileCogIcon,
	env: FileCogIcon,
	lock: FileLockIcon,
	lockb: FileLockIcon,
};

/**
 * Picks a file's icon from its extension, treating a dotfile's name as its extension
 * (`.env`), and falls back to a plain file icon for anything unrecognised.
 *
 * @param name File name as shown in the tree.
 */
function iconFor(name: string): typeof FileIcon {
	let dot = name.lastIndexOf(".");
	if (dot === -1) return FileIcon;
	return ICON_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? FileIcon;
}

/**
 * Renders the tree's card: an optional caption, then the top level of entries in a box
 * that scrolls sideways on its own when a deep path is wider than the page.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the tree's markup.
 * @example
 * <FileTree aria-label="Project layout" nodes={[
 * 	{ name: "app", children: [{ name: "routes.ts", highlight: true, comment: "every URL" }, "…"] },
 * 	{ name: "package.json" },
 * ]} />
 */
export function FileTree(handle: Handle<FileTree.Props>) {
	return () => {
		let { "aria-label": label, mix, moreLabel, nodes, title, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="file-tree"
				mix={mergeMix(
					[
						vstack({ gap: 2, align: "stretch" }),
						minIs(0),
						p(3, 4),
						rounded("lg"),
						bg("neutral.tint"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						overflowX("auto"),
						font("mono"),
						text("sm"),
					],
					mix,
				)}
			>
				{title ? (
					<p data-slot="file-tree-title" mix={[m(0), fg("neutral.muted")]}>
						{title}
					</p>
				) : null}
				<EntryList aria-label={label} entries={nodes} moreLabel={moreLabel} />
			</div>
		);
	};
}

namespace EntryList {
	export interface Props {
		entries: FileTree.Entry[];
		moreLabel?: string;
		"aria-label"?: string;
	}
}

/**
 * One level of the tree as a list; the list keeps the entries' count and position
 * available to screen readers.
 */
function EntryList(handle: Handle<EntryList.Props>) {
	return () => {
		let { "aria-label": label, entries, moreLabel } = handle.props;

		return (
			<ul
				aria-label={label}
				data-slot="file-tree-list"
				data-not-typeset=""
				mix={[listStyle("none"), m(0), p(0), vstack({ gap: 0.5, align: "start" })]}
			>
				{entries.map((entry, index) => (
					<Entry
						key={typeof entry === "string" ? `more-${index}` : entry.name}
						entry={entry}
						moreLabel={moreLabel}
					/>
				))}
			</ul>
		);
	};
}

namespace Entry {
	export interface Props {
		entry: FileTree.Entry;
		moreLabel?: string;
	}
}

/**
 * One entry: the `"…"` placeholder, a directory whose row toggles its `<details>`, or a
 * file row. A directory's icon swaps between closed and open folders with its state.
 */
function Entry(handle: Handle<Entry.Props>) {
	return () => {
		let { entry, moreLabel } = handle.props;

		if (entry === MORE) {
			return (
				<li data-slot="file-tree-more" aria-label={moreLabel} mix={[m(0), fg("neutral.muted")]}>
					<span mix={[hstack({ gap: 2, align: "center" })]}>
						<EllipsisIcon size={16} aria-hidden="true" />
					</span>
				</li>
			);
		}

		if (entry.children === undefined) {
			let Glyph = iconFor(entry.name);

			return (
				<li data-slot="file-tree-file" mix={[m(0)]}>
					<Row node={entry}>
						<Glyph size={16} aria-hidden="true" />
					</Row>
				</li>
			);
		}

		return (
			<li data-slot="file-tree-directory" mix={[m(0), minIs(0)]}>
				<details open={!entry.collapsed}>
					<summary
						mix={[
							listStyle("none"),
							cursor("pointer"),
							rounded("sm"),
							when("&::-webkit-details-marker", raw({ display: "none" })),
							focusVisible(
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
							),
						]}
					>
						<Row node={entry}>
							<span
								data-slot="file-tree-folder-closed"
								mix={[inlineFlex(), when(OPEN_ROW, hidden())]}
							>
								<FolderIcon size={16} aria-hidden="true" />
							</span>
							<span
								data-slot="file-tree-folder-open"
								mix={[hidden(), when(OPEN_ROW, inlineFlex())]}
							>
								<FolderOpenIcon size={16} aria-hidden="true" />
							</span>
						</Row>
					</summary>
					<div
						mix={[
							mis(2),
							pis(4),
							raw({ paddingBlockStart: "0.125rem" }),
							borderEdge("inline-start", { color: "neutral.border", width: 1, style: "solid" }),
						]}
					>
						<EntryList entries={entry.children} moreLabel={moreLabel} />
					</div>
				</details>
			</li>
		);
	};
}

namespace Row {
	export interface Props {
		node: FileTree.Node;
		/** The entry's icon. */
		children: RemixNode;
	}
}

/** Draws one entry's icon, name (as a pill when highlighted) and comment on one line. */
function Row(handle: Handle<Row.Props>) {
	return () => {
		let { children, node } = handle.props;
		let isDirectory = node.children !== undefined;

		return (
			<span
				data-slot="file-tree-row"
				mix={[inlineFlex(), hstack({ gap: 2, align: "center" }), nowrap()]}
			>
				<span
					data-slot="file-tree-icon"
					mix={[inlineFlex(), shrink(0), fg(isDirectory ? "brand" : "neutral.muted")]}
				>
					{children}
				</span>
				<span
					data-slot="file-tree-name"
					data-highlight={node.highlight ? "" : undefined}
					mix={
						node.highlight
							? [
									pi(1.5),
									rounded("full"),
									bg("brand.tint"),
									fg("brand.emphasis"),
									weight("semibold"),
								]
							: [fg("neutral.emphasis")]
					}
				>
					{node.name}
				</span>
				{node.comment ? (
					<span data-slot="file-tree-comment" mix={[fg("neutral.muted")]}>
						{node.comment}
					</span>
				) : null}
			</span>
		);
	};
}
