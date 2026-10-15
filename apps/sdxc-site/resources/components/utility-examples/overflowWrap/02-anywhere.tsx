/**
 * An `overflowWrap` example inside a flex row, where `"break-word"` still lets a long hash
 * hold the item wide and `"anywhere"` lets it shrink to the row and wrap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "sdxc/u/layout";
import { maxIs } from "sdxc/u/size";
import { font, overflowWrap, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A commit hash in a flex row, under each of the two breaking values. */
export default {
	title: "Breaking anywhere",
	description:
		'A flex or grid item sizes itself from its longest word, so use `overflowWrap("anywhere")` to let it shrink and wrap where `overflowWrap("break-word")` would overflow:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[hstack({ gap: 2 }), maxIs(64), demo.panel()]}>
				<span mix={[weight("semibold")]}>Commit</span>
				<span mix={[overflowWrap("anywhere"), font("mono")]}>
					9f2c4e7a1b3d5f60c8e2a4b6d8f0e1c3a5b7d9f1
				</span>
			</div>
			<div mix={[hstack({ gap: 2 }), maxIs(64), demo.panel()]}>
				<span mix={[weight("semibold")]}>Commit</span>
				<span mix={[overflowWrap("break-word"), font("mono")]}>
					9f2c4e7a1b3d5f60c8e2a4b6d8f0e1c3a5b7d9f1
				</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
