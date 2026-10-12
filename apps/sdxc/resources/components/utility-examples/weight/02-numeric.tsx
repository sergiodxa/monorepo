/**
 * A `weight` example with numbers between the named steps, which a variable font draws
 * as weights of their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One word at four weights between the named steps. */
export default {
	title: "Numeric weights",
	description:
		"Pass a number from 1 to 1000, like `weight(550)`, for a weight between the named steps when the font is variable:",
	render: () => (
		<div mix={[demo.row()]}>
			<div>
				<p mix={[demo.caption()]}>weight(350)</p>
				<p mix={[weight(350), text("3xl")]}>Aa</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>weight(450)</p>
				<p mix={[weight(450), text("3xl")]}>Aa</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>weight(550)</p>
				<p mix={[weight(550), text("3xl")]}>Aa</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>weight(650)</p>
				<p mix={[weight(650), text("3xl")]}>Aa</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>weight(750)</p>
				<p mix={[weight(750), text("3xl")]}>Aa</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
