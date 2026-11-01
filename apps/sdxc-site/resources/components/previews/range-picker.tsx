/**
 * Live preview island for `RangePicker`: a dashboard's time range as GET-form presets with
 * their letter keys, a custom range in a popover, and a select when the frame is narrow.
 * Hydrated with `rangePickerKeys()`, so pressing D, W, T or 3 picks a range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { rangePickerKeys } from "@sdxc/ui/app";
import { RangePicker } from "@sdxc/ui/app/range-picker";
import { clientEntry } from "remix/component";

/** The ranges a monitor's charts offer, each with the letter that picks it. */
const PRESETS: RangePicker.Preset[] = [
	{ value: "24h", label: "24h", description: "Last 24 hours", key: "d" },
	{ value: "7d", label: "7d", description: "Last 7 days", key: "w" },
	{ value: "30d", label: "30d", description: "Last 30 days", key: "t" },
	{ value: "90d", label: "90d", description: "Last 90 days", key: "3" },
];

/** The source the page shows, matching the markup below. */
const CODE = `<RangePicker
	value="7d"
	action="/examples/dashboard"
	params={{ monitor: "api" }}
	presets={[
		{ value: "24h", label: "24h", description: "Last 24 hours", key: "d" },
		{ value: "7d", label: "7d", description: "Last 7 days", key: "w" },
		{ value: "30d", label: "30d", description: "Last 30 days", key: "t" },
		{ value: "90d", label: "90d", description: "Last 90 days", key: "3" },
	]}
	custom={{ startName: "from", endName: "to", max: "2026-10-31", key: "c" }}
	labels={{ group: "Time range", apply: "Apply", custom: "Custom", start: "From", end: "To" }}
	mix={rangePickerKeys()}
/>`;

/** The picker with its keyboard layer, hydrated so its letter keys and select work. */
export const RangePickerPreview = clientEntry(import.meta.url, function RangePickerPreview() {
	return () => (
		<RangePicker
			value="7d"
			action="/examples/dashboard"
			params={{ monitor: "api" }}
			presets={PRESETS}
			custom={{ startName: "from", endName: "to", max: "2026-10-31", key: "c" }}
			labels={{ group: "Time range", apply: "Apply", custom: "Custom", start: "From", end: "To" }}
			mix={[rangePickerKeys(), is("100%"), maxIs("40rem")]}
		/>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <RangePickerPreview /> };
