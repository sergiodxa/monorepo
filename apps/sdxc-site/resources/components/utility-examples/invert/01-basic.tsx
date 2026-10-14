/**
 * The opening `invert` example: the same photograph partly and fully inverted, so the
 * reader sees the amount the argument controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invert } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Partial and full inversion on one photograph. */
export default {
	title: "Basic example",
	description:
		"Use `invert(n)` to invert an element's colors, where `invert()` with no argument inverts them fully:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[invert(0.2), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>invert(0.2)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[invert(0.8), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>invert(0.8)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[invert(), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>invert()</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
