/**
 * Live example for `CheckRuns` once every check passed: twenty-four green runs read as one
 * closed line, and opening it lists them all with their durations.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { CheckRuns } from "@sdxc/ui/app/check-runs";

import { CHECK_RUN_LABELS, jobHref } from "~/resources/components/previews/check-runs";

/** The source the page shows, with the run list built the way an app reads it from its CI. */
const CODE = `<CheckRuns runs={runs} locale="en" labels={labels} />`;

/** The jobs of a test matrix, each one a run. */
const JOBS = [
	"lint",
	"typecheck",
	"build",
	"docs",
	...["ubuntu", "macos", "windows"].flatMap((os) =>
		["18", "20", "22", "24"].map((node) => `test (${os}-latest, node ${node})`),
	),
	...["chromium", "firefox", "webkit"].map((browser) => `e2e (${browser})`),
	"bundle size",
	"license check",
	"changeset",
	"CodeQL",
	"preview deploy",
];

/** Every job passed, with a duration that looks like the job it timed. */
const RUNS: CheckRuns.Run[] = JOBS.map((name, index) => ({
	name,
	workflow: name === "CodeQL" ? "Security / pull_request" : "CI / pull_request",
	state: "success",
	duration: `${1 + (index % 4)}m ${String((index * 17) % 60).padStart(2, "0")}s`,
	href: jobHref(8831, index + 1),
}));

/** What the preview registry reads: the title, the source to show, and the list to draw. */
export default {
	title: "Every check passed",
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("36rem")]}>
			<CheckRuns runs={RUNS} locale="en" labels={CHECK_RUN_LABELS} />
		</div>
	),
};
