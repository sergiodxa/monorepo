/**
 * The opening `contrast` example: the same photograph flattened toward grey and pushed
 * away from it, so the reader sees both directions of the scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contrast } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Contrast below and above the untouched `1`. */
export default {
	title: "Basic example",
	description:
		"Use `contrast(n)` to push an element's colors away from mid-grey above `1`, or toward it below `1`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[contrast(0.5), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>contrast(0.5)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[contrast(1.25), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>contrast(1.25)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[contrast(2), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>contrast(2)</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
