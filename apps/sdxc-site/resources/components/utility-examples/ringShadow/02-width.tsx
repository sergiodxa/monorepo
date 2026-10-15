/**
 * A `ringShadow` example at three widths, so the reader sees the second argument set the
 * ring's thickness in pixels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ringShadow } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Selection rings at three widths. */
export default {
	title: "Changing the width",
	description:
		"Pass a width as the second argument, in pixels or any CSS length; it's `2` by default:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.figure()]}>
				<img mix={[ringShadow("brand", 1), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>ringShadow("brand", 1)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[ringShadow("brand", 4), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>ringShadow("brand", 4)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[ringShadow("brand", "0.5rem"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>ringShadow("brand", "0.5rem")</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
