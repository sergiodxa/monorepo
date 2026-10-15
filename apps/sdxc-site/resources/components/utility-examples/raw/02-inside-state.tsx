/**
 * A `raw` example inside a state wrapper: book spines set vertically, whose raw writing
 * mode composes with the hover state like any other utility.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { rounded, transition } from "sdxc/u/effects";
import { raw } from "sdxc/u/general";
import { hstack } from "sdxc/u/layout";
import { bs, p } from "sdxc/u/size";
import { hover } from "sdxc/u/state";
import { font, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Vertical book spines that lift on hover. */
export default {
	title: "Composing with states",
	description:
		"A raw mixin goes anywhere a utility does, including state wrappers like `hover()`. Hover a book to pull it from the shelf:",
	render: () => (
		<div mix={[hstack({ gap: 1, align: "end" })]}>
			<div
				mix={[
					raw({ writingMode: "vertical-rl" }),
					bs(48),
					p(3, 2),
					rounded("sm"),
					bg("brand.solid"),
					fg("brand.onSolid"),
					font("serif"),
					weight("semibold"),
					transition("transform"),
					hover(raw({ transform: "translateY(-0.75rem)" })),
				]}
			>
				Moby-Dick
			</div>
			<div
				mix={[
					raw({ writingMode: "vertical-rl" }),
					bs(40),
					p(3, 2),
					rounded("sm"),
					bg("success.solid"),
					fg("success.onSolid"),
					font("serif"),
					weight("semibold"),
					transition("transform"),
					hover(raw({ transform: "translateY(-0.75rem)" })),
				]}
			>
				Middlemarch
			</div>
			<div
				mix={[
					raw({ writingMode: "vertical-rl" }),
					bs(52),
					p(3, 2),
					rounded("sm"),
					bg("warning.solid"),
					fg("warning.onSolid"),
					font("serif"),
					weight("semibold"),
					transition("transform"),
					hover(raw({ transform: "translateY(-0.75rem)" })),
				]}
			>
				War and Peace
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
