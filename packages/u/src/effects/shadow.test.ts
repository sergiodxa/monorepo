/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_BOX_SHADOW } from "../internal/box-shadow";
import { compose } from "../internal/descriptor";
import { declarations } from "../internal/serialize";

import { ringShadow } from "./ring-shadow";
import { shadow } from "./shadow";

describe("shadow", () => {
	test("no-arg defaults to the md shadow, written to the elevation slot", async () => {
		expect(await declarations(shadow())).toEqual([
			"--ui-box-shadow-elevation: var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
		]);
	});

	test("an explicit named shadow", async () => {
		expect(await declarations(shadow("lg"))).toEqual([
			"--ui-box-shadow-elevation: var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
		]);
	});

	test("the base shadow", async () => {
		expect(await declarations(shadow("base"))).toEqual([
			"--ui-box-shadow-elevation: var(--ui-shadow-base, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1))",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
		]);
	});
});

describe("composability with ringShadow", () => {
	test("composing shadow() and ringShadow() together sets both slots under the same composite box-shadow", async () => {
		let merged = compose([shadow("lg"), ringShadow("brand")], (styles) => styles);

		expect(await declarations(merged)).toEqual([
			"--ui-box-shadow-elevation: var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
			"--ui-box-shadow-ring: 0 0 0 2px var(--ui-brand-bg-solid)",
		]);
	});

	test("neither utility's slot depends on which one is composed last", async () => {
		let elevationFirst = await declarations(
			compose([shadow("lg"), ringShadow("brand")], (styles) => styles),
		);
		let ringFirst = await declarations(
			compose([ringShadow("brand"), shadow("lg")], (styles) => styles),
		);

		expect([...ringFirst].sort()).toEqual([...elevationFirst].sort());
	});
});
