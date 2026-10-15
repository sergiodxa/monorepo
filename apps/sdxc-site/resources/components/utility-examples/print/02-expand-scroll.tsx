/**
 * A `print` example that releases a scroll area on paper, where nothing can scroll, so
 * every line it holds is printed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflow, scroll } from "sdxc/u/overflow";
import { print } from "sdxc/u/responsive";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A scroll area expanded to its full height for print. */
export default {
	title: "Expanding scroll areas",
	description:
		'Release fixed heights for print, like `print([overflow("visible"), bs("auto")])`, so content behind a scroll area reaches the paper. Open your browser\'s print preview to see the whole text:',
	render: () => (
		<div
			mix={[
				scroll("y"),
				bs(24),
				is(72),
				maxIs("100%"),
				print([overflow("visible"), bs("auto")]),
				demo.panel(),
			]}
		>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so on screen the last lines of it are behind a
				scroll. On paper nothing scrolls, so the box grows to print every line of it.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
