/**
 * Test-only helpers that render a utility mixin through `remix/ui`'s server
 * renderer and hand back the CSS text it actually produced, so a test can
 * assert on the declarations a browser will see instead of on the style tree
 * the mixin was built from. The two differ: the serializer rewrites values on
 * the way out (most notably it appends `px` to unitless numbers), so a green
 * assertion against the style tree can sit on top of broken CSS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { renderToString } from "remix/ui/server";

import type { UtilityMixin } from "./descriptor";

/**
 * Renders `mixin` on a bare `<div>` and returns every `<style>` tag's contents
 * joined together — the full stylesheet, including the wrapping `@layer`,
 * class selector, and any nested selector or at-rule blocks.
 */
export async function serialize(mixin: UtilityMixin): Promise<string> {
	let html = await renderToString(<div mix={mixin} />);
	return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");
}

/**
 * Renders `mixin` and returns its declarations as `"property: value"` strings,
 * flattened across nested blocks and normalized to single spaces. This is the
 * assertion surface for "what CSS does this mixin actually emit" — prefer it
 * over reading `descriptor.args[0]`, which shows the input, not the output.
 *
 * @example expect(await declarations(lineClamp(3))).toContain("-webkit-line-clamp: 3")
 */
export async function declarations(mixin: UtilityMixin): Promise<string[]> {
	let css = await serialize(mixin);
	return css
		.split(";")
		.map((part) =>
			part
				.replace(/[\s\S]*[{}]/, "")
				.replace(/\s+/g, " ")
				.trim(),
		)
		.filter((part) => part.includes(":"));
}
