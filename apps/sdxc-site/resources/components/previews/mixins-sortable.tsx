/**
 * Live preview island for `sortable()`: a launch checklist in two lists, "Up next" and "Done".
 * A drag reorders a task or moves it across; Shift and an arrow does the same from the keyboard,
 * and the move is announced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { flexWrap, hidden, hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { sortable } from "@sdxc/ui/mixins";
import { attrs, clientEntry } from "remix/component";

/** The two lists and the tasks each starts with. */
const LISTS = [
	{
		value: "next",
		title: "Up next",
		tasks: ["Write the changelog", "Record the demo", "Email the beta list"],
	},
	{ value: "done", title: "Done", tasks: ["Freeze the API"] },
];

/** The source the page shows, matching the markup below. */
const CODE = `<section data-sortable>
	<span hidden mix={[sortable({ moved: "Moved to {list}" })]} />
	<span data-sortable-status role="status" mix={[visuallyHidden()]} />
	{lists.map((list) => (
		<div data-sortable-list={list.value}>
			<h3 data-sortable-title>{list.title}</h3>
			<ul data-sortable-items>
				{list.tasks.map((task) => (
					<li data-sortable-item={task.id}>
						<a href={task.href}>{task.title}</a>
					</li>
				))}
			</ul>
		</div>
	))}
</section>`;

/** One list: its title over its tasks, ringed while a dragged task would land in it. */
function TaskList(handle: Handle<{ value: string; title: string; tasks: string[] }>) {
	return () => (
		<div
			mix={[
				attrs({ "data-sortable-list": handle.props.value }),
				vstack({ gap: 2, align: "stretch" }),
				p(2),
				rounded("lg"),
				bg("neutral.bg-tint"),
				raw({ flex: "1 1 12rem", minInlineSize: 0, outline: "2px solid transparent" }),
				when("&[data-sortable-target]", raw({ outlineColor: "var(--ui-brand-ring)" })),
			]}
		>
			<h3 data-sortable-title mix={[m(0), p(1), text("sm"), weight("semibold")]}>
				{handle.props.title}
			</h3>
			<ul
				data-sortable-items
				mix={[
					vstack({ gap: 1.5, align: "stretch" }),
					m(0),
					p(0),
					raw({ listStyle: "none", minBlockSize: "2.5rem" }),
				]}
			>
				{handle.props.tasks.map((task) => (
					<li
						mix={[
							attrs({ "data-sortable-item": task }),
							rounded("md"),
							border("neutral.border"),
							bg(),
							text("sm"),
							cursor("grab"),
							when("&[data-sortable-dragging]", raw({ opacity: "0.35" })),
							when(
								"&:has(a:focus-visible)",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
							),
						]}
					>
						<a
							href={`#${task.toLowerCase().replaceAll(" ", "-")}`}
							mix={[
								p(2),
								raw({
									display: "block",
									color: "inherit",
									textDecoration: "none",
									outline: "none",
								}),
							]}
						>
							{task}
						</a>
					</li>
				))}
			</ul>
		</div>
	);
}

/** The checklist, hydrated so its tasks move by pointer and by key. */
export const SortablePreview = clientEntry(import.meta.url, function SortablePreview() {
	return () => (
		<section
			data-sortable
			mix={[
				vstack({ gap: 2, align: "stretch" }),
				raw({ inlineSize: "100%", maxInlineSize: "32rem" }),
			]}
		>
			<span mix={[hidden(), sortable({ moved: "Moved to {list}" })]} />
			<span data-sortable-status role="status" aria-live="polite" mix={[visuallyHidden()]} />
			<div mix={[hstack({ gap: 2, align: "start" }), flexWrap()]}>
				{LISTS.map((list) => (
					<TaskList value={list.value} title={list.title} tasks={list.tasks} />
				))}
			</div>
			<p mix={[m(0), text("xs"), fg("neutral")]}>
				Drag a task, or focus one and press Shift with an arrow.
			</p>
		</section>
	);
});

export default { code: CODE, render: () => <SortablePreview /> };
