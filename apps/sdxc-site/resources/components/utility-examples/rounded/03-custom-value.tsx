/**
 * A `rounded` example with raw CSS lengths, for a radius that falls between the named
 * steps of the scale or matches a value from a design file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Raw lengths passed straight through as the corner radius. */
export default {
	title: "Using a custom value",
	description:
		'Pass any CSS length, like `rounded("6px")` or `rounded("2rem")`, when no step of the scale fits:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[rounded("6px"), demo.shape()]}>rounded("6px")</div>
			<div mix={[rounded("2rem"), demo.shape()]}>rounded("2rem")</div>
		</div>
	),
} satisfies UtilityExampleModule;
