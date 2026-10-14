/**
 * A `minBs` example of a card whose footer stays at its bottom edge: the minimum gives
 * the card room, and the stack pushes the footer to the end of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is, minBs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A minimum block size that keeps a footer at the bottom. */
export default {
	title: "Keeping a footer down",
	description:
		"Combine `minBs()` with a stack that spreads its children to keep a card's footer at its bottom edge, however short the content:",
	render: () => (
		<div mix={[vstack({ justify: "between" }), minBs(48), is(64), demo.panel()]}>
			<p mix={[demo.prose()]}>A short note.</p>
			<p mix={[demo.caption()]}>Updated today</p>
		</div>
	),
} satisfies UtilityExampleModule;
