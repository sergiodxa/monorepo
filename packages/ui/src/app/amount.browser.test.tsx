/**
 * Formats amounts in a real browser: each currency's own decimals, the true minus, the
 * ledger sign and its tone, smaller cents and the machine-readable value, so a list of
 * mixed currencies reads right in any locale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Amount, currencyExponent, formatAmount } from "./amount.js";

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

describe("formatAmount", () => {
	test("reads each currency's own decimals from the platform", () => {
		expect(currencyExponent("EUR")).toBe(2);
		expect(currencyExponent("JPY")).toBe(0);
		expect(currencyExponent("BHD")).toBe(3);
		expect(formatAmount(128000, "JPY")).toBe("¥128,000");
		expect(formatAmount(1234, "BHD", { display: "code" })).toBe("BHD 1.234");
	});

	test("writes a negative amount with a true minus", () => {
		expect(formatAmount(-129900, "EUR", { locale: "en-IE" })).toBe("−€1,299.00");
	});

	test("follows the locale's grouping and symbol position", () => {
		expect(formatAmount(129950, "EUR", { locale: "de-DE" })).toBe("1.299,50 €");
	});

	test("ledger marks money in and shows money out as a plain figure", () => {
		expect(formatAmount(4500, "GBP", { sign: "ledger" })).toBe("+£45.00");
		expect(formatAmount(-4500, "GBP", { sign: "ledger" })).toBe("£45.00");
		expect(formatAmount(-4500, "GBP", { sign: "always" })).toBe("−£45.00");
		expect(formatAmount(-4500, "GBP", { sign: "never" })).toBe("£45.00");
	});

	test("abbreviates a large amount in compact notation", () => {
		expect(formatAmount(1250000, "USD", { compact: true })).toBe("$12.5K");
	});
});

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
