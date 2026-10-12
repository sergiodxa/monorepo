/**
 * An `aria` example marking the current page in a navigation bar from `aria-current`, so
 * the reader sees one attribute drive both the announcement and the look.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { borderEdge, fg } from "@sdxc/u/color";
import { pb } from "@sdxc/u/size";
import { aria } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An underline bar and stronger text on the link whose `aria-current` is `page`. */
export default {
	title: "Current page",
	description:
		'Match any value, not only `"true"`, like `aria("current", "page", …)` for the link to the page being shown:',
	render: () => (
		<nav mix={[demo.row()]}>
			<a
				href="#docs"
				mix={[
					fg("neutral.muted"),
					text("sm"),
					pb(1),
					borderEdge("block-end", { color: "transparent", width: 2 }),
					aria("current", "page", [
						fg("brand"),
						weight("semibold"),
						borderEdge("block-end", { color: "brand" }),
					]),
				]}
			>
				Docs
			</a>
			<a
				href="#api"
				aria-current="page"
				mix={[
					fg("neutral.muted"),
					text("sm"),
					pb(1),
					borderEdge("block-end", { color: "transparent", width: 2 }),
					aria("current", "page", [
						fg("brand"),
						weight("semibold"),
						borderEdge("block-end", { color: "brand" }),
					]),
				]}
			>
				API
			</a>
			<a
				href="#blog"
				mix={[
					fg("neutral.muted"),
					text("sm"),
					pb(1),
					borderEdge("block-end", { color: "transparent", width: 2 }),
					aria("current", "page", [
						fg("brand"),
						weight("semibold"),
						borderEdge("block-end", { color: "brand" }),
					]),
				]}
			>
				Blog
			</a>
		</nav>
	),
} satisfies UtilityExampleModule;
