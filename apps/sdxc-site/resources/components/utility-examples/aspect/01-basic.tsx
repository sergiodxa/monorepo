/**
 * The opening `aspect` example: a photograph given a 16:9 frame from a width and a
 * height, so its height follows from the width it is given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { aspect, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A width/height pair sets the ratio a box keeps at any width. */
export default {
	title: "Basic example",
	description:
		"Use `aspect(width, height)` to give an element a fixed aspect ratio, like `aspect(16, 9)` for a video frame:",
	render: () => <div mix={[aspect(16, 9), is(80), demo.photo()]} />,
} satisfies UtilityExampleModule;
