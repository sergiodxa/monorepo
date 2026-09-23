/**
 * Live preview island for `DropIndicator`. The bar is muted at rest and solid as the
 * active target, so it only says anything while a drag is in flight — which makes the
 * drag the point of the example. `dragReorder()` turns the grips into a pointer gesture
 * against a `DragSession`, the island reads that session to decide which gap is the
 * current one, and the `ui:reorder` event is what actually moves the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { GripVerticalIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { cursor, touchAction, userSelect } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Badge, DropIndicator, Header, Item } from "@sdxc/ui";
import { DragSession } from "@sdxc/ui/behaviors";
import { dragReorder } from "@sdxc/ui/mixins";
import { clientEntry, on, ref } from "remix/ui";

import { reorder } from "~/app/services/reorder-list";

/** The queue the preview opens with, in the order it would run. */
const STEPS = [
	{ id: "lint", name: "Lint and typecheck", owner: "CI" },
	{ id: "tests", name: "Unit and integration tests", owner: "CI" },
	{ id: "migrate", name: "Run pending migrations", owner: "Platform" },
	{ id: "deploy", name: "Deploy to production", owner: "Platform" },
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const DROP_INDICATOR_CODE = `let session = new DragSession();
let steps = [...STEPS];

// ref() fires on insert, so the subscription is set up in the browser and torn
// down with the node — the server renders the list without one.
let followDrag = ref((_node, signal) => {
	session.addEventListener("change", () => void handle.update(), { signal });
});

function isGapActive(stepId: string, side: "before" | "after") {
	return session.target?.key === stepId && session.target.position === side;
}

<div mix={[followDrag]}>
	<Header>Release checklist</Header>
	<Badge color="neutral">{session.active ? "Dragging" : "Drag a grip"}</Badge>

	<ol
		mix={[
			// A pointer drag over text would select it instead, so the list opts out.
			userSelect("none"),
			dragReorder(session),
			on<HTMLOListElement, "ui:reorder">("ui:reorder", (event) => {
				steps = reorder(steps, event.sourceKey, event.targetKey, event.position, (s) => s.id);
				void handle.update();
			}),
		]}
	>
		{steps.map((step, index) => (
			<li key={step.id} data-rmx-key={step.id}>
				{/* One bar per gap: the first row opens the list, and every row closes its own gap. */}
				{index === 0 ? <DropIndicator isDropTarget={isGapActive(step.id, "before")} /> : null}
				<Item>
					<Item.Media>
						<button
							type="button"
							data-drag-handle
							aria-label={\`Reorder \${step.name}\`}
							mix={[cursor("grab"), touchAction("none")]}
						>
							<GripVerticalIcon />
						</button>
					</Item.Media>
					<Item.Content>
						<Item.Title>
							{index + 1}. {step.name}
						</Item.Title>
						<Item.Description>Runs on {step.owner}</Item.Description>
					</Item.Content>
				</Item>
				<DropIndicator isDropTarget={isGapActive(step.id, "after")} />
			</li>
		))}
	</ol>
</div>`;

/** A reorderable release checklist, hydrated so the bars mark a live drop position. */
export const DropIndicatorPreview = clientEntry(
	"/resources/components/previews/drop-indicator.tsx#DropIndicatorPreview",
	function DropIndicatorPreview(handle: Handle) {
		let session = new DragSession();
		let steps = [...STEPS];

		// ref() fires on insert, so the subscription is set up in the browser and torn
		// down with the node — the server renders the list without one.
		let followDrag = ref((_node, signal) => {
			session.addEventListener("change", () => void handle.update(), { signal });
		});

		/** Whether the gap on one side of a step is where the drag would land right now. */
		function isGapActive(stepId: string, side: "before" | "after") {
			return session.target?.key === stepId && session.target.position === side;
		}

		return () => (
			<div mix={[vstack({ gap: 2, align: "stretch" }), is("26rem"), followDrag]}>
				<div mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
					<Header>Release checklist</Header>
					<Badge color="neutral">{session.active ? "Dragging" : "Drag a grip"}</Badge>
				</div>

				<ol
					mix={[
						m(0),
						p(0),
						vstack({ gap: 1, align: "stretch" }),
						// A pointer drag over text would select it instead, so the list opts out.
						userSelect("none"),
						dragReorder(session),
						on<HTMLOListElement, "ui:reorder">("ui:reorder", (event) => {
							steps = reorder(
								steps,
								event.sourceKey,
								event.targetKey,
								event.position,
								(step) => step.id,
							);
							void handle.update();
						}),
					]}
				>
					{steps.map((step, index) => (
						<li key={step.id} data-rmx-key={step.id} mix={[vstack({ gap: 1, align: "stretch" })]}>
							{/* One bar per gap: the first row opens the list, and every row closes its own. */}
							{index === 0 ? <DropIndicator isDropTarget={isGapActive(step.id, "before")} /> : null}
							<Item>
								<Item.Media>
									<button
										type="button"
										data-drag-handle
										aria-label={`Reorder ${step.name}`}
										mix={[cursor("grab"), touchAction("none"), fg("neutral"), p(0), text("sm")]}
									>
										<GripVerticalIcon />
									</button>
								</Item.Media>
								<Item.Content>
									<Item.Title>
										{String(index + 1)}. {step.name}
									</Item.Title>
									<Item.Description>Runs on {step.owner}</Item.Description>
								</Item.Content>
							</Item>
							<DropIndicator isDropTarget={isGapActive(step.id, "after")} />
						</li>
					))}
				</ol>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: DROP_INDICATOR_CODE, render: () => <DropIndicatorPreview /> };
