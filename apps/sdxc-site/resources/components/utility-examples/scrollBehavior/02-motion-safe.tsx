/**
 * A `scrollBehavior` example wrapped in `motionSafe()`, so a reader who asked for
 * reduced motion gets an instant jump while everyone else gets the animation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink, vstack } from "sdxc/u/layout";
import { scroll, scrollBehavior } from "sdxc/u/overflow";
import { motionSafe } from "sdxc/u/responsive";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Smooth scrolling that honors a reduced-motion preference. */
export default {
	title: "Respecting reduced motion",
	description:
		"Wrap the call in `motionSafe()` so the scroll animates only when the reader has not asked for less motion. Turn on Reduce motion in your system's accessibility settings and click a link again to see an instant jump:",
	render: () => (
		<div mix={[vstack({ gap: 4 }), is(72), maxIs("100%")]}>
			<nav mix={[hstack({ gap: 3 })]}>
				<a href="#calm-1">Section 1</a>
				<a href="#calm-2">Section 2</a>
				<a href="#calm-3">Section 3</a>
			</nav>
			<div
				mix={[scroll("y"), motionSafe(scrollBehavior()), vstack({ gap: 3 }), bs(48), demo.panel()]}
			>
				<section id="calm-1" mix={[shrink(), bs(32), demo.block()]}>
					Section 1
				</section>
				<section id="calm-2" mix={[shrink(), bs(32), demo.block()]}>
					Section 2
				</section>
				<section id="calm-3" mix={[shrink(), bs(32), demo.block()]}>
					Section 3
				</section>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
