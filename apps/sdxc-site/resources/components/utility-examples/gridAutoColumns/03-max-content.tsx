/**
 * A `gridAutoColumns` example with `"max-content"`, so each implicit column is exactly as
 * wide as the widest thing in it, like the links of a navigation bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoColumns, gridAutoFlow } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Implicit columns each as wide as their content. */
export default {
	title: "Sizing to content",
	description:
		'Use `gridAutoColumns("max-content")` to make each implicit column as wide as its content:',
	render: () => (
		<nav mix={[grid(), gridAutoFlow("column"), gridAutoColumns("max-content"), gap(4)]}>
			<a href="/" mix={[demo.block()]}>
				Home
			</a>
			<a href="/docs" mix={[demo.block()]}>
				Documentation
			</a>
			<a href="/api" mix={[demo.block()]}>
				API
			</a>
		</nav>
	),
} satisfies UtilityExampleModule;
