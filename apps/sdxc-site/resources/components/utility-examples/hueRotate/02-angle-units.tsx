/**
 * A `hueRotate` example with angle strings, for turns and radians, which pass through
 * exactly as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hueRotate } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Hue rotation written in turns and radians. */
export default {
	title: "Using other angle units",
	description:
		'Pass a string to use any CSS angle unit, like `hueRotate("0.5turn")` or `hueRotate("1rad")`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[hueRotate("0.25turn"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>hueRotate("0.25turn")</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[hueRotate("0.5turn"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>hueRotate("0.5turn")</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[hueRotate("1rad"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>hueRotate("1rad")</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
