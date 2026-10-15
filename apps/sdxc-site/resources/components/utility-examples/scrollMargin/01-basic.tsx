/**
 * The opening `scrollMargin` example: sections that each grow the box an anchor jump
 * aligns, so a link lands with the section clear of a sticky header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "sdxc/u/color";
import { hstack, insBs, shrink, sticky, vstack } from "sdxc/u/layout";
import { scroll, scrollMargin } from "sdxc/u/overflow";
import { bs, is, maxIs, p, pbe, pi } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Anchor targets that land below a sticky header. */
export default {
	title: "Basic example",
	description:
		"Use `scrollMargin(n)` on the targets of an anchor jump to land them clear of a sticky header. Click a link and the section stops below the header:",
	render: () => (
		<div mix={[vstack({ gap: 4 }), is(72), maxIs("100%")]}>
			<nav mix={[hstack({ gap: 3 })]}>
				<a href="#margined-1">Section 1</a>
				<a href="#margined-2">Section 2</a>
				<a href="#margined-3">Section 3</a>
			</nav>
			<div mix={[scroll("y"), vstack({ gap: 3 }), bs(56), pi(4), pbe(4), demo.frame()]}>
				<header mix={[sticky(), insBs(0), bg(), p(3), demo.caption()]}>Sticky header</header>
				<section id="margined-1" mix={[scrollMargin(14), shrink(), bs(32), demo.block()]}>
					Section 1
				</section>
				<section id="margined-2" mix={[scrollMargin(14), shrink(), bs(32), demo.block()]}>
					Section 2
				</section>
				<section id="margined-3" mix={[scrollMargin(14), shrink(), bs(32), demo.block()]}>
					Section 3
				</section>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
