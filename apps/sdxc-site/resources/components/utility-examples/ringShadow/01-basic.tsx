/**
 * The opening `ringShadow` example: a selection ring in three tones around the same
 * thumbnail, so the reader sees the tone pick the ring's color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ringShadow } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Selection rings in three theme tones. */
export default {
	title: "Basic example",
	description:
		"Use `ringShadow(tone)` to draw a solid ring around an element, like a persistently selected thumbnail:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.figure()]}>
				<img mix={[ringShadow("brand"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>ringShadow("brand")</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[ringShadow("success"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>ringShadow("success")</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[ringShadow("danger"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>ringShadow("danger")</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
