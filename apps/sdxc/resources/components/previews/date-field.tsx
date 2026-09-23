/**
 * Live preview island for `DateField`. The field is the plain, labelled `input type="date"`
 * a form reaches for when the whole interaction is one day typed or picked from the
 * platform's own control — no popover, no month grid. Hydration is what lets the field's
 * supporting copy answer the value: the island listens on the composed input through
 * `parts`, keeps the value, and re-renders the hint the claim form shows beneath it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { is } from "@sdxc/u/size";
import { DateField } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

import { parseDayValue, quarterBounds, relativeDayHint } from "~/app/services/calendar-labels";
import { dayKey } from "~/app/services/month-grid";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const DATE_FIELD_CODE = `let today = new Date();
let { min, max } = quarterBounds(today);
let value = dayKey(today);

function pickDate(event: Event & { currentTarget: HTMLInputElement }) {
	value = event.currentTarget.value;
	void handle.update();
}

<DateField
	label="Transaction date"
	name="transactionDate"
	description={relativeDayHint(parseDayValue(value), today)}
	value={value}
	min={min}
	max={max}
	required
	autoComplete="off"
	parts={{ input: [on<HTMLInputElement, "change">("change", pickDate)] }}
/>`;

/** A dated expense claim, hydrated so the field's own hint tracks the day it holds. */
export const DateFieldPreview = clientEntry(
	"/resources/components/previews/date-field.tsx#DateFieldPreview",
	function DateFieldPreview(handle: Handle) {
		let today = new Date();
		let { min, max } = quarterBounds(today);
		let value = dayKey(today);

		/** Keeps the picked day so the description beneath the field can describe it. */
		function pickDate(event: Event & { currentTarget: HTMLInputElement }) {
			value = event.currentTarget.value;
			void handle.update();
		}

		return () => (
			<DateField
				label="Transaction date"
				name="transactionDate"
				description={relativeDayHint(parseDayValue(value), today)}
				value={value}
				min={min}
				max={max}
				required
				autoComplete="off"
				parts={{ input: [on<HTMLInputElement, "change">("change", pickDate)] }}
				mix={[is("18rem")]}
			/>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: DATE_FIELD_CODE, render: () => <DateFieldPreview /> };
