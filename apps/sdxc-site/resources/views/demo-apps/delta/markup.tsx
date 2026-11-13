/**
 * Draws the bodies of Delta's issues, pull requests and comments: paragraphs whose `code`,
 * `#number` and `@handle` read as such, lists, and citations of real lines, each quoted from
 * the deployed file with a link that paints the range, or marked Outdated once it moved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Hunk } from "@sdxc/diff";
import type { Handle, RemixNode } from "remix/component";

import { FileCodeIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Badge } from "@sdxc/ui";
import { Diff } from "@sdxc/ui/app/diff";

import type { DeltaAnchor } from "~/app/services/delta/source";

import { languageOf } from "~/app/services/delta/source";

import type { Block } from "./seed/issues";

import { commitHref, fileHref, shortSha } from "./data";
import { COPY, DIFF_FILE_LABELS } from "./labels";

/** What a body needs to cite code and link references. */
export interface CiteContext {
	/** Every anchor as the build resolved it. */
	anchors: Readonly<Record<string, DeltaAnchor>>;
	/** Each file's lines at the deployed commit, by path. */
	lines: (path: string) => readonly string[] | undefined;
	/** The address a `#number` links to, or `undefined` for a number with no page. */
	refHref: (number: number) => string | undefined;
}

/** A citation's link: the file with its lines painted, scrolled to the first one. */
export function citeHref(path: string, start: number, end: number): string {
	let range = start === end ? `${start}` : `${start}-${end}`;
	return `${fileHref(path, { query: `L=${range}` })}#L${start}`;
}

/** Lines as one hunk of unchanged context, so they draw as a small code table. */
function contextHunk(lines: readonly string[], start: number): Hunk {
	return {
		oldStart: start,
		oldLines: lines.length,
		newStart: start,
		newLines: lines.length,
		lines: lines.map((text, index) => ({
			kind: "context",
			old: start + index,
			new: start + index,
			text,
		})),
	};
}

namespace Citation {
	export interface Props {
		id: string;
		context: CiteContext;
	}
}

/**
 * Renders one citation as a quoted block: the path and its range, linked to the file with the
 * range painted, over the lines themselves. An anchor whose lines changed shows the code it was
 * written against, marked Outdated and linked to that commit.
 */
export function Citation(handle: Handle<Citation.Props>) {
	return () => {
		let { context, id } = handle.props;
		let anchor = context.anchors[id];
		if (anchor === undefined) return null;
		let current = anchor.status === "current";
		let start = anchor.start ?? 1;
		let lines =
			anchor.status === "current"
				? (context.lines(anchor.path) ?? []).slice(anchor.start - 1, anchor.end)
				: (anchor.excerpt ?? []);
		let sha = anchor.status === "outdated" ? anchor.sha : undefined;
		let end = start + Math.max(lines.length, 1) - 1;
		let range = start === end ? COPY.cite.line(start) : COPY.cite.lines(start, end);
		let link = current ? citeHref(anchor.path, start, end) : undefined;
		return (
			<figure
				data-slot="delta-citation"
				data-anchor={id}
				data-status={anchor.status}
				mix={[
					raw({
						margin: 0,
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						overflow: "clip",
						backgroundColor: "var(--ui-bg, Canvas)",
						"& [data-slot='diff-hunks'] tr[data-hunk] > td": { display: "none !important" },
					}),
				]}
			>
				<figcaption
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							gap: "0.375rem 0.5rem",
							padding: "0.5rem 0.75rem",
							borderBlockEnd: lines.length > 0 ? "1px solid var(--ui-neutral-border)" : "0",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<FileCodeIcon size={14} aria-hidden="true" />
					{link === undefined ? (
						<span mix={[pathText()]}>{anchor.path}</span>
					) : (
						<a
							href={link}
							data-rmx-prefetch="intent"
							mix={[
								pathText(),
								raw({ textDecoration: "none", "&:hover": { textDecoration: "underline" } }),
							]}
						>
							{anchor.path}
						</a>
					)}
					<span>{range}</span>
					{current ? (
						<span>{COPY.cite.onMain}</span>
					) : (
						<>
							<Badge color="warning" variant="outline">
								{COPY.cite.outdated}
							</Badge>
							{sha === undefined ? null : (
								<a href={commitHref(sha)} mix={[raw({ fontFamily: "var(--ui-font-mono)" })]}>
									{COPY.cite.at(shortSha(sha))}
								</a>
							)}
						</>
					)}
				</figcaption>
				{lines.length === 0 ? null : (
					<Diff.Hunks
						path={anchor.path}
						hunks={[contextHunk(lines, start)]}
						language={languageOf(anchor.path)}
						anchored={false}
						labels={DIFF_FILE_LABELS}
					/>
				)}
			</figure>
		);
	};
}

/** A path in the citation's caption: monospace, emphasised. */
function pathText() {
	return raw({
		fontFamily: "var(--ui-font-mono)",
		fontWeight: 600,
		color: "var(--ui-neutral-fg-emphasis)",
		overflowWrap: "anywhere",
	});
}

/** One run of a paragraph: plain text, inline code, a reference or a mention. */
type Run = { kind: "text" | "code" | "ref" | "mention"; value: string };

/** Splits a paragraph into its runs. */
export function runsOf(text: string): Run[] {
	let runs: Run[] = [];
	let pattern = /`([^`]+)`|#(\d+)\b|@([a-z][\w-]*)/gi;
	let last = 0;
	for (let match of text.matchAll(pattern)) {
		let index = match.index ?? 0;
		if (index > last) runs.push({ kind: "text", value: text.slice(last, index) });
		if (match[1] !== undefined) runs.push({ kind: "code", value: match[1] });
		else if (match[2] !== undefined) runs.push({ kind: "ref", value: match[2] });
		else runs.push({ kind: "mention", value: match[3] ?? "" });
		last = index + match[0].length;
	}
	if (last < text.length) runs.push({ kind: "text", value: text.slice(last) });
	return runs;
}

/** A paragraph's runs as nodes. */
function inline(text: string, context: CiteContext): RemixNode[] {
	return runsOf(text).map((run) => {
		if (run.kind === "code") return <code mix={[inlineCode()]}>{run.value}</code>;
		if (run.kind === "ref") {
			let href = context.refHref(Number(run.value));
			return href === undefined ? (
				`#${run.value}`
			) : (
				<a href={href} data-rmx-prefetch="intent">{`#${run.value}`}</a>
			);
		}
		if (run.kind === "mention") {
			return <strong mix={[raw({ fontWeight: 600 })]}>{`@${run.value}`}</strong>;
		}
		return run.value;
	});
}

/** Inline code: monospace on a tint, the way rendered Markdown sets it. */
function inlineCode() {
	return raw({
		fontFamily: "var(--ui-font-mono)",
		fontSize: "0.8125em",
		padding: "0.1em 0.35em",
		borderRadius: "var(--ui-radius-md)",
		backgroundColor: "var(--ui-neutral-bg-tint)",
	});
}

namespace Body {
	export interface Props {
		blocks: readonly Block[];
		context: CiteContext;
	}
}

/** Renders a body's blocks as rendered Markdown would: paragraphs, lists and citations. */
export function Body(handle: Handle<Body.Props>) {
	return () => {
		let { blocks, context } = handle.props;
		return (
			<div
				data-slot="delta-body"
				mix={[
					raw({
						display: "grid",
						gap: "0.75rem",
						fontSize: "0.875rem",
						lineHeight: 1.6,
						color: "var(--ui-neutral-fg)",
						overflowWrap: "anywhere",
						"& p, & ul": { margin: 0 },
						"& ul": { paddingInlineStart: "1.25rem", listStyle: "disc" },
						"& a": { color: "var(--ui-brand-fg, inherit)" },
					}),
				]}
			>
				{blocks.map((block) => {
					if (typeof block === "string") return <p>{inline(block, context)}</p>;
					if ("list" in block) {
						return (
							<ul>
								{block.list.map((item) => (
									<li>{inline(item, context)}</li>
								))}
							</ul>
						);
					}
					return <Citation id={block.cite} context={context} />;
				})}
			</div>
		);
	};
}
