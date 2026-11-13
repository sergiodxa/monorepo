/**
 * Live preview for `CodeView`: a TypeScript file from a parser's source with lines 12 to 16
 * cited, as an address with `?L=12-16` would ask, under a header with the file's facts and its
 * actions. Clicking a line number moves the citation once the page hydrates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { LinkButton } from "@sdxc/ui";
import { CodeView, codeStats, lineLink } from "@sdxc/ui/app/code-view";

/** The file the preview reads. */
export const SOURCE = `import type { Token } from "./tokens.js";

import { isIdentifierStart, isIdentifierPart } from "./chars.js";

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

/** Skips spaces, tabs and line breaks, returning the first offset past them. */
export function skipWhitespace(source: string, offset: number): number {
	let end = offset;
	while (end < source.length && /\\s/.test(source[end] ?? "")) end++;
	return end;
}
`;

/** Every string the view shows. */
export const CODE_VIEW_LABELS: CodeView.Labels = {
	lineMenu: "Line options",
	copyLine: "Copy line",
	copyPermalink: "Copy permalink",
	referenceInNewIssue: "Reference in new issue",
	copied: "Copied",
	group: "Code",
	permalinkKey: "Expand URL to its permalink",
	clearSelection: "Clear the selected lines",
};

/** The file's facts as its header prints them, such as "40 lines (34 loc) · 1.04 KB". */
export function fileMeta(source: string): string {
	let { lines, loc, bytes } = codeStats(source);
	return `${lines} lines (${loc} loc) · ${(bytes / 1024).toFixed(2)} KB`;
}

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `let path = "src/lexer/identifier.ts";
let selected = parseLineRange(url.searchParams.get("L"));
let { lines, loc, bytes } = codeStats(source);

<CodeView
	path={path}
	language="ts"
	code={source}
	selected={selected}
	permalink={\`/acme/delta/blob/4f2a9c1/\${path}\`}
	issueHref="/acme/delta/issues/new"
	labels={labels}
>
	<CodeView.Header meta={\`\${lines} lines (\${loc} loc) · \${formatBytes(bytes)}\`}>
		<LinkButton href={\`/acme/delta/raw/main/\${path}\`} variant="outline" size="sm">Raw</LinkButton>
		<LinkButton href={\`/acme/delta/blame/main/\${path}\`} variant="outline" size="sm">Blame</LinkButton>
	</CodeView.Header>
</CodeView>`;

/** The file's address in the preview, which returns the reader to this page. */
const BASE = "/examples/acme/delta/blob/main/src/lexer/identifier.ts";

/** What the preview registry reads: the source to show, and the file to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<CodeView
				id="preview-code-view"
				path="src/lexer/identifier.ts"
				language="ts"
				code={SOURCE}
				selected={{ start: 12, end: 16 }}
				lineHref={(line) => lineLink(line, BASE)}
				permalink="/examples/acme/delta/blob/4f2a9c1/src/lexer/identifier.ts"
				issueHref="/examples/acme/delta/issues/new"
				labels={CODE_VIEW_LABELS}
			>
				<CodeView.Header meta={fileMeta(SOURCE)}>
					<div mix={[hstack({ gap: 2 })]}>
						<LinkButton
							href="/examples/acme/delta/raw/main/src/lexer/identifier.ts"
							variant="outline"
							size="sm"
						>
							Raw
						</LinkButton>
						<LinkButton
							href="/examples/acme/delta/blame/main/src/lexer/identifier.ts"
							variant="outline"
							size="sm"
						>
							Blame
						</LinkButton>
					</div>
				</CodeView.Header>
			</CodeView>
		</div>
	),
};
