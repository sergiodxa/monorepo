/**
 * The opening `colorScheme` example: the same native controls in a light and a dark
 * scheme, so a reader sees the browser repaint the parts it draws itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, colorScheme, fg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Native controls in a light and in a dark scheme. */
export default {
	title: "Basic example",
	description:
		"Use `colorScheme` to tell the browser which scheme an element renders in, so the controls, scrollbars and system colors it paints follow it:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					colorScheme("light"),
					bg("Canvas"),
					fg("CanvasText"),
					rounded("lg"),
					p(4),
					demo.stack(),
				]}
			>
				<input type="text" value="light" aria-label="Light field" />
				<select aria-label="Light select">
					<option>Option</option>
				</select>
			</div>
			<div
				mix={[
					colorScheme("dark"),
					bg("Canvas"),
					fg("CanvasText"),
					rounded("lg"),
					p(4),
					demo.stack(),
				]}
			>
				<input type="text" value="dark" aria-label="Dark field" />
				<select aria-label="Dark select">
					<option>Option</option>
				</select>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
