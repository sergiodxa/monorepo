/**
 * Live preview for `FareOptions`: Basic, Standard and Flex fares as radio cards in one form,
 * Standard chosen and ribboned "Recommended", each listing what it includes with a check,
 * a cross or a coin for a fee.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { FareOptions } from "@sdxc/ui/travel/fare-options";

/** The source the page shows, matching the markup below. */
const CODE = `<FareOptions
	legend="Choose your fare"
	name="fare"
	statusLabels={{ yes: "Included", no: "Not included", fee: "Available for a fee" }}
>
	<FareOptions.Option value="basic" title="Basic" price="$412" features={[
		{ label: "Personal item", included: "yes" },
		{ label: "Carry-on bag", included: "fee" },
		{ label: "Changes", included: "no" },
	]} />
	<FareOptions.Option value="standard" title="Standard" price="$468" priceDetail="+$56"
		ribbon="Recommended" checked features={[…]} />
	<FareOptions.Option value="flex" title="Flex" price="$544" priceDetail="+$132" features={[…]} />
</FareOptions>`;

/** What every fare lists, in the same order so the cards compare line by line. */
const FEATURES: Record<string, FareOptions.Feature[]> = {
	basic: [
		{ label: "Personal item", included: "yes" },
		{ label: "Carry-on bag", included: "fee" },
		{ label: "Checked bag", included: "fee" },
		{ label: "Seat choice", included: "fee" },
		{ label: "Changes", included: "no" },
	],
	standard: [
		{ label: "Personal item", included: "yes" },
		{ label: "Carry-on bag", included: "yes" },
		{ label: "Checked bag", included: "fee" },
		{ label: "Seat choice", included: "yes" },
		{ label: "Changes", included: "fee" },
	],
	flex: [
		{ label: "Personal item", included: "yes" },
		{ label: "Carry-on bag", included: "yes" },
		{ label: "Checked bag", included: "yes" },
		{ label: "Seat choice", included: "yes" },
		{ label: "Free changes", included: "yes" },
	],
};

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form
			action="#fare"
			mix={[raw({ inlineSize: "100%", maxInlineSize: "46rem", marginBlock: "1.5rem" })]}
		>
			<FareOptions
				legend="Choose your fare"
				name="fare"
				statusLabels={{ yes: "Included", no: "Not included", fee: "Available for a fee" }}
			>
				<FareOptions.Option
					value="basic"
					title="Basic"
					price="$412"
					priceDetail="Round trip"
					features={FEATURES.basic}
				/>
				<FareOptions.Option
					value="standard"
					title="Standard"
					price="$468"
					priceDetail="+$56"
					ribbon="Recommended"
					checked
					features={FEATURES.standard}
				/>
				<FareOptions.Option
					value="flex"
					title="Flex"
					price="$544"
					priceDetail="+$132"
					features={FEATURES.flex}
				/>
			</FareOptions>
		</form>
	),
};
