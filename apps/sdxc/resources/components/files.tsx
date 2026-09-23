/**
 * The `files`, `folder` and `file` tags: a directory layout drawn as a bordered card,
 * one icon per row and a guide line down each level of nesting.
 *
 * The structure is written as tags rather than inside a fence because it is data: a
 * reader gets icons and alignment, and a narrow screen keeps the tree readable instead
 * of wrapping pre-formatted lines mid-path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { FileIcon, FolderIcon } from "@sdxc/icons";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { hstack, inlineFlex, vstack } from "@sdxc/u/layout";
import { m, mis, p, pis } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text } from "@sdxc/u/typography";

import type { MarkdownProps } from "~/resources/components/markdown-props";

/** How far one level of nesting is pushed in, which is also where its guide line sits. */
const INDENT = 4;

namespace Files {
	export interface TreeProps extends MarkdownProps {
		/** What the layout is of, drawn above the tree where a card names its subject. */
		title?: string;
	}

	export interface EntryProps extends MarkdownProps {
		name: string;
	}
}

/**
 * Renders the card and the top level of the tree inside it. The list rules are stated
 * here, on the one element that contains every level, because the prose containers a
 * guide renders inside give an ordinary list its markers and its rhythm — both of
 * which a tree supplies for itself, through icons and a guide line.
 */
export default function Files(handle: Handle<Files.TreeProps>) {
	return () => {
		let { children, title } = handle.props;

		return (
			<div
				mix={[
					vstack({ gap: 2 }),
					p(4),
					rounded("lg"),
					bg("neutral.bg-tint"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
					font("mono"),
					text("sm"),
					when("& ul", [listStyle("none"), m(0), p(0)]),
					when("& li", [m(0), p(0)]),
					when("& li > * + *", m(0)),
				]}
			>
				{title ? <p mix={[m(0), fg("neutral")]}>{title}</p> : null}
				<FileList>{children}</FileList>
			</div>
		);
	};
}

/** Renders one folder: its own row, then the rows belonging to it. */
export function Folder(handle: Handle<Files.EntryProps>) {
	return () => {
		let { children, name } = handle.props;

		return (
			<li mix={[vstack({ gap: 1 })]}>
				<Row name={name} kind="folder" />
				<div
					mix={[
						pis(INDENT),
						mis(2),
						borderEdge("inline-start", { color: "neutral.border", width: 1, style: "solid" }),
					]}
				>
					<FileList>{children}</FileList>
				</div>
			</li>
		);
	};
}

/** Renders one file. */
export function File(handle: Handle<Files.EntryProps>) {
	return () => (
		<li>
			<Row name={handle.props.name} kind="file" />
		</li>
	);
}

namespace Row {
	export interface Props {
		name: string;
		/** Which glyph the row takes, and therefore what the reader reads it as. */
		kind: "folder" | "file";
	}
}

/** Draws one entry's glyph and name. */
function Row(handle: Handle<Row.Props>) {
	return () => {
		let { kind, name } = handle.props;
		let Glyph = kind === "folder" ? FolderIcon : FileIcon;

		return (
			<span mix={[hstack({ gap: 2, align: "center" })]}>
				<span mix={[inlineFlex(), fg(kind === "folder" ? "brand" : "neutral")]}>
					<Glyph size={16} />
				</span>
				<span mix={[fg("neutral.emphasis")]}>{name}</span>
			</span>
		);
	};
}

/** The column the entries of one level lay themselves into. */
function FileList(handle: Handle<MarkdownProps>) {
	return () => <ul mix={[vstack({ gap: 1 })]}>{handle.props.children}</ul>;
}
