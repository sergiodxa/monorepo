/**
 * A catalog-wide guard against one silent CSS failure: `remix/ui`'s style
 * serializer only treats a nested style-tree key as a selector when it leads
 * with `&`, `@`, `:`, `[` or `.` — every other key falls through to the
 * declaration path and serializes as `key: [object Object]`, which browsers
 * drop without a word. That string is the whole bug class's fingerprint, so
 * rendering every exported component and asserting it never appears catches
 * each future instance with one assertion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { jsx } from "remix/ui/jsx-runtime";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import * as catalog from "./index";

/**
 * The fingerprint every instance of this bug class leaves in the stylesheet:
 * a nested block stringified as a declaration value.
 */
const FINGERPRINT = "[object Object]";

/**
 * Props handed to every probe render. Compound members that read required
 * data off their own props (a chart series, a selectable item's value) throw
 * before emitting any CSS otherwise, which would quietly shrink the sweep.
 */
const PROBE_PROPS = {
	value: "a",
	data: [{ label: "a", value: 1, x: 1, y: 1 }],
	children: "probe",
};

/**
 * Anything exported under a PascalCase name is a component; the catalog also
 * exports camelCase helpers (mix builders, context readers) that are not
 * renderable and carry no styles of their own.
 */
function isComponent(name: string, value: unknown): value is Function {
	return typeof value === "function" && /^[A-Z]/.test(name);
}

/**
 * Renders `element` and returns the CSS text of every `<style>` tag it
 * emitted, or `null` when the component needs an ancestor for context;
 * callers use `null` as a signal to retry through a different wrapper.
 */
async function styleOf(element: unknown): Promise<string | null> {
	try {
		let html = await renderToString(element as never);
		return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
			.map((match) => match[1])
			.join("\n");
	} catch {
		return null;
	}
}

describe("component catalog CSS", () => {
	let roots = Object.entries(catalog).filter(([name, value]) => isComponent(name, value));

	test("exports a catalog large enough for this sweep to mean anything", () => {
		expect(roots.length).toBeGreaterThan(50);
	});

	for (let [name, root] of roots) {
		let members = Object.entries(root).filter(([key, value]) => isComponent(key, value));

		test(`${name} emits no stringified style block`, async () => {
			let css = await styleOf(jsx(root as never, { ...PROBE_PROPS }));

			expect(css).not.toBeNull();
			expect(css).not.toContain(FINGERPRINT);
		});

		for (let [key, member] of members) {
			test(`${name}.${key} emits no stringified style block`, async () => {
				/**
				 * Tries `member` under its own root, then wrapped by each sibling in
				 * turn, since its real parent may be any one of them; the assertions
				 * below fail for a member that renders in none, keeping the sweep honest.
				 */
				let wrappers = [
					jsx(root as never, {
						...PROBE_PROPS,
						children: jsx(member as never, { ...PROBE_PROPS }),
					}),
					...members
						.filter(([siblingKey]) => siblingKey !== key)
						.map(([, sibling]) =>
							jsx(root as never, {
								...PROBE_PROPS,
								children: jsx(sibling as never, {
									...PROBE_PROPS,
									children: jsx(member as never, { ...PROBE_PROPS }),
								}),
							}),
						),
				];

				let css: string | null = null;
				for (let wrapper of wrappers) {
					css = await styleOf(wrapper);
					if (css !== null) break;
				}

				expect(css).not.toBeNull();
				expect(css).not.toContain(FINGERPRINT);
			});
		}
	}
});
