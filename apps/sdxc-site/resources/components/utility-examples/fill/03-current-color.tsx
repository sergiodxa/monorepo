/**
 * A `fill` example with `currentColor`, which lets an icon inside a button take the
 * button's text color, whatever tone the button is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg, fill } from "sdxc/u/color";
import { hstack } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Icons that follow the text color of the button they sit in. */
export default {
	title: "Following the text color",
	description:
		"Pass `currentColor` so an icon takes the text color of its parent, here two buttons of different tones:",
	render: () => (
		<div mix={[demo.row()]}>
			<button
				type="button"
				mix={[
					bg("brand.solid"),
					fg("brand.onSolid"),
					hstack({ gap: 2, align: "center" }),
					demo.swatch(),
				]}
			>
				<svg
					mix={[fill("currentColor")]}
					viewBox="0 0 24 24"
					width={16}
					height={16}
					aria-hidden="true"
				>
					<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
				</svg>
				Star
			</button>
			<button
				type="button"
				mix={[
					bg("danger.tint"),
					fg("danger.emphasis"),
					hstack({ gap: 2, align: "center" }),
					demo.swatch(),
				]}
			>
				<svg
					mix={[fill("currentColor")]}
					viewBox="0 0 24 24"
					width={16}
					height={16}
					aria-hidden="true"
				>
					<path d="M12 20.5S3 15 3 8.9A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.3C21 15 12 20.5 12 20.5z" />
				</svg>
				Like
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
