/**
 * The opening `grayscale` example: the same photograph partly and fully desaturated, so
 * the reader sees what the amount controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { grayscale } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Partial and full grayscale on one photograph. */
export default {
	title: "Basic example",
	description:
		"Use `grayscale(n)` to desaturate an element toward grey, where `grayscale()` with no argument is fully grey:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[grayscale(0.25), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>grayscale(0.25)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[grayscale(0.5), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>grayscale(0.5)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[grayscale(), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>grayscale()</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
