/**
 * A `detailsContent` example animating a disclosure open and closed with CSS alone: the
 * content's block size transitions from zero to `auto` once the details are open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition, transitionBehavior } from "sdxc/u/effects";
import { cursor } from "sdxc/u/general";
import { interpolateSize } from "sdxc/u/layout";
import { overflow } from "sdxc/u/overflow";
import { bs } from "sdxc/u/size";
import { detailsContent, open } from "sdxc/u/state";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Zero block size while closed, `auto` while open, with a transition between the two. */
export default {
	title: "Animating open and closed",
	description:
		"Collapse the content with `detailsContent()`, size it back to `auto` under `open()`, and let `interpolateSize()` animate between them. Click the summary:",
	render: () => (
		<details
			mix={[
				interpolateSize(),
				detailsContent([
					bs(0),
					overflow("clip"),
					transition("block-size, content-visibility", { duration: 300 }),
					transitionBehavior("allow-discrete"),
				]),
				open(detailsContent(bs("auto"))),
				demo.panel(),
			]}
		>
			<summary mix={[cursor("pointer"), weight("semibold")]}>How do releases work?</summary>
			A release runs every day and publishes each package that changed since the last one.
		</details>
	),
} satisfies UtilityExampleModule;
