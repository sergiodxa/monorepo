/**
 * Holds `typewriterText()` to its contract in a real browser: the typewriter's highlight paints
 * transparent with no shadow on the host and on the elements inside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { TYPEWRITER_HIGHLIGHT } from "../utils/typewriter.js";

import { typewriterText } from "./typewriter-text.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe(typewriterText, () => {
	test("paints the unrevealed text transparent in the host and inside it", () => {
		let host = document.createElement("div");
		document.body.appendChild(host);
		mounted = render(
			<p mix={[typewriterText()]} style={{ textShadow: "0 0 2px red" }}>
				Hello <b>there</b>
			</p>,
			{ container: host },
		);
		for (let element of [mounted.$("p")!, mounted.$("b")!]) {
			let style = getComputedStyle(element, `::highlight(${TYPEWRITER_HIGHLIGHT})`);
			expect(style.color).toBe("rgba(0, 0, 0, 0)");
			expect(style.textShadow).toBe("none");
		}
	});
});
