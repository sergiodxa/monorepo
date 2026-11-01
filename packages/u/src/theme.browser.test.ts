/**
 * Checks in a real browser that the theme's scheme classes set `color-scheme`, so a
 * light-dark() colour under `.dark` or `.system` resolves in the same scheme as the
 * `--ui-*` tokens around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeAll, describe, expect, test } from "vitest";

beforeAll(async () => {
	let link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = new URL("./theme.css", import.meta.url).href;
	let loaded = new Promise((resolve) => link.addEventListener("load", resolve, { once: true }));
	document.head.appendChild(link);
	await loaded;
});

/** Hosts mounted by a test, removed after it so classes never leak between cases. */
let hosts: HTMLElement[] = [];

afterEach(() => {
	for (let host of hosts) host.remove();
	hosts = [];
});

/** Mounts an element with `className` holding a child painted `light-dark(white, black)`. */
function mount(className: string): HTMLElement {
	let host = document.createElement("div");
	host.className = className;
	host.innerHTML = `<span style="color: light-dark(rgb(255, 255, 255), rgb(0, 0, 0))"></span>`;
	document.body.appendChild(host);
	hosts.push(host);
	return host.querySelector("span")!;
}

describe("theme.css", () => {
	test("resolves light-dark() to its dark value under .dark", () => {
		let child = mount("dark");
		expect(getComputedStyle(child).colorScheme).toBe("dark");
		expect(getComputedStyle(child).color).toBe("rgb(0, 0, 0)");
	});

	test("lets .system follow either scheme", () => {
		expect(getComputedStyle(mount("system")).colorScheme).toBe("light dark");
	});

	test("leaves an unclassed page light", () => {
		expect(getComputedStyle(mount("")).color).toBe("rgb(255, 255, 255)");
	});
});
