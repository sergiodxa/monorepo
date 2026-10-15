/**
 * The opening `combine` example: a badge drawn from one mixin that merges its color,
 * shape, spacing and type, the value a design system hands out as a single style.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { combine } from "sdxc/u/general";
import { p } from "sdxc/u/size";
import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Two badges, each styled by one combined mixin. */
export default {
	title: "Basic example",
	description:
		"Use `combine([...])` to merge several utilities into one mixin you can name, export and reuse like any other:",
	render: () => (
		<div mix={[demo.row()]}>
			<span
				mix={[
					combine([
						bg("brand.tint"),
						fg("brand.emphasis"),
						rounded("full"),
						p(1, 3),
						text("sm"),
						weight("medium"),
					]),
				]}
			>
				Beta
			</span>
			<span
				mix={[
					combine([
						bg("success.tint"),
						fg("success.emphasis"),
						rounded("full"),
						p(1, 3),
						text("sm"),
						weight("medium"),
					]),
				]}
			>
				Shipped
			</span>
		</div>
	),
} satisfies UtilityExampleModule;
