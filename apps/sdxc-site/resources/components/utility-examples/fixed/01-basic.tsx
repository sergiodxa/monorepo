/**
 * The opening `fixed` example: a header that stays put while the content under it scrolls.
 * The window is wrapped in `contain("layout")` so the header pins to it instead of to the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contain, fixed, insLeft, insRight, insTop } from "sdxc/u/layout";
import { overflowY } from "sdxc/u/overflow";
import { bs, is, pbe, pbs, pi } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A header that stays in place while the content beneath it scrolls. */
export default {
	title: "Basic example",
	description:
		'Use `fixed()` to position an element against the viewport, so it stays put while the page scrolls. Here `contain("layout")` stands in for the viewport; scroll the text:',
	render: () => (
		<div mix={[contain("layout"), is(80), bs(56), demo.frame()]}>
			<header mix={[fixed(), insTop(2), insLeft(2), insRight(2), demo.block()]}>fixed()</header>
			<div mix={[overflowY("auto"), bs("full"), pi(4), pbs(16), pbe(4)]}>
				<p mix={[demo.prose()]}>
					Scroll this window and the header stays where it is, while the paragraphs move underneath
					it.
				</p>
				<p mix={[demo.prose()]}>
					A fixed element leaves the flow of the page, so nothing makes room for it; the padding at
					the top of the scroller keeps the first line clear.
				</p>
				<p mix={[demo.prose()]}>
					In a real page, a fixed header pins to the viewport, staying on screen however far the
					reader scrolls.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
