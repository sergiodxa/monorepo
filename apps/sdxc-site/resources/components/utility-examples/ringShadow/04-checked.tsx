/**
 * A `ringShadow` example driven by a checked radio, the selection the utility exists
 * for, so the reader can pick an option and watch its ring follow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ringShadow } from "sdxc/u/effects";
import { has } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A ring that follows the checked option of a radio group. */
export default {
	title: "Marking the selected option",
	description:
		'Combine it with `has(":checked", …)` to ring the option whose radio is checked. Pick an option:',
	render: () => (
		<div mix={[demo.row()]}>
			<label mix={[has(":checked", ringShadow("brand")), demo.panel()]}>
				<input type="radio" name="plan" checked /> Monthly
			</label>
			<label mix={[has(":checked", ringShadow("brand")), demo.panel()]}>
				<input type="radio" name="plan" /> Yearly
			</label>
		</div>
	),
} satisfies UtilityExampleModule;
