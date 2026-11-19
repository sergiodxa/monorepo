/**
 * Lays out a ledger in a real browser: day headings with their totals, rows that link as a
 * whole, the open record marked, and a long merchant name that truncates before the amount
 * does at 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Amount } from "../components/amount.js";

import { Ledger } from "./ledger.js";

import "../reset.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a two-day ledger in a host `width` pixels wide. */
function mount(width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<Ledger>
			<Ledger.Day title="Today" total={<Amount value={-4740} currency="EUR" />}>
				<Ledger.Entry
					mark={<span style="display:block;inline-size:40px;block-size:40px" />}
					title="Mercado da Ribeira Nova e Mercearia Fina de Alfama"
					meta="Groceries"
					amount={<Amount value={-2340} currency="EUR" sign="ledger" />}
					amountMeta="Split 1/3"
					href="?tx=1"
					current
				/>
				<Ledger.Entry
					title="Café Lumen"
					amount={<Amount value={-2400} currency="EUR" sign="ledger" />}
					href="?tx=2"
				/>
			</Ledger.Day>
			<Ledger.Day title="Mon 16 Nov">
				<Ledger.Entry
					title="Atelier Norte"
					meta="Income"
					amount={<Amount value={210000} currency="EUR" sign="ledger" />}
					muted
				/>
			</Ledger.Day>
		</Ledger>,
		{ container: host },
	);
	return host;
}

describe("Ledger", () => {
	test("heads each day with its title and total, in a heading", () => {
		let host = mount();
		let days = host.querySelectorAll('[data-slot="ledger-day"]');
		expect(days).toHaveLength(2);
		let header = days[0]!.querySelector('[data-slot="ledger-day-header"]')!;
		expect(header.querySelector("h1, h2, h3, h4, h5, h6")?.textContent).toBe("Today");
		expect(header.querySelector('[data-slot="ledger-day-total"]')?.textContent).toBe("−€47.40");
		expect(days[1]!.querySelector('[data-slot="ledger-day-total"]')).toBeNull();
		expect(getComputedStyle(header).position).toBe("sticky");
	});

	test("makes a linked row one link and marks the open record", () => {
		let host = mount();
		let links = host.querySelectorAll("a");
		expect(links).toHaveLength(2);
		expect(links[0]!.getAttribute("href")).toBe("?tx=1");
		expect(links[0]!.getAttribute("aria-current")).toBe("true");
		expect(links[0]!.textContent).toContain("Groceries");
		expect(links[1]!.hasAttribute("aria-current")).toBe(false);
		let plain = host.querySelectorAll('[data-slot="ledger-entry"]')[2]!;
		expect(plain.querySelector("a")).toBeNull();
		expect(getComputedStyle(plain).opacity).toBe("0.6");
	});

	test("truncates a long name and keeps the whole amount on one line at 320px", () => {
		let host = mount(320);
		let entry = host.querySelector<HTMLElement>('[data-slot="ledger-entry"]')!;
		let title = entry.querySelector<HTMLElement>('[data-slot="ledger-title"]')!;
		let amount = entry.querySelector<HTMLElement>('[data-slot="ledger-amount"]')!;
		expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
		expect(amount.getBoundingClientRect().height).toBeLessThan(30);
		expect(amount.getBoundingClientRect().right).toBeLessThanOrEqual(
			host.getBoundingClientRect().right,
		);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});
});
