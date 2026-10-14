/**
 * Live preview island for `Header`. It renders a `<header>` holding a small uppercase
 * label, so it earns its place by naming a group of rows rather than standing alone — a
 * usage panel is two such groups, and the label is the only thing telling the reader which
 * numbers they are looking at.
 *
 * `Header` carries no behavior of its own and needs no mixin. The island is what makes the
 * labels worth reading: switching the period rewrites the rows underneath while the
 * headings that name them stay put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { tabularNums, text, weight } from "@sdxc/u/typography";
import { Header, Label, Select, Separator } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** What each period's rows read, so switching the select changes real numbers. */
const USAGE = {
	current: {
		metered: [
			{ name: "Requests", value: "4.2 M" },
			{ name: "Bandwidth", value: "318 GB" },
			{ name: "Build minutes", value: "1,240" },
		],
		limits: [
			{ name: "Included requests", value: "5 M" },
			{ name: "Overage rate", value: "$0.40 / M" },
		],
	},
	previous: {
		metered: [
			{ name: "Requests", value: "5.8 M" },
			{ name: "Bandwidth", value: "402 GB" },
			{ name: "Build minutes", value: "1,615" },
		],
		limits: [
			{ name: "Included requests", value: "5 M" },
			{ name: "Overage rate", value: "$0.40 / M" },
		],
	},
};

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const HEADER_CODE = `let period: keyof typeof USAGE = "current";

function choosePeriod(event: Event) {
	period = (event.target as HTMLSelectElement).value as keyof typeof USAGE;
	void handle.update();
}

// A native select's change event bubbles, so the panel is where the island listens.
<div mix={[on<HTMLDivElement, "change">("change", choosePeriod)]}>
	<Label htmlFor="period">Billing period</Label>
	<Select id="period" name="period">
		<Select.Option value="current" selected={period === "current"}>This month</Select.Option>
		<Select.Option value="previous" selected={period === "previous"}>Last month</Select.Option>
	</Select>

	<Header>Metered usage</Header>
	{USAGE[period].metered.map((row) => (
		<div key={row.name} mix={[hstack({ gap: 4, align: "baseline", justify: "between" })]}>
			<span>{row.name}</span>
			<span>{row.value}</span>
		</div>
	))}

	<Separator />

	<Header>Plan limits</Header>
	{USAGE[period].limits.map((row) => (
		<div key={row.name} mix={[hstack({ gap: 4, align: "baseline", justify: "between" })]}>
			<span>{row.name}</span>
			<span>{row.value}</span>
		</div>
	))}
</div>`;

/** A usage panel in two labelled groups, hydrated so the period actually switches. */
export const HeaderPreview = clientEntry(import.meta.url, function HeaderPreview(handle: Handle) {
	let period: keyof typeof USAGE = "current";

	/** Swaps the rows the two headings name. */
	function choosePeriod(event: Event) {
		period = (event.target as HTMLSelectElement).value as keyof typeof USAGE;
		void handle.update();
	}

	return () => (
		// A native select's change event bubbles, so the panel is where the island listens.
		<div
			mix={[
				vstack({ gap: 4, align: "stretch" }),
				is("22rem"),
				on<HTMLDivElement, "change">("change", choosePeriod),
			]}
		>
			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<Label htmlFor="preview-header-period">Billing period</Label>
				<Select id="preview-header-period" name="period">
					<Select.Option value="current" selected={period === "current"}>
						This month
					</Select.Option>
					<Select.Option value="previous" selected={period === "previous"}>
						Last month
					</Select.Option>
				</Select>
			</div>

			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<Header>Metered usage</Header>
				{USAGE[period].metered.map((row) => (
					<div key={row.name} mix={[hstack({ gap: 4, align: "baseline", justify: "between" })]}>
						<span mix={[text("sm"), fg("neutral.emphasis")]}>{row.name}</span>
						<span mix={[text("sm"), weight("medium"), tabularNums()]}>{row.value}</span>
					</div>
				))}
			</div>

			<Separator />

			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<Header>Plan limits</Header>
				{USAGE[period].limits.map((row) => (
					<div key={row.name} mix={[hstack({ gap: 4, align: "baseline", justify: "between" })]}>
						<span mix={[text("sm"), fg("neutral.emphasis")]}>{row.name}</span>
						<span mix={[text("sm"), weight("medium"), tabularNums()]}>{row.value}</span>
					</div>
				))}
			</div>
		</div>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: HEADER_CODE, render: () => <HeaderPreview /> };
