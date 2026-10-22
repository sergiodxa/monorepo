/**
 * The source text scaffold renders for each field: string literals spliced into generated code
 * stay inert even when a label carries characters that would close a script or break a line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { parseFields } from "./fields.js";
import { flagProperties } from "./render.js";

describe("flagProperties", () => {
	test("escapes a label's angle brackets and line separators in the generated literal", () => {
		let [field] = unwrap(parseFields(["title"]));
		if (field === undefined) throw new Error("parseFields returned no field");
		let [line] = flagProperties([{ ...field, label: "</script>\u2028" }], "flag");

		expect(line).toBe(
			'\ttitle: flag.string("title", { required: true, description: "\\u003C/script\\u003E\\u2028" }),',
		);
	});
});
