/**
 * Live example for `CheckRuns` while a push is still being checked: the summary leads with the
 * pending count and its icon pulses, and the list stays closed because nothing has failed yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { CheckRuns } from "@sdxc/ui/app/check-runs";

import { CHECK_RUN_LABELS, jobHref } from "~/resources/components/previews/check-runs";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<CheckRuns
	locale="en"
	runs={[
		{ name: "lint", workflow: "CI / push", state: "success", duration: "51s", href: "…" },
		{ name: "test (ubuntu-latest)", workflow: "CI / push", state: "pending", href: "…" },
		{ name: "test (windows-latest)", workflow: "CI / push", state: "pending", href: "…" },
		{ name: "typecheck", workflow: "CI / push", state: "success", duration: "1m 09s", href: "…" },
	]}
	labels={labels}
/>`;

/** What the preview registry reads: the title, the source to show, and the list to draw. */
export default {
	title: "While checks are running",
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("36rem")]}>
			<CheckRuns
				locale="en"
				labels={CHECK_RUN_LABELS}
				runs={[
					{
						name: "lint",
						workflow: "CI / push",
						state: "success",
						duration: "51s",
						href: jobHref(8820, 1),
					},
					{
						name: "test (ubuntu-latest)",
						workflow: "CI / push",
						state: "pending",
						href: jobHref(8820, 2),
					},
					{
						name: "test (windows-latest)",
						workflow: "CI / push",
						state: "pending",
						href: jobHref(8820, 3),
					},
					{
						name: "typecheck",
						workflow: "CI / push",
						state: "success",
						duration: "1m 09s",
						href: jobHref(8820, 4),
					},
				]}
			/>
		</div>
	),
};
