/**
 * Tests the honeypot fields by rendering them: the token as a hidden input, the trap reachable
 * by neither keyboard, assistive technology nor autofill, and the rendered names a verify accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isSuccess, unwrap } from "@sdxc/result";
import { renderToString } from "remix/ui/server";
import { expect, test } from "vitest";

import { HoneypotFields } from "./ui.js";

import { Honeypot } from "./index.js";

/** Fixed fields, so assertions can name exact attributes. */
const FIELDS = { tokenField: "hp-token", token: "payload.signature", trapField: "hp_abcdefgh" };

test("renders the token as a hidden input", async () => {
	let html = await renderToString(<HoneypotFields {...FIELDS} />);
	expect(html).toContain('<input type="hidden" name="hp-token" value="payload.signature"');
});

test("keeps the trap away from keyboards, assistive technology and autofill", async () => {
	let html = await renderToString(<HoneypotFields {...FIELDS} />);

	expect(html).toMatch(/<div aria-hidden="true" inert class="[^"]+">/);
	expect(html).toContain('name="hp_abcdefgh"');
	expect(html).toContain('tabindex="-1"');
	expect(html).toContain('autocomplete="off"');
	expect(html).toContain("data-1p-ignore");
	expect(html).toContain('data-lpignore="true"');
	expect(html).toContain("data-bwignore");
	expect(html).toContain('data-form-type="other"');
});

test("moves the trap off-screen instead of hiding it", async () => {
	let html = await renderToString(<HoneypotFields {...FIELDS} />);
	expect(html).toContain("inset-inline-start: -10000px");
	expect(html).not.toContain("display: none");
	expect(html).not.toContain('type="hidden" name="hp_abcdefgh"');
});

test("labels the trap, with a configurable label", async () => {
	expect(await renderToString(<HoneypotFields {...FIELDS} />)).toContain(
		'<label for="hp_abcdefgh">Leave this field empty</label>',
	);
	expect(await renderToString(<HoneypotFields {...FIELDS} label="Do not fill" />)).toContain(
		">Do not fill</label>",
	);
});

test("renders field names that verify as an untouched form", async () => {
	let honeypot = new Honeypot({ secret: "s3cret" });
	let fields = unwrap(await honeypot.issue());
	let html = await renderToString(<HoneypotFields {...fields} />);

	let form = new FormData();
	for (let [, name, value] of html.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)) {
		form.set(name ?? "", value ?? "");
	}

	expect(form.has(fields.trapField)).toBe(true);
	expect(isSuccess(await honeypot.verify(form))).toBe(true);
});
