/**
 * The opening `minBs` example: two cards with the same minimum, one shorter than it and
 * grown to it, one longer and left to grow past it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { is, minBs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A minimum block size that content can still exceed. */
export default {
	title: "Basic example",
	description:
		"Use `minBs(n)` to give an element a minimum block size; content taller than the minimum still grows past it:",
	render: () => (
		<div mix={[hstack({ gap: 4, align: "start" })]}>
			<div mix={[minBs(32), is(48), demo.panel()]}>
				<p mix={[demo.prose()]}>One line.</p>
			</div>
			<div mix={[minBs(32), is(48), demo.panel()]}>
				<p mix={[demo.prose()]}>
					Several lines of text, more than the minimum holds, so the card grows.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
