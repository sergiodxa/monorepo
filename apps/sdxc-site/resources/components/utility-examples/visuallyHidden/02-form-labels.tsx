/**
 * A `visuallyHidden` example on a form label, for a search field whose purpose is plain
 * from its placement and button, yet still named for assistive technology.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { visuallyHidden } from "sdxc/u/a11y";
import { hstack } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A search field with a label only screen readers announce. */
export default {
	title: "Hiding a form label",
	description:
		"Hide a `<label>` visually when the design shows no label, so the field still has an accessible name:",
	render: () => (
		<form role="search" mix={[hstack({ gap: 2 })]}>
			<label htmlFor="site-search" mix={[visuallyHidden()]}>
				Search the docs
			</label>
			<input id="site-search" type="search" placeholder="Search…" mix={[demo.field()]} />
			<button type="submit" mix={[demo.block()]}>
				Search
			</button>
		</form>
	),
} satisfies UtilityExampleModule;
