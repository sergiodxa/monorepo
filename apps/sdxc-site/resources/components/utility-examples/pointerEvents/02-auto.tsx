/**
 * A `pointerEvents` example restoring clicks inside a pass-through layer: a toast region
 * covering the page lets clicks reach the page, while the toast inside it stays clickable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { pointerEvents } from "sdxc/u/general";
import { absolute, hstack, inset, relative } from "sdxc/u/layout";
import { is, p } from "sdxc/u/size";
import { hover } from "sdxc/u/state";
import { textDecoration, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Links under an overlay that ignores the pointer, and a toast in it that takes it back. */
export default {
	title: "Restoring pointer events",
	description:
		'Use `pointerEvents("auto")` inside a layer set to `pointerEvents()` to make one part of it clickable again. Both the links and the Undo button respond:',
	align: "stretch",
	render: () => (
		<div mix={[relative(), is("full"), p(4, 4, 20, 4), demo.track()]}>
			<nav mix={[demo.row()]}>
				<a href="/inbox" mix={[hover(textDecoration())]}>
					Inbox
				</a>
				<a href="/archive" mix={[hover(textDecoration())]}>
					Archive
				</a>
				<a href="/trash" mix={[hover(textDecoration())]}>
					Trash
				</a>
			</nav>
			<div
				mix={[
					pointerEvents(),
					absolute(),
					inset(0),
					hstack({ align: "end", justify: "center" }),
					p(3),
				]}
			>
				<div mix={[pointerEvents("auto"), hstack({ gap: 4, align: "center" }), demo.card()]}>
					<span>Message archived</span>
					<button mix={[weight("semibold"), fg("brand"), bg("transparent")]}>Undo</button>
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
