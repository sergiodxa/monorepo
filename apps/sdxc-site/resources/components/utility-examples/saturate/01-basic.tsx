/**
 * The opening `saturate` example: the same photograph muted and oversaturated, so the
 * reader sees both directions from the untouched `1`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { saturate } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Saturation below and above the untouched `1`. */
export default {
	title: "Basic example",
	description:
		"Use `saturate(n)` to mute an element's colors below `1` or intensify them above `1`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[saturate(0.5), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>saturate(0.5)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[saturate(1.5), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>saturate(1.5)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[saturate(2), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>saturate(2)</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
