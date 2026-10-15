/**
 * A `blur` example with raw CSS lengths, for a softness that falls between the named
 * steps of the blur scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { blur } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Raw lengths passed straight through as the blur radius. */
export default {
	title: "Using a custom value",
	description: 'Pass any CSS length, like `blur("2px")`, when no step of the scale fits:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[blur("1px"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>blur("1px")</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[blur("2px"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>blur("2px")</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[blur("40px"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>blur("40px")</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
