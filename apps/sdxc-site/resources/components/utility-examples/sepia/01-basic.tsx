/**
 * The opening `sepia` example: the same photograph partly and fully toned, so the reader
 * sees how the amount moves it toward warm brown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { sepia } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Partial and full sepia on one photograph. */
export default {
	title: "Basic example",
	description:
		"Use `sepia(n)` to tone an element toward a warm brown monochrome, where `sepia()` with no argument converts it fully:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[sepia(0.25), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>sepia(0.25)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[sepia(0.5), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>sepia(0.5)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[sepia(), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>sepia()</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
