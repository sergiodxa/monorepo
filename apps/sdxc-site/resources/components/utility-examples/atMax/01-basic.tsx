/**
 * The opening `atMax` example: a toolbar inside a container the reader can resize,
 * whose button labels hide once the container is at most the `sm` step wide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { cursor } from "@sdxc/u/general";
import { container, hstack, resize } from "@sdxc/u/layout";
import { hidden } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { atMax } from "@sdxc/u/responsive";
import { minIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Labels hidden in a narrow container. */
export default {
	title: "Basic example",
	description:
		"Use `atMax(size, ...)` to apply utilities only while the nearest container is at most that wide, the way a toolbar drops its labels when space runs short. Drag the handle at the box's bottom-right corner to resize it and watch the layout change:",
	align: "stretch",
	render: () => (
		<div mix={[container("toolbar"), resize("horizontal"), overflow(), minIs(48), demo.panel()]}>
			<div mix={[hstack({ gap: 2 })]}>
				<button
					type="button"
					mix={[bg("neutral.tint"), fg("neutral.emphasis"), cursor("pointer"), demo.control()]}
				>
					✎ <span mix={[atMax("sm", hidden())]}>Edit</span>
				</button>
				<button
					type="button"
					mix={[bg("neutral.tint"), fg("neutral.emphasis"), cursor("pointer"), demo.control()]}
				>
					⧉ <span mix={[atMax("sm", hidden())]}>Duplicate</span>
				</button>
				<button
					type="button"
					mix={[bg("neutral.tint"), fg("neutral.emphasis"), cursor("pointer"), demo.control()]}
				>
					⌫ <span mix={[atMax("sm", hidden())]}>Delete</span>
				</button>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
