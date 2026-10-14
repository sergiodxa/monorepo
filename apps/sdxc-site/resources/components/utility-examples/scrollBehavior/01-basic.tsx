/**
 * The opening `scrollBehavior` example: links that jump to sections of a scroll box,
 * which animates there instead of jumping, so a reader sees the motion the utility
 * turns on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink, vstack } from "@sdxc/u/layout";
import { scroll, scrollBehavior } from "@sdxc/u/overflow";
import { bs, is, maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Anchor jumps that animate inside a scroll container. */
export default {
	title: "Basic example",
	description:
		"Use `scrollBehavior()`, which applies `smooth`, to animate anchor jumps and programmatic scrolls inside a scroll container. Click a link:",
	render: () => (
		<div mix={[vstack({ gap: 4 }), is(72), maxIs("100%")]}>
			<nav mix={[hstack({ gap: 3 })]}>
				<a href="#smooth-1">Section 1</a>
				<a href="#smooth-2">Section 2</a>
				<a href="#smooth-3">Section 3</a>
			</nav>
			<div mix={[scroll("y"), scrollBehavior(), vstack({ gap: 3 }), bs(48), demo.panel()]}>
				<section id="smooth-1" mix={[shrink(), bs(32), demo.block()]}>
					Section 1
				</section>
				<section id="smooth-2" mix={[shrink(), bs(32), demo.block()]}>
					Section 2
				</section>
				<section id="smooth-3" mix={[shrink(), bs(32), demo.block()]}>
					Section 3
				</section>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
