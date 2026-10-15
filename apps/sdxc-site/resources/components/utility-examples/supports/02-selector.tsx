/**
 * A `supports` example with a `selector()` query, so a card highlights its checked
 * option only where the browser understands `:has()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border } from "sdxc/u/color";
import { hstack } from "sdxc/u/layout";
import { supports } from "sdxc/u/responsive";
import { has } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A `:has()` highlight gated on selector support. */
export default {
	title: "Testing a selector",
	description:
		'Use `selector(...)` in the query to test a selector, like `supports("selector(:has(*))", ...)`. Check the box:',
	render: () => (
		<label
			mix={[
				hstack({ gap: 3 }),
				border({ color: "neutral.border", width: 1 }),
				supports("selector(:has(*))", has(":checked", bg("brand.tint"))),
				demo.swatch(),
			]}
		>
			<input type="checkbox" />
			Email me a weekly summary
		</label>
	),
} satisfies UtilityExampleModule;
