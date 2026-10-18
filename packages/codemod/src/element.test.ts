/**
 * `addElement` over the two lists a middleware chain is written as: an array literal inside the
 * object a call receives, and a call's own arguments, laid out one per line, inline, or empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { addElement } from "./index.js";

describe("addElement", () => {
	test("appends to an array reached through the object a call receives, one per line", () => {
		let source =
			"let router = createRouter({\n\tmiddleware: [\n\t\tasyncContext(),\n\t\tlog(logger),\n\t],\n});\n";

		let edit = unwrap(
			addElement("router.ts", source, {
				call: "createRouter",
				path: ["middleware"],
				value: "requestId()",
			}),
		);

		expect(edit.source).toBe(
			"let router = createRouter({\n\tmiddleware: [\n\t\tasyncContext(),\n\t\tlog(logger),\n\t\trequestId(),\n\t],\n});\n",
		);
		expect(edit.changed).toBe(true);
	});

	test("appends to a call's arguments, keeping a missing trailing comma missing", () => {
		let source = "export default createMiddleware(\n  formData(),\n  render({ assets })\n);\n";

		let edit = unwrap(addElement("page.ts", source, { call: "createMiddleware", value: "auth()" }));

		expect(edit.source).toBe(
			"export default createMiddleware(\n  formData(),\n  render({ assets }),\n  auth()\n);\n",
		);
	});

	test("appends inline after the last element of a list written on one line", () => {
		let inline = "export default createMiddleware(cors());\n";
		let array = "createRouter({ middleware: [a(), b(),] });\n";

		let call = unwrap(addElement("api.ts", inline, { call: "createMiddleware", value: "auth()" }));
		let literal = unwrap(
			addElement("router.ts", array, { call: "createRouter", path: ["middleware"], value: "c()" }),
		);

		expect(call.source).toBe("export default createMiddleware(cors(), auth());\n");
		expect(literal.source).toBe("createRouter({ middleware: [a(), b(), c(),] });\n");
	});

	test("fills an empty list, on its own line when the brackets span lines", () => {
		let empty = "createRouter({ middleware: [] });\n";
		let call = "export default createMiddleware();\n";
		let open = "createRouter({\n\tmiddleware: [\n\t],\n});\n";

		expect(
			unwrap(
				addElement("a.ts", empty, { call: "createRouter", path: ["middleware"], value: "a()" }),
			).source,
		).toBe("createRouter({ middleware: [a()] });\n");
		expect(
			unwrap(addElement("b.ts", call, { call: "createMiddleware", value: "a()" })).source,
		).toBe("export default createMiddleware(a());\n");
		expect(
			unwrap(addElement("c.ts", open, { call: "createRouter", path: ["middleware"], value: "a()" }))
				.source,
		).toBe("createRouter({\n\tmiddleware: [\n\t\ta(),\n\t],\n});\n");
	});

	test("walks nested object literals and reindents a multi-line value", () => {
		let source = "configure({\n\thttp: {\n\t\tchain: [\n\t\t\ta(),\n\t\t],\n\t},\n});\n";

		let edit = unwrap(
			addElement("config.ts", source, {
				call: "configure",
				path: ["http", "chain"],
				value: "b({\n\tstrict: true,\n})",
			}),
		);

		expect(edit.source).toBe(
			"configure({\n\thttp: {\n\t\tchain: [\n\t\t\ta(),\n\t\t\tb({\n\t\t\t\tstrict: true,\n\t\t\t}),\n\t\t],\n\t},\n});\n",
		);
	});

	test.each([
		["no call to the callee", "other([]);\n", ["middleware"]],
		["no such key", "createRouter({ routes: [] });\n", ["middleware"]],
		["a key that is no array", "createRouter({ middleware: chain });\n", ["middleware"]],
		["no object literal argument", "createRouter();\n", ["middleware"]],
	])("fails with not-found for %s", (_, source, path) => {
		let edit = addElement("router.ts", source, { call: "createRouter", path, value: "a()" });

		expect(isFailure(edit) && edit.error.code).toBe("not-found");
	});
});
