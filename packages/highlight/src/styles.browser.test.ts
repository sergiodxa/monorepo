/**
 * Paints tokens with the stylesheet in a real browser and reads their computed colour, so the
 * defaults are proven to follow the `color-scheme` of the block's element: a page forced light
 * keeps the light palette whatever the operating system prefers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeAll, describe, expect, test } from "vitest";

beforeAll(async () => {
	let link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = new URL("../styles.css", import.meta.url).href;
	let loaded = new Promise((resolve) => link.addEventListener("load", resolve, { once: true }));
	document.head.appendChild(link);
	await loaded;
});

/** Hosts mounted by a test, removed after it so schemes never leak between cases. */
let hosts: HTMLElement[] = [];

afterEach(() => {
	for (let host of hosts) host.remove();
	hosts = [];
});

/** Mounts a `language-ts` block in `scheme` and returns its string token and its code element. */
function mount(scheme: string): { code: HTMLElement; token: HTMLElement } {
	let host = document.createElement("div");
	host.style.colorScheme = scheme;
	host.innerHTML = `<pre><code class="language-ts">let a = <span class="token string">"a"</span>;</code></pre>`;
	document.body.appendChild(host);
	hosts.push(host);
	return { code: host.querySelector("code")!, token: host.querySelector(".token")! };
}

describe("styles.css", () => {
	test("paints the light palette in a light scheme", () => {
		let { code, token } = mount("light");
		expect(getComputedStyle(token).color).toBe("rgb(3, 47, 98)");
		expect(getComputedStyle(code).color).toBe("rgb(36, 41, 47)");
	});

	test("paints the dark palette in a dark scheme", () => {
		let { code, token } = mount("dark");
		expect(getComputedStyle(token).color).toBe("rgb(165, 214, 255)");
		expect(getComputedStyle(code).color).toBe("rgb(230, 237, 243)");
	});

	test("resolves each block against its own element's scheme", () => {
		let light = mount("light");
		let dark = mount("dark");
		expect(getComputedStyle(light.token).color).not.toBe(getComputedStyle(dark.token).color);
	});
});
