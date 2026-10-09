/**
 * Live example island for `ToggleButton`s that submit a task filter. Each button carries the
 * filter as its own `name`/`value`, so a plain form round-trip works with no script; the
 * island reads the form's submitter instead, so the pressed button moves in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { hstack, vstack } from "@sdxc/u/layout";
import { Text, ToggleButton } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** The filters the task list offers, with how many tasks each one shows. */
const FILTERS = [
	{ value: "all", label: "All", count: 12 },
	{ value: "active", label: "Active", count: 7 },
	{ value: "done", label: "Completed", count: 5 },
];

/** The source the page shows, matching the markup below. */
const CODE = `let filter = "active";

function applyFilter(event: SubmitEvent) {
	event.preventDefault();
	if (!(event.submitter instanceof HTMLButtonElement)) return;
	filter = event.submitter.value;
	void handle.update();
}

let current = filters.find((option) => option.value === filter);

<form method="get" action="/tasks" mix={[on<HTMLFormElement, "submit">("submit", applyFilter)]}>
	{filters.map((option) => (
		<ToggleButton
			key={option.value}
			aria-pressed={filter === option.value}
			color="brand"
			name="filter"
			value={option.value}
		>
			{option.label}
		</ToggleButton>
	))}
</form>
<Text>Showing {current?.count ?? 0} tasks</Text>`;

/** A task filter, hydrated so a press updates the list without a round-trip. */
export const TaskFilter = clientEntry(import.meta.url, function TaskFilter(handle: Handle) {
	let filter = "active";

	/** Takes the filter from the button that submitted, the same pair the server would read. */
	function applyFilter(event: SubmitEvent) {
		event.preventDefault();
		if (!(event.submitter instanceof HTMLButtonElement)) return;
		filter = event.submitter.value;
		void handle.update();
	}

	return () => {
		let current = FILTERS.find((option) => option.value === filter);

		return (
			<div mix={[vstack({ gap: 3, align: "center" })]}>
				<form
					method="get"
					action="/tasks"
					mix={[
						hstack({ gap: 2, align: "center" }),
						on<HTMLFormElement, "submit">("submit", applyFilter),
					]}
				>
					{FILTERS.map((option) => (
						<ToggleButton
							key={option.value}
							aria-pressed={filter === option.value}
							color="brand"
							name="filter"
							value={option.value}
						>
							{option.label}
						</ToggleButton>
					))}
				</form>
				<Text>Showing {current?.count ?? 0} tasks</Text>
			</div>
		);
	};
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Submitted as a filter",
	code: CODE,
	render: () => <TaskFilter />,
};
