/**
 * Live preview for `LogViewer`: a CI job whose test step failed, so that step opens on its own
 * with its ANSI colours, folded install output and the error annotation, while the passing
 * steps stay closed. Search and line links work once the page hydrates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { LogViewer } from "@sdxc/ui/app/log-viewer";

/** The terminal's escape character, which starts every ANSI colour code. */
const ESC = "\u001b";

/** The source the page shows, with the job read the way an app reads it from its CI. */
const CODE = `<LogViewer
	steps={job.steps}
	lineHref={(step, n) => \`#step:\${step}:\${n}\`}
	timestamps={showTimes}
	timestampsHref={showTimes ? "?" : "?ts=1"}
	labels={{
		log: "Job log",
		states: { success: "Succeeded", failure: "Failed", running: "In progress", queued: "Queued", skipped: "Skipped", cancelled: "Cancelled" },
		search: "Search logs",
		matches: "{index} of {count}",
		noMatches: "No results",
		previousMatch: "Previous match",
		nextMatch: "Next match",
		showTimestamps: "Show timestamps",
		hideTimestamps: "Hide timestamps",
		jumpToLatest: "Jump to latest",
		refresh: "Refresh",
	}}
/>`;

/** Every string the viewer shows or announces. */
const LABELS: LogViewer.Labels = {
	log: "Job log",
	states: {
		success: "Succeeded",
		failure: "Failed",
		running: "In progress",
		queued: "Queued",
		skipped: "Skipped",
		cancelled: "Cancelled",
	},
	search: "Search logs",
	matches: "{index} of {count}",
	noMatches: "No results",
	previousMatch: "Previous match",
	nextMatch: "Next match",
	showTimestamps: "Show timestamps",
	hideTimestamps: "Hide timestamps",
	jumpToLatest: "Jump to latest",
	refresh: "Refresh",
};

/** Numbers a step's raw lines from 1, stamping each a little after the one before. */
function lines(start: string, texts: string[]): LogViewer.Step["lines"] {
	let at = Date.parse(start);
	return texts.map((text, index) => ({
		n: index + 1,
		text,
		ts: new Date(at + index * 137).toISOString(),
	}));
}

/** A test job on a pull request, failing on one assertion. */
function steps(): LogViewer.Step[] {
	return [
		{
			name: "Set up job",
			state: "success",
			duration: "2s",
			lines: lines("2026-11-13T09:00:00.000Z", [
				"Current runner version: '2.321.0'",
				"Operating System",
				"  Ubuntu 24.04.1 LTS",
				"Runner Image: ubuntu-24.04",
			]),
		},
		{
			name: "Install dependencies",
			state: "success",
			duration: "14s",
			lines: lines("2026-11-13T09:00:03.000Z", [
				"##[group]Run bun install --frozen-lockfile",
				"bun install v1.3.2",
				"Resolving dependencies",
				"Resolved, downloaded and extracted [412]",
				`${ESC}[32m+${ESC}[0m vitest@4.1.11`,
				`${ESC}[32m+${ESC}[0m typescript@6.0.3`,
				"412 packages installed [13.82s]",
				"##[endgroup]",
			]),
		},
		{
			name: "Run tests",
			state: "failure",
			duration: "41s",
			lines: lines("2026-11-13T09:00:18.000Z", [
				"##[command]bun run test --reporter=dot",
				`${ESC}[1m RUN ${ESC}[22m v4.1.11 /home/runner/work/delta/delta`,
				"",
				`${ESC}[32m ✓${ESC}[39m src/lexer/chars.test.ts ${ESC}[2m(18 tests)${ESC}[22m 6ms`,
				`${ESC}[32m ✓${ESC}[39m src/lexer/tokens.test.ts ${ESC}[2m(42 tests)${ESC}[22m 11ms`,
				`${ESC}[31m ✗${ESC}[39m src/lexer/identifier.test.ts ${ESC}[2m(9 tests | 1 failed)${ESC}[22m 9ms`,
				`${ESC}[31m   × reads an identifier that starts with a Unicode letter${ESC}[39m`,
				`${ESC}[32m ✓${ESC}[39m src/parser/expression.test.ts ${ESC}[2m(64 tests)${ESC}[22m 23ms`,
				"",
				`${ESC}[31m${ESC}[1m FAIL ${ESC}[22m${ESC}[39m src/lexer/identifier.test.ts > reads an identifier that starts with a Unicode letter`,
				`${ESC}[31mAssertionError: expected undefined to deeply equal { kind: 'identifier', value: 'ñandú' }${ESC}[39m`,
				`${ESC}[36m ❯ src/lexer/identifier.test.ts:${ESC}[2m27:41${ESC}[22m${ESC}[39m`,
				"",
				` Test Files  ${ESC}[1m${ESC}[31m1 failed${ESC}[39m${ESC}[22m | ${ESC}[1m${ESC}[32m3 passed${ESC}[39m${ESC}[22m (4)`,
				`      Tests  ${ESC}[1m${ESC}[31m1 failed${ESC}[39m${ESC}[22m | ${ESC}[1m${ESC}[32m132 passed${ESC}[39m${ESC}[22m (133)`,
				"##[error]Process completed with exit code 1.",
			]),
		},
		{
			name: "Upload coverage",
			state: "skipped",
			lines: [],
		},
		{
			name: "Complete job",
			state: "success",
			duration: "1s",
			lines: lines("2026-11-13T09:01:00.000Z", ["Cleaning up orphan processes"]),
		},
	];
}

/** What the preview registry reads: the source to show, and the log to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<LogViewer
				id="preview-log-viewer"
				steps={steps()}
				lineHref={(step, n) => `#step:${step}:${n}`}
				timestampsHref="/examples/acme/delta/actions/runs/8812/job/2?ts=1"
				labels={LABELS}
			/>
		</div>
	),
};
