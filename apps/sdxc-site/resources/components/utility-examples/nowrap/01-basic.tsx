/**
 * The opening `nowrap` example: a sentence kept on one line inside a narrow card, spilling
 * past its edge where it would otherwise have wrapped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "@sdxc/u/size";
import { nowrap } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One line of text overflowing a narrow card instead of wrapping. */
export default {
	title: "Basic example",
	description:
		"Use `nowrap()` to keep text on a single line, letting it overflow its box instead of wrapping:",
	render: () => (
		<div mix={[maxIs(64), demo.panel()]}>
			<p mix={[nowrap()]}>The longest train in the world stretched over seven kilometres.</p>
		</div>
	),
} satisfies UtilityExampleModule;
