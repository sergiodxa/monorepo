/**
 * A `circle` example drawing initials and a count badge, the circular shapes an
 * interface uses besides photographs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { circle, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Initials and a count in circles of different widths. */
export default {
	title: "Initials and badges",
	description: "Any content fits a `circle()`, like an avatar's initials or a notification count:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[circle(), is(16), demo.fill()]}>SX</div>
			<div mix={[circle(), is(12), demo.fill()]}>SX</div>
			<div mix={[circle(), is(6), demo.fill()]}>3</div>
		</div>
	),
} satisfies UtilityExampleModule;
