/**
 * The opening `disabled` example: an enabled and a disabled button side by side, so the
 * reader sees the faded, not-allowed look the state wrapper adds and can try both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { opacity } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { disabled } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Lower opacity and a not-allowed cursor, applied only to the disabled button. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `disabled()` to style a control the user cannot use. Hover both buttons to compare their cursors:",
	render: () => (
		<div mix={[demo.row()]}>
			<button
				type="button"
				mix={[
					bg("brand.solid"),
					fg("brand.onSolid"),
					cursor("pointer"),
					disabled([opacity(50), cursor("not-allowed")]),
					demo.control(),
				]}
			>
				Publish
			</button>
			<button
				type="button"
				disabled
				mix={[
					bg("brand.solid"),
					fg("brand.onSolid"),
					cursor("pointer"),
					disabled([opacity(50), cursor("not-allowed")]),
					demo.control(),
				]}
			>
				Publish
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
