/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { boxShadowSlot, COMPOSITE_BOX_SHADOW } from "./box-shadow";
import { declarations } from "./serialize";

describe("boxShadowSlot", () => {
	test("sets the given slot's custom property plus the shared composite boxShadow value", async () => {
		expect(await declarations(boxShadowSlot({ elevation: "0 1px 2px rgb(0 0 0 / 0.1)" }))).toEqual([
			"--ui-box-shadow-elevation: 0 1px 2px rgb(0 0 0 / 0.1)",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
		]);
	});

	test("sets multiple slots in one call", async () => {
		expect(
			await declarations(
				boxShadowSlot({ ring: "0 0 0 2px red", elevation: "0 1px 2px rgb(0 0 0 / 0.1)" }),
			),
		).toEqual([
			"--ui-box-shadow-ring: 0 0 0 2px red",
			"--ui-box-shadow-elevation: 0 1px 2px rgb(0 0 0 / 0.1)",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
		]);
	});

	test("every slot's variable appears in the composite with a paints-nothing identity fallback", () => {
		expect(COMPOSITE_BOX_SHADOW).toContain("var(--ui-box-shadow-ring, 0 0 #0000)");
		expect(COMPOSITE_BOX_SHADOW).toContain("var(--ui-box-shadow-elevation, 0 0 #0000)");
	});

	test("the composite is a comma-separated list, so both slots stack as two layers", () => {
		expect(COMPOSITE_BOX_SHADOW).toBe(
			"var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000)",
		);
	});

	test("the ring slot paints before the elevation slot regardless of the call's key order", async () => {
		let ringFirst = await declarations(boxShadowSlot({ ring: "0 0 0 2px red", elevation: "none" }));
		let elevationFirst = await declarations(
			boxShadowSlot({ elevation: "none", ring: "0 0 0 2px red" }),
		);

		expect(ringFirst.filter((line) => line.startsWith("box-shadow:"))).toEqual(
			elevationFirst.filter((line) => line.startsWith("box-shadow:")),
		);
	});
});
