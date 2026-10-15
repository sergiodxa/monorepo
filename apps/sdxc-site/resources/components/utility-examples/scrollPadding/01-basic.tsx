/**
 * The opening `scrollPadding` example: a scroll box with a sticky header, padded by the
 * header's height, so a link to a section lands with the section clear of the header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "sdxc/u/color";
import { hstack, insBs, shrink, sticky, vstack } from "sdxc/u/layout";
import { scroll, scrollPadding } from "sdxc/u/overflow";
import { bs, is, maxIs, p, pbe, pi } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Anchor jumps that land below a sticky header. */
export default {
	title: "Basic example",
	description:
		"Use `scrollPadding(n)` on a scroll container to keep anchor jumps and snap positions clear of a sticky header. Click a link and the section stops below the header:",
	render: () => (
		<div mix={[vstack({ gap: 4 }), is(72), maxIs("100%")]}>
			<nav mix={[hstack({ gap: 3 })]}>
				<a href="#padded-1">Section 1</a>
				<a href="#padded-2">Section 2</a>
				<a href="#padded-3">Section 3</a>
			</nav>
			<div
				mix={[
					scroll("y"),
					scrollPadding(14),
					vstack({ gap: 3 }),
					bs(56),
					pi(4),
					pbe(4),
					demo.frame(),
				]}
			>
				<header mix={[sticky(), insBs(0), bg(), p(3), demo.caption()]}>Sticky header</header>
				<section id="padded-1" mix={[shrink(), bs(32), demo.block()]}>
					Section 1
				</section>
				<section id="padded-2" mix={[shrink(), bs(32), demo.block()]}>
					Section 2
				</section>
				<section id="padded-3" mix={[shrink(), bs(32), demo.block()]}>
					Section 3
				</section>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
