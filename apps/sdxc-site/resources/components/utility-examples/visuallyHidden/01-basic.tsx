/**
 * The opening `visuallyHidden` example: an icon-only button whose label is hidden on
 * screen but still read out by a screen reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { visuallyHidden } from "@sdxc/u/a11y";
import { fill } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An icon button with a label only screen readers announce. */
export default {
	title: "Basic example",
	description:
		"Use `visuallyHidden()` to hide text on screen while keeping it in the accessibility tree, like the label of an icon-only button:",
	render: () => (
		<button type="button" mix={[demo.block()]}>
			<svg
				mix={[fill("currentColor")]}
				viewBox="0 0 24 24"
				width={20}
				height={20}
				aria-hidden="true"
			>
				<path d="M12 20.5S3 15 3 8.9A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.3C21 15 12 20.5 12 20.5z" />
			</svg>
			<span mix={[visuallyHidden()]}>Add to favorites</span>
		</button>
	),
} satisfies UtilityExampleModule;
