/**
 * Live preview island for `SelectionIndicator`. Its whole point is that the marker
 * keeps its layout slot whether or not it is showing, which only reads with several
 * rows and a selection that moves — so the example is a sort menu built from radios,
 * hydrated so picking a row moves the checkmark without any label shifting sideways.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CheckIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Header, SelectionIndicator, Text } from "@sdxc/ui";
import { ariaChecked } from "@sdxc/ui/mixins";
import { clientEntry, css, on } from "remix/component";

/** The orders the menu offers, so the indicator has somewhere to move between. */
const ORDERS = [
	{ value: "recent", label: "Most recent" },
	{ value: "downloads", label: "Most downloaded" },
	{ value: "name", label: "Name, A to Z" },
	{ value: "size", label: "Smallest bundle" },
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SELECTION_INDICATOR_CODE = `<div mix={[vstack({ gap: 1, align: "stretch" }), on<HTMLDivElement, "change">("change", readOrder)]}>
	<Header id="preview-sort-heading">Sort packages by</Header>
	<div role="group" aria-labelledby="preview-sort-heading" mix={[vstack({ gap: 0, align: "stretch" })]}>
		{orders.map((order) => (
			<label
				key={order.value}
				mix={[
					hstack({ gap: 2, align: "center" }),
					p(2),
					css({ cursor: "pointer", borderRadius: "var(--ui-radius-md)" }),
				]}
			>
				<SelectionIndicator aria-selected={order.value === selected ? "true" : "false"}>
					<CheckIcon />
				</SelectionIndicator>
				<input
					type="radio"
					name="preview-order"
					value={order.value}
					checked={order.value === selected}
					mix={[ariaChecked(), visuallyHidden()]}
				/>
				{order.label}
			</label>
		))}
	</div>
	<Text>Nothing shifts sideways as the marker moves.</Text>
</div>`;

/** A sort menu whose checkmark moves, hydrated so the selection has somewhere to go. */
export const SelectionIndicatorPreview = clientEntry(
	import.meta.url,
	function SelectionIndicatorPreview(handle: Handle) {
		let selected = "downloads";

		/** Moves the marker to whichever row the reader just picked. */
		function readOrder(event: Event) {
			let target = event.target;
			if (!(target instanceof HTMLInputElement)) return;

			selected = target.value;
			void handle.update();
		}

		return () => (
			<div
				mix={[
					vstack({ gap: 1, align: "stretch" }),
					is("16rem"),
					on<HTMLDivElement, "change">("change", readOrder),
				]}
			>
				<Header id="preview-sort-heading">Sort packages by</Header>
				<div
					role="group"
					aria-labelledby="preview-sort-heading"
					mix={[vstack({ gap: 0, align: "stretch" })]}
				>
					{ORDERS.map((order) => (
						<label
							key={order.value}
							mix={[
								hstack({ gap: 2, align: "center" }),
								p(2),
								text("sm"),
								css({ cursor: "pointer", borderRadius: "var(--ui-radius-md)" }),
							]}
						>
							<SelectionIndicator aria-selected={order.value === selected ? "true" : "false"}>
								<CheckIcon />
							</SelectionIndicator>
							<input
								type="radio"
								name="preview-order"
								value={order.value}
								checked={order.value === selected}
								mix={[ariaChecked(), visuallyHidden()]}
							/>
							{order.label}
						</label>
					))}
				</div>
				<Text>Nothing shifts sideways as the marker moves.</Text>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SELECTION_INDICATOR_CODE, render: () => <SelectionIndicatorPreview /> };
