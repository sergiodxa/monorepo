/**
 * A `disabled` example on a link marked `aria-disabled`, which has no native disabled
 * state, so the reader sees the same wrapper cover a custom or non-form control.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { opacity } from "sdxc/u/effects";
import { pointerEvents } from "sdxc/u/general";
import { disabled } from "sdxc/u/state";
import { textDecoration } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The ARIA attribute matches the same rule as the native one, so one call covers both. */
export default {
	title: "ARIA disabled",
	description:
		'`disabled()` also matches `aria-disabled="true"`, for links and custom widgets that have no native disabled state:',
	render: () => (
		<nav mix={[demo.row()]}>
			<a
				href="#next"
				mix={[fg("brand"), textDecoration(), disabled([opacity(40), pointerEvents("none")])]}
			>
				Next page
			</a>
			<a
				href="#next"
				aria-disabled="true"
				mix={[fg("brand"), textDecoration(), disabled([opacity(40), pointerEvents("none")])]}
			>
				Next page
			</a>
		</nav>
	),
} satisfies UtilityExampleModule;
