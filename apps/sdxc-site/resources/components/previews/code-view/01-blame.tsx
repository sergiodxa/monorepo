/**
 * Live example for `CodeView` with blame: each hunk draws the commit that last touched it and
 * how long ago, its age shaded on the scale the header's legend explains.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { CodeView } from "@sdxc/ui/app/code-view";

import { CODE_VIEW_LABELS, fileMeta, SOURCE } from "~/resources/components/previews/code-view";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<CodeView path="src/lexer/identifier.ts" language="ts" code={source} blame={hunks} labels={labels}>
	<CodeView.Header meta={meta}>
		<CodeView.AgeLegend labels={{ older: "Older", newer: "Newer" }} />
	</CodeView.Header>
</CodeView>`;

/** The moment ages count from, so the example reads the same on every visit. */
const NOW = "2026-11-13T12:00:00Z";

/** A commit in the file's history, linked to its page in the preview. */
function commit(sha: string, subject: string, author: string, date: string): CodeView.BlameCommit {
	return { sha, subject, author, date, href: `/examples/acme/delta/commit/${sha}` };
}

/** Who last touched each run of lines. */
const HUNKS: CodeView.BlameHunk[] = [
	{
		start: 1,
		end: 3,
		commit: commit("9e1b04d", "Split chars out of the lexer", "ana", "2025-02-11T09:12:00Z"),
	},
	{
		start: 4,
		end: 11,
		commit: commit(
			"4f2a9c1",
			"Read identifiers with Unicode starts",
			"sergio",
			"2026-10-30T16:40:00Z",
		),
	},
	{
		start: 12,
		end: 17,
		commit: commit("b77e3a0", "Give every token a span", "mei", "2026-06-04T11:05:00Z"),
	},
	{
		start: 18,
		end: 24,
		commit: commit("1c09d52", "Add skipWhitespace for the parser", "ana", "2026-11-10T08:22:00Z"),
	},
];

/** What the preview registry reads: the title, the source to show, and the file to draw. */
export default {
	title: "With blame",
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<CodeView
				id="preview-code-view-blame"
				path="src/lexer/identifier.ts"
				language="ts"
				code={SOURCE}
				blame={HUNKS}
				now={NOW}
				locale="en"
				lineHref={(line) =>
					`/examples/acme/delta/blame/main/src/lexer/identifier.ts?L=${line}#L${line}`
				}
				labels={CODE_VIEW_LABELS}
			>
				<CodeView.Header meta={fileMeta(SOURCE)}>
					<CodeView.AgeLegend labels={{ older: "Older", newer: "Newer" }} />
				</CodeView.Header>
			</CodeView>
		</div>
	),
};
