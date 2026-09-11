/**
 * Pins the shape every consumer reads the package through, compiled — as the whole
 * package is, through `./hostile-globals.d.ts` — under a Worker's own `Element`, so a
 * lookup that drifted back to the ambient DOM is caught here rather than downstream.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { expectTypeOf, test } from "vitest";

import type { DOMElement } from "./lib/dom.js";

import { accessibleName } from "./lib/name.js";
import { roleOf } from "./lib/roles.js";

import type { HTML, HTMLParseError, HTMLQueryError } from "./index.js";

test("the public lookups keep their shape under a consumer's own DOM globals", () => {
	expectTypeOf<typeof HTML.parse>().returns.toEqualTypeOf<Result<HTML, HTMLParseError>>();
	expectTypeOf<HTML["query"]>().returns.toEqualTypeOf<Result<HTML.Element, HTMLQueryError>>();
	expectTypeOf<HTML["queryAll"]>().returns.toEqualTypeOf<HTML.Element[]>();
	expectTypeOf<HTML["title"]>().toEqualTypeOf<string | undefined>();
	expectTypeOf<HTML["text"]>().toEqualTypeOf<string>();

	expectTypeOf<HTML.Element["field"]>().returns.toEqualTypeOf<
		Result<HTML.Element, HTMLQueryError>
	>();
	expectTypeOf<HTML.Element["attributes"]>().toEqualTypeOf<Record<string, string>>();
});

test("a document is read through the package's own DOM vocabulary", () => {
	expectTypeOf<Parameters<typeof roleOf>[0]>().toEqualTypeOf<DOMElement>();
	expectTypeOf<Parameters<typeof accessibleName>[0]>().toEqualTypeOf<DOMElement>();
});
