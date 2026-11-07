/**
 * Tests the landing's sounds in a real browser: a reader flipping a deck card or picking a
 * tour step plays an effect, while the tour advancing on its own stays silent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { EncorePageSounds } from "~/resources/components/encore-page-sounds";

/** What the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

/** The real `createBufferSource`, which every played effect calls once. */
const CREATE: (this: AudioContext) => AudioBufferSourceNode =
	// oxlint-disable-next-line typescript/unbound-method -- Kept to restore the prototype after each test and called with its `this`.
	AudioContext.prototype.createBufferSource;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	AudioContext.prototype.createBufferSource = CREATE;
	document.body.innerHTML = "";
});

/** Waits for the island to mount its listeners. */
function frame(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 50));
}

describe("EncorePageSounds", () => {
	test("plays for the reader's own flips and picks, never for the tour's autoplay", async () => {
		let played = 0;
		AudioContext.prototype.createBufferSource = function count(this: AudioContext) {
			played++;
			return CREATE.call(this);
		};
		document.body.insertAdjacentHTML(
			"beforeend",
			`<section id="deck"><label><input type="checkbox" id="card" /></label></section>
			<div data-tour=""><input type="radio" name="round" id="one" /><input type="radio" name="round" id="two" /></div>`,
		);
		mounted = render(<EncorePageSounds />);
		await frame();

		document.querySelector<HTMLInputElement>("#card")?.click();
		document.querySelector<HTMLInputElement>("#card")?.click();
		expect(played).toBe(2);

		let two = document.querySelector<HTMLInputElement>("#two");
		if (two) two.checked = true;
		expect(played).toBe(2);

		document.querySelector<HTMLInputElement>("#one")?.click();
		expect(played).toBe(3);
	});
});
