/**
 * Live preview for `CheckRuns`: a pull request's checks with one test job failing, so the list
 * opens on its own with the failure first and each row's Details link pointing at its log.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { CheckRuns } from "@sdxc/ui/app/check-runs";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<CheckRuns
	locale="en"
	runs={[
		{ name: "test (ubuntu-latest)", workflow: "CI / pull_request", state: "failure", duration: "3m 41s", href: "/acme/delta/actions/runs/8812/job/2" },
		{ name: "lint", workflow: "CI / pull_request", state: "success", duration: "48s", href: "/acme/delta/actions/runs/8812/job/1" },
		{ name: "typecheck", workflow: "CI / pull_request", state: "success", duration: "1m 12s", href: "/acme/delta/actions/runs/8812/job/3" },
		{ name: "build (node 22)", workflow: "CI / pull_request", state: "success", duration: "2m 05s", href: "/acme/delta/actions/runs/8812/job/4" },
		{ name: "preview deploy", workflow: "Deploy / pull_request", state: "skipped", href: "/acme/delta/actions/runs/8813/job/1" },
	]}
	labels={{
		counts: {
			failure: (n) => \`\${n} failing\`,
			pending: (n) => \`\${n} pending\`,
			success: (n) => \`\${n} successful\`,
			skipped: (n) => \`\${n} skipped\`,
			cancelled: (n) => \`\${n} cancelled\`,
		},
		summary: (list, total) => \`\${list} \${total === 1 ? "check" : "checks"}\`,
		states: { failure: "Failed", pending: "In progress", success: "Passed", skipped: "Skipped", cancelled: "Cancelled" },
		details: "Details",
		empty: "No checks",
	}}
/>`;

/** English strings, plural on each count and on the total. */
export const CHECK_RUN_LABELS: CheckRuns.Labels = {
	counts: {
		failure: (count) => `${count} failing`,
		pending: (count) => `${count} pending`,
		success: (count) => `${count} successful`,
		skipped: (count) => `${count} skipped`,
		cancelled: (count) => `${count} cancelled`,
	},
	summary: (list, total) => `${list} ${total === 1 ? "check" : "checks"}`,
	states: {
		failure: "Failed",
		pending: "In progress",
		success: "Passed",
		skipped: "Skipped",
		cancelled: "Cancelled",
	},
	details: "Details",
	empty: "No checks",
};

/** The address of a job's log in the preview, which returns the reader to this page. */
export function jobHref(run: number, job: number): string {
	return `/examples/acme/delta/actions/runs/${run}/job/${job}`;
}

/** A pull request's checks after a push that broke one test job. */
const RUNS: CheckRuns.Run[] = [
	{
		name: "lint",
		workflow: "CI / pull_request",
		state: "success",
		duration: "48s",
		href: jobHref(8812, 1),
	},
	{
		name: "test (ubuntu-latest)",
		workflow: "CI / pull_request",
		state: "failure",
		duration: "3m 41s",
		href: jobHref(8812, 2),
	},
	{
		name: "typecheck",
		workflow: "CI / pull_request",
		state: "success",
		duration: "1m 12s",
		href: jobHref(8812, 3),
	},
	{
		name: "build (node 22)",
		workflow: "CI / pull_request",
		state: "success",
		duration: "2m 05s",
		href: jobHref(8812, 4),
	},
	{
		name: "preview deploy",
		workflow: "Deploy / pull_request",
		state: "skipped",
		href: jobHref(8813, 1),
	},
];

/** What the preview registry reads: the source to show, and the list to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("36rem")]}>
			<CheckRuns runs={RUNS} locale="en" labels={CHECK_RUN_LABELS} />
		</div>
	),
};
