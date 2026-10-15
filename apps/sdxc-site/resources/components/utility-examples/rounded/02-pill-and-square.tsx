/**
 * A `rounded` example at both ends of the radius scale: square corners and a pill, the
 * two shapes a radius scale most often reaches for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Square corners and a fully rounded pill. */
export default {
	title: "Square and pill shapes",
	description:
		'Use `rounded("none")` for square corners and `rounded("full")` for pills and circles:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[rounded("none"), demo.shape()]}>rounded("none")</div>
			<div mix={[rounded("full"), demo.shape()]}>rounded("full")</div>
		</div>
	),
} satisfies UtilityExampleModule;
