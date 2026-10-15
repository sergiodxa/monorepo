/**
 * An `invert` example scoped to the dark color scheme, the usual reason to invert: a
 * single-color asset drawn for light backgrounds stays legible on a dark one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invert } from "sdxc/u/effects";
import { dark } from "sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A black icon inverted only in the dark color scheme. */
export default {
	title: "Inverting in dark mode",
	description:
		"Wrap it in `dark()` to flip a single-color asset only when the dark color scheme is active. Switch the site's theme to see it change:",
	render: () => (
		<svg viewBox="0 0 24 24" fill="black" mix={[dark(invert()), demo.glyph()]}>
			<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
		</svg>
	),
} satisfies UtilityExampleModule;
