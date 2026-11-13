/**
 * Holds every demo landing's posting forms to one contract: the action ends in the id of a
 * status note on the page, hidden until the address names it and shown once it does. The example endpoint's
 * redirect keeps that fragment, so a reader with no script lands on the note after sending.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { findDemoLanding, listDemoSlugs } from "~/resources/views/demos";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("demo landing forms", () => {
	test.each(listDemoSlugs())(
		"%s confirms every post on the note its action names",
		async (slug) => {
			let demo = await findDemoLanding(slug);
			if (!demo) throw new Error(`missing demo ${slug}`);
			mounted = render(demo.render(new URL(`https://sdxc.dev/demo/${slug}`)));

			for (let form of mounted.container.querySelectorAll<HTMLFormElement>('form[method="post"]')) {
				let action = form.getAttribute("action") ?? "";
				let hash = action.split("#")[1];
				expect(hash, action).toBeTruthy();
				let note = document.getElementById(hash ?? "");
				expect(note, action).not.toBeNull();
				expect(note?.getAttribute("role")).toBe("status");
				expect(getComputedStyle(note!).display).toBe("none");
				location.hash = hash ?? "";
				expect(getComputedStyle(note!).display, action).not.toBe("none");
				history.replaceState(null, "", location.pathname + location.search);
			}
		},
	);
});
