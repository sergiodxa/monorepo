/**
 * Draws amounts in a real browser: the machine-readable value, tabular unwrapped figures,
 * the ledger sign's tone, and smaller cents that leave the text whole, yen included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Amount } from "./amount.js";

import "../reset.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts `node` and returns the amount element. */
function mount(node: JSX.Element): HTMLDataElement {
	let host = document.createElement("div");
	document.body.appendChild(host);
	mounted = render(node, { container: host });
	return host.querySelector<HTMLDataElement>('[data-slot="amount"]')!;
}

describe("Amount", () => {
	test("carries the decimal figure as its machine-readable value", () => {
		let amount = mount(<Amount value={-1299} currency="EUR" />);
		expect(amount.tagName).toBe("DATA");
		expect(amount.value).toBe("-12.99");
		expect(amount.textContent).toBe("−€12.99");
		expect(amount.dataset.direction).toBe("out");
		expect(getComputedStyle(amount).fontVariantNumeric).toBe("tabular-nums");
		expect(getComputedStyle(amount).whiteSpace).toBe("nowrap");
	});

	test("tones money in on a ledger and leaves money out in the text color", () => {
		document.documentElement.style.setProperty("--ui-success-fg", "rgb(0, 128, 0)");
		let credit = mount(<Amount value={4500} currency="EUR" sign="ledger" />);
		expect(credit.hasAttribute("data-credit")).toBe(true);
		expect(getComputedStyle(credit).color).toBe("rgb(0, 128, 0)");
		mounted?.cleanup();
		document.body.replaceChildren();
		let debit = mount(<Amount value={-4500} currency="EUR" sign="ledger" />);
		expect(debit.hasAttribute("data-credit")).toBe(false);
		expect(getComputedStyle(debit).color).not.toBe("rgb(0, 128, 0)");
		document.documentElement.removeAttribute("style");
	});

	test("sets the decimals smaller for a balance and keeps the whole text intact", () => {
		let amount = mount(<Amount value={1284056} currency="EUR" smallMinor />);
		expect(amount.textContent).toBe("€12,840.56");
		let minor = [...amount.querySelectorAll<HTMLElement>('[data-slot="amount-minor"]')];
		expect(minor.map((part) => part.textContent).join("")).toBe(".56");
		let whole = Number.parseFloat(getComputedStyle(amount).fontSize);
		expect(Number.parseFloat(getComputedStyle(minor[1]!).fontSize)).toBeLessThan(whole);
	});

	test("draws yen without a fraction even with smaller decimals asked for", () => {
		let amount = mount(<Amount value={128000} currency="JPY" smallMinor />);
		expect(amount.value).toBe("128000");
		expect(amount.textContent).toBe("¥128,000");
		expect(amount.querySelector('[data-slot="amount-minor"]')).toBeNull();
	});
});
