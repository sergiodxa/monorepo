/**
 * Type-level checks that `<select>` accepts the same `mix` values as other elements under
 * the Workers runtime types; `bun typecheck` fails here if the `Element` merge regresses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { p } from "@sdxc/u/size";
import { css } from "remix/component";
import { renderToString } from "remix/component/server";
import { describe, expect, expectTypeOf, test } from "vitest";

describe("HTMLSelectElement under the Workers runtime types", () => {
	test("is an Element", () => {
		expectTypeOf<HTMLSelectElement>().toExtend<Element>();
	});

	test("takes @sdxc/u and css() mixins in its mix prop", async () => {
		let html = await renderToString(
			<select mix={[p(2), css({ inlineSize: "10rem" })]}>
				<option>One</option>
			</select>,
		);

		expect(html).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 2);");
	});
});
