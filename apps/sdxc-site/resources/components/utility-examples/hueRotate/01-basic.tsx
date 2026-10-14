/**
 * The opening `hueRotate` example: the same photograph turned around the color wheel by
 * a few angles, so the reader sees lightness hold while hue moves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hueRotate } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Hue rotation in degrees, positive and negative. */
export default {
	title: "Basic example",
	description:
		"Use `hueRotate(n)` to rotate every color of an element around the color wheel by `n` degrees:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[hueRotate(-60), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>hueRotate(-60)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[hueRotate(90), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>hueRotate(90)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[hueRotate(180), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>hueRotate(180)</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
