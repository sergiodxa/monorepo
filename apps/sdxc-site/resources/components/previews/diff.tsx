/**
 * Live preview for `Diff`: a pull request's files, a lexer that moves to code points and the
 * Unicode tables it reads, with a review thread under the changed line. Hunks come from
 * `diffLines`, so the word marks are the ones `@sdxc/diff` finds; later examples reuse them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Hunk } from "@sdxc/diff";
import type { DiffSide } from "@sdxc/ui/app/diff";
import type { Handle } from "remix/component";

import { diffLines } from "@sdxc/diff";
import { EllipsisIcon, SquareCheckIcon, SquareIcon } from "@sdxc/icons";
import { hstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { Avatar, Button } from "@sdxc/ui";
import { Diff } from "@sdxc/ui/app/diff";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";
import { ReviewThread } from "@sdxc/ui/app/review-thread";

/** The pull request every example belongs to. */
export const PULL = "/examples/acme/delta/pull/412";

/** `src/lexer/identifier.ts` on `main`, reading UTF-16 code units. */
export const IDENTIFIER_BEFORE = `import type { Token } from "./tokens.js";

import { isIdentifierPart, isIdentifierStart } from "./chars.js";

/** Reads one identifier starting at \`offset\`, or nothing when none starts there. */
export function readIdentifier(source: string, offset: number): Token | undefined {
	if (!isIdentifierStart(source.charCodeAt(offset))) return undefined;

	let end = offset + 1;
	while (end < source.length && isIdentifierPart(source.charCodeAt(end))) end++;

	return {
		kind: "identifier",
		value: source.slice(offset, end),
		span: { start: offset, end },
	};
}
`;

/** The same file on the branch, reading whole code points so `𝑥` starts an identifier. */
export const IDENTIFIER_AFTER = `import type { Token } from "./tokens.js";

import { isIdentifierPart, isIdentifierStart } from "./unicode.js";

/** Reads one identifier starting at \`offset\`, or nothing when none starts there. */
export function readIdentifier(source: string, offset: number): Token | undefined {
	let first = source.codePointAt(offset);
	if (first === undefined || !isIdentifierStart(first)) return undefined;

	let end = offset + (first > 0xffff ? 2 : 1);
	while (end < source.length) {
		let code = source.codePointAt(end) ?? 0;
		if (!isIdentifierPart(code)) break;
		end += code > 0xffff ? 2 : 1;
	}

	return {
		kind: "identifier",
		value: source.slice(offset, end),
		span: { start: offset, end },
	};
}
`;

/** `src/lexer/unicode.ts`, added by the pull request. */
const UNICODE_SOURCE = `/**
 * Identifier classes from Unicode's ID_Start and ID_Continue, which ECMAScript names follow,
 * so \`ñandú\` and \`𝑥\` read as identifiers.
 */
const ID_START = /\\p{ID_Start}/u;
const ID_CONTINUE = /\\p{ID_Continue}/u;

/** Whether \`code\` may begin an identifier: a letter, \`$\` or \`_\`. */
export function isIdentifierStart(code: number): boolean {
	return code === 0x24 || code === 0x5f || ID_START.test(String.fromCodePoint(code));
}

/** Whether \`code\` may continue one: anything that starts one, a digit, a mark, ZWNJ or ZWJ. */
export function isIdentifierPart(code: number): boolean {
	if (code === 0x200c || code === 0x200d) return true;
	return isIdentifierStart(code) || ID_CONTINUE.test(String.fromCodePoint(code));
}
`;

/** `src/lexer/index.ts` before and after it re-exports the new tables. */
const INDEX_BEFORE = `export { readIdentifier } from "./identifier.js";
export { readNumber } from "./number.js";
export { readString } from "./string.js";
export { isIdentifierPart, isIdentifierStart } from "./chars.js";
`;

/** The barrel on the branch. */
const INDEX_AFTER = `export { readIdentifier } from "./identifier.js";
export { readNumber } from "./number.js";
export { readString } from "./string.js";
export { isIdentifierPart, isIdentifierStart } from "./unicode.js";
`;

/** The barrel's one-word change, computed per request so the module loads without work. */
export function indexHunks(): Hunk[] {
	return diffLines(INDEX_BEFORE, INDEX_AFTER).hunks;
}

/** The hidden column headers every table announces. */
export const COLUMN_LABELS: Diff.ColumnLabels = {
	oldNumber: "Original file line number",
	newNumber: "Diff line number",
	oldText: "Original file line",
	change: "Diff line change",
};

/** Every string a file card shows or announces. */
export const FILE_LABELS: Diff.FileLabels = {
	columns: COLUMN_LABELS,
	expandContext: "Expand context",
	addComment: (side, line) => `Comment on line ${side}${line}`,
	copyPath: "Copy file path",
	statuses: {
		added: "Added",
		modified: "Modified",
		deleted: "Deleted",
		renamed: "Renamed",
		copied: "Copied",
	},
	changes: (additions, deletions) => `${additions} additions, ${deletions} deletions`,
	binary: "Binary file not shown.",
	tooLarge: "Large diff not shown.",
	largeDiff: "Large diffs are not rendered by default.",
	empty: "File renamed without changes.",
};

/** Every string the toolbar shows. */
export const TOOLBAR_LABELS: Diff.ToolbarLabels = {
	view: "Diff view",
	unified: "Unified",
	split: "Split",
	filesViewed: "files viewed",
};

/** Every string a review thread shows or announces. */
export const THREAD_LABELS: ReviewThread.Labels = {
	reply: "Reply",
	replyPlaceholder: "Reply…",
	resolve: "Resolve conversation",
	unresolve: "Unresolve conversation",
	outdated: "Outdated",
	pending: "Pending",
	suggestion: "Suggested change",
	applySuggestion: "Apply suggestion",
	columns: COLUMN_LABELS,
};

/** Where a line's `+` goes without script: the files page with that line's comment form open. */
export function commentHref(path: string, side: DiffSide, line: number): string {
	return `${PULL}/files?comment=${encodeURIComponent(path)}:${side}${line}`;
}

/** Where a hunk's expand link goes, keyed by the hunk's position in its file. */
export function expandHref(path: string): (hunk: Hunk, index: number) => string {
	return (_, index) => `${PULL}/files/expand?path=${encodeURIComponent(path)}&hunk=${index}`;
}

/** Props for {@link Person}. */
interface PersonProps {
	initials: string;
}

/** A reviewer's small avatar, drawn from their initials. */
export function Person(handle: Handle<PersonProps>) {
	return () => (
		<Avatar size="sm">
			<Avatar.Fallback>{handle.props.initials}</Avatar.Fallback>
		</Avatar>
	);
}

/** The `⋯` button a file card or a comment ends its header with. */
export function MoreMenu() {
	return () => (
		<Button variant="ghost" size="sm" aria-label="More actions">
			<EllipsisIcon aria-hidden="true" />
		</Button>
	);
}

/** Props for {@link ViewedToggle}. */
interface ViewedToggleProps {
	path: string;
	viewed: boolean;
}

/** The "Viewed" checkbox, which posts the mark and flips before the answer arrives. */
export function ViewedToggle(handle: Handle<ViewedToggleProps>) {
	return () => (
		<OptimisticToggle
			action={`${PULL}/files/viewed`}
			name="viewed"
			pressed={handle.props.viewed}
			fields={{ path: handle.props.path }}
			labels={{ label: "Viewed", failed: "Failed" }}
			pressedContent={
				<span mix={[hstack({ gap: 1.5, align: "center" })]}>
					<SquareCheckIcon size={14} aria-hidden="true" />
					Viewed
				</span>
			}
			unpressedContent={
				<span mix={[hstack({ gap: 1.5, align: "center" })]}>
					<SquareIcon size={14} aria-hidden="true" />
					Viewed
				</span>
			}
		/>
	);
}

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `import { diffLines } from "@sdxc/diff";

let { hunks } = diffLines(before, after);

<Diff labels={{ copied: "Copied" }}>
	<Diff.Toolbar
		view="unified"
		unifiedHref="/acme/delta/pull/412/files?diff=unified"
		splitHref="/acme/delta/pull/412/files?diff=split"
		viewed={0}
		total={2}
		labels={toolbarLabels}
	/>
	<Diff.File
		path="src/lexer/identifier.ts"
		status="modified"
		additions={9}
		deletions={4}
		hunks={hunks}
		language="ts"
		commentHref={(path, side, line) => \`/acme/delta/pull/412/files?comment=\${path}:\${side}\${line}\`}
		threads={{ R10: <ReviewThread comments={comments} replyAction={replyAction} resolveAction={resolveAction} labels={threadLabels} /> }}
		menu={<FileMenu />}
		viewedControl={<OptimisticToggle action="/acme/delta/pull/412/files/viewed" name="viewed" pressed={false} … />}
		labels={fileLabels}
	/>
	<Diff.File path="src/lexer/unicode.ts" status="added" additions={17} deletions={0} hunks={added} language="ts" labels={fileLabels} />
</Diff>`;

/** Ana's question on the new length check, with the author's answer under it. */
export const THREAD_COMMENTS: ReviewThread.Comment[] = [
	{
		id: "discussion_r1841",
		avatar: <Person initials="AS" />,
		author: "ana",
		action: "commented",
		time: "yesterday",
		menu: <MoreMenu />,
		body: (
			<p mix={[m(0)]}>
				The same <code>&gt; 0xffff ? 2 : 1</code> check shows up again on line 14. Worth a{" "}
				<code>codePointLength()</code> helper?
			</p>
		),
	},
	{
		id: "discussion_r1847",
		avatar: <Person initials="SX" />,
		author: "sergio",
		action: "commented",
		time: "2 hours ago",
		menu: <MoreMenu />,
		body: <p mix={[m(0)]}>Agreed, the string lexer needs it too. I'll add it to unicode.ts.</p>,
	},
];

/** The thread drawn under line 10 of the new side. */
function LineThread() {
	return () => (
		<ReviewThread
			id="preview-diff-thread"
			comments={THREAD_COMMENTS}
			replyAction={`${PULL}/threads/1841/replies`}
			resolveAction={`${PULL}/threads/1841/resolve`}
			labels={THREAD_LABELS}
		/>
	);
}

/** What the preview registry reads: the source to show, and the files to draw. */
export default {
	code: CODE,
	render: () => {
		let identifier = diffLines(IDENTIFIER_BEFORE, IDENTIFIER_AFTER);
		let unicode = diffLines("", UNICODE_SOURCE);
		return (
			<div mix={[is("full")]}>
				<Diff labels={{ copied: "Copied" }}>
					<Diff.Toolbar
						view="unified"
						unifiedHref={`${PULL}/files?diff=unified`}
						splitHref={`${PULL}/files?diff=split`}
						viewed={0}
						total={2}
						labels={TOOLBAR_LABELS}
					/>
					<Diff.File
						id="preview-diff-identifier"
						path="src/lexer/identifier.ts"
						status="modified"
						additions={identifier.additions}
						deletions={identifier.deletions}
						hunks={identifier.hunks}
						language="ts"
						commentHref={commentHref}
						expandHref={expandHref("src/lexer/identifier.ts")}
						threads={{ R10: <LineThread /> }}
						menu={<MoreMenu />}
						viewedControl={<ViewedToggle path="src/lexer/identifier.ts" viewed={false} />}
						labels={FILE_LABELS}
					/>
					<Diff.File
						id="preview-diff-unicode"
						path="src/lexer/unicode.ts"
						status="added"
						additions={unicode.additions}
						deletions={unicode.deletions}
						hunks={unicode.hunks}
						language="ts"
						commentHref={commentHref}
						menu={<MoreMenu />}
						viewedControl={<ViewedToggle path="src/lexer/unicode.ts" viewed={false} />}
						labels={FILE_LABELS}
					/>
				</Diff>
			</div>
		);
	},
};
