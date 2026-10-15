/**
 * The opening `blur` example: one photograph at each step of the blur scale, so the
 * reader sees how far each named step softens the same detail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { blur } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Each named step of the blur scale applied to the same photograph. */
export default {
	title: "Basic example",
	description:
		'Use `blur("sm")`, `blur("md")` or `blur("lg")` to blur an element by a step of the blur scale:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[blur("sm"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>blur("sm")</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[blur("md"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>blur("md")</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[blur("lg"), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>blur("lg")</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
