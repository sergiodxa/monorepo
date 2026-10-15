/**
 * The opening `balance` example: one headline set twice in the same narrow column, so
 * the reader sees balanced wrapping even out the lines a ragged one leaves uneven.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { balance, text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A headline with and without balanced wrapping, at the same width. */
export default {
	title: "Basic example",
	description: "Use `balance()` to distribute the text evenly across each line of a heading:",
	render: () => (
		<div mix={[maxIs(80), demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>balance()</p>
				<h3 mix={[balance(), text("2xl"), weight("bold")]}>
					City council approves a riverside bike lane after two years of heated debate
				</h3>
			</div>
			<div>
				<p mix={[demo.caption()]}>default wrapping</p>
				<h3 mix={[text("2xl"), weight("bold")]}>
					City council approves a riverside bike lane after two years of heated debate
				</h3>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
