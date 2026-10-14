/**
 * Covers how a `@sdxc/u` example becomes the code its page prints, and that the catalogue
 * keeps an example for every utility: a page without one shows a reference with nothing
 * drawn, which is the gap these examples exist to close.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { listUtilityFamilies } from "~/app/services/utilities";
import {
	elideDemo,
	listUtilityExamples,
	readExampleSource,
	slugOf,
	utilitiesWithExamples,
} from "~/app/services/utility-examples";

/** A formatted example module, the shape every file under `utility-examples/` takes. */
const MODULE = `
import { p } from "@sdxc/u/size";

/** Docs. */
export default {
	title: "Basic example",
	description: "Use \`p(n)\` to pad an element, \\"quoted\\":",
	render: () => (
		<div mix={[p(8), demo.stripes()]}>
			<div mix={[demo.box(), demo.caption({ tone: "brand" })]}>p(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
`;

describe("readExampleSource", () => {
	test("reads the title, the description and the dedented render body", () => {
		expect(readExampleSource(MODULE)).toEqual({
			title: "Basic example",
			description: 'Use `p(n)` to pad an element, "quoted":',
			code: "<div mix={[p(8), ...]}>\n\t<div mix={[...]}>p(8)</div>\n</div>",
		});
	});

	test("reads a render that fits on one line", () => {
		let source = `export default {\n\ttitle: "One",\n\tdescription: "Line.",\n\trender: () => <hr mix={[m(4)]} />,\n};`;

		expect(readExampleSource(source).code).toBe("<hr mix={[m(4)]} />");
	});

	test("prints a written code literal in place of an island's render", () => {
		let source = `export default {\n\ttitle: "Island",\n\tdescription: "Live.",\n\tcode: \`<div mix={[hover(bg("brand"))]}>\\\`x\\\`</div>\`,\n\trender: () => <Island />,\n};`;

		expect(readExampleSource(source).code).toBe('<div mix={[hover(bg("brand"))]}>`x`</div>');
	});
});

test("reads a description the formatter rewrote in single quotes", () => {
	let source = `export default {\n\ttitle: "Quotes",\n\tdescription: 'Use \`fill("brand")\` on \\'svg\\':',\n\trender: () => <svg />,\n};`;

	expect(readExampleSource(source).description).toBe(`Use \`fill("brand")\` on 'svg':`);
});

describe("elideDemo", () => {
	test("prints nested demo calls as one mark", () => {
		expect(elideDemo("mix={[gap(4), demo.row(), demo.panel(fn(1))]}")).toBe("mix={[gap(4), ...]}");
	});
});

describe("slugOf", () => {
	test("drops the digits that order a file among its siblings", () => {
		expect(slugOf("01-basic")).toBe("basic");
		expect(slugOf("basic")).toBe("basic");
	});
});

describe("the example catalogue", () => {
	test("holds at least one example for every published utility", async () => {
		let names = (await listUtilityFamilies()).flatMap((family) =>
			family.utilities.map((utility) => utility.name),
		);
		let covered = new Set(utilitiesWithExamples());

		expect(names.filter((name) => !covered.has(name))).toEqual([]);
	});

	test("files examples only under names the catalogue publishes", async () => {
		let names = new Set(
			(await listUtilityFamilies()).flatMap((family) =>
				family.utilities.map((utility) => utility.name),
			),
		);

		expect(utilitiesWithExamples().filter((name) => !names.has(name))).toEqual([]);
	});

	test("gives every example a title, a description and code that calls its utility", async () => {
		let incomplete: string[] = [];

		for (let utility of utilitiesWithExamples()) {
			for (let example of await listUtilityExamples(utility)) {
				let calls = new RegExp(`\\b${utility}\\(`).test(example.code);
				if (!example.title || !example.description || !calls) {
					incomplete.push(`${utility}/${example.slug}`);
				}
			}
		}

		expect(incomplete).toEqual([]);
	});
});
