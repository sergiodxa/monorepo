/**
 * Live preview for `MergeBox`: a pull request that can merge, with its review, checks and
 * conflict rows met and the split button's menu offering a merge commit, a squash or a rebase.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { CheckRuns } from "@sdxc/ui/app/check-runs";
import { MergeBox } from "@sdxc/ui/app/merge-box";

import { CHECK_RUN_LABELS, jobHref } from "~/resources/components/previews/check-runs";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<MergeBox
	state="ready"
	action="/acme/delta/pull/412/merge"
	rows={{
		reviews: { tone: "success", title: "1 approving review", detail: "ana approved these changes" },
		checks: {
			tone: "success",
			title: "All checks have passed",
			detail: "4 successful checks",
			children: <CheckRuns runs={runs} labels={checkLabels} />,
		},
		conflicts: { tone: "success", title: "No conflicts with the base branch" },
	}}
	labels={{
		methods: { merge: "Merge pull request", squash: "Squash and merge", rebase: "Rebase and merge" },
		methodDetails: {
			merge: "All commits from this branch will be added to the base branch",
			squash: "The 6 commits from this branch will be combined into one",
			rebase: "The 6 commits from this branch will be rebased onto the base branch",
		},
		chooseMethod: "Choose a merge method",
		status: {
			blocked: "Merging is blocked until a reviewer approves",
			conflicts: "Resolve the conflicts before merging",
			merged: "Pull request merged into main",
			closed: "Pull request closed without merging",
		},
	}}
/>`;

/** Every string the box shows. */
export const MERGE_LABELS: MergeBox.Labels = {
	methods: { merge: "Merge pull request", squash: "Squash and merge", rebase: "Rebase and merge" },
	methodDetails: {
		merge: "All commits from this branch will be added to the base branch",
		squash: "The 6 commits from this branch will be combined into one",
		rebase: "The 6 commits from this branch will be rebased onto the base branch",
	},
	chooseMethod: "Choose a merge method",
	status: {
		blocked: "Merging is blocked until a reviewer approves",
		conflicts: "Resolve the conflicts before merging",
		merged: "Pull request merged into main",
		closed: "Pull request closed without merging",
	},
};

/** Where the preview's forms post, which returns the reader to this page. */
export const MERGE_ACTION = "/examples/acme/delta/pull/412/merge";

/** What the preview registry reads: the source to show, and the box to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("40rem")]}>
			<MergeBox
				id="preview-merge-box"
				state="ready"
				action={MERGE_ACTION}
				labels={MERGE_LABELS}
				rows={{
					reviews: {
						tone: "success",
						title: "1 approving review",
						detail: "ana approved these changes",
					},
					checks: {
						tone: "success",
						title: "All checks have passed",
						detail: "4 successful checks",
						children: (
							<CheckRuns
								locale="en"
								labels={CHECK_RUN_LABELS}
								runs={[
									{
										name: "lint",
										workflow: "CI",
										state: "success",
										duration: "48s",
										href: jobHref(8840, 1),
									},
									{
										name: "test",
										workflow: "CI",
										state: "success",
										duration: "3m 02s",
										href: jobHref(8840, 2),
									},
									{
										name: "typecheck",
										workflow: "CI",
										state: "success",
										duration: "1m 10s",
										href: jobHref(8840, 3),
									},
									{
										name: "build",
										workflow: "CI",
										state: "success",
										duration: "2m 11s",
										href: jobHref(8840, 4),
									},
								]}
							/>
						),
					},
					conflicts: { tone: "success", title: "No conflicts with the base branch" },
				}}
			/>
		</div>
	),
};
