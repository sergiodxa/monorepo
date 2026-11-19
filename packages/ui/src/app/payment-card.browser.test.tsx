/**
 * Draws payment cards in a real browser: the ID-1 ratio at any width, the masked number that
 * names only its last four digits, the chip or "Virtual" tag, and the frosted frozen state
 * that the card's accessible name also carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { Handle } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { PaymentCard } from "./payment-card.js";

import "../reset.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts `node` in a host `width` pixels wide and returns the card. */
function mount(node: JSX.Element, width = 360): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(node, { container: host });
	return host.querySelector<HTMLElement>('[data-slot="payment-card"]')!;
}

/** A physical debit card with every printed field. */
function Everyday(handle: Handle<{ frozen?: boolean }>) {
	return () => (
		<PaymentCard
			label="Everyday card ending 4821"
			brand="Tuppence"
			last4="4821"
			holder="Noor Halvorsen"
			expires="09/29"
			network="debit"
			frozen={handle.props.frozen}
		/>
	);
}

describe("PaymentCard", () => {
	for (let width of [240, 360]) {
		test(`keeps the card ratio and one-line number at ${width}px`, () => {
			let card = mount(<Everyday />, width);
			let box = card.getBoundingClientRect();
			expect(box.width).toBe(width);
			expect(box.width / box.height).toBeCloseTo(85.6 / 53.98, 1);
			let number = card.querySelector<HTMLElement>('[data-slot="payment-card-number"]')!;
			expect(number.getBoundingClientRect().height).toBeLessThan(box.height / 4);
			expect(number.getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
		});
	}

	test("names the card and reads the number as its last four digits", () => {
		let card = mount(<Everyday />);
		expect(card.getAttribute("role")).toBe("group");
		expect(card.getAttribute("aria-label")).toBe("Everyday card ending 4821");
		let number = card.querySelector<HTMLElement>('[data-slot="payment-card-number"]')!;
		expect(number.textContent).toContain("4821");
		expect(number.querySelector('[aria-hidden="true"]')?.textContent).toContain("••••");
		expect(card.querySelector('[data-slot="payment-card-chip"]')).not.toBeNull();
	});

	test("shows a Virtual tag in place of the chip on a virtual card", () => {
		let card = mount(
			<PaymentCard
				label="Online card ending 0937"
				brand="Tuppence"
				last4="0937"
				holder="Noor Halvorsen"
				expires="03/27"
				network="debit"
				kind="virtual"
				tone="ink"
			/>,
		);
		expect(card.querySelector('[data-slot="payment-card-chip"]')).toBeNull();
		expect(card.querySelector('[data-slot="payment-card-virtual"]')?.textContent).toBe("Virtual");
	});

	test("frosts a frozen card and says so in its name", () => {
		let card = mount(<Everyday frozen />);
		expect(card.hasAttribute("data-frozen")).toBe(true);
		expect(card.getAttribute("aria-label")).toBe("Everyday card ending 4821, frozen");
		expect(card.querySelector('[data-slot="payment-card-frozen"]')?.textContent).toBe("Frozen");
		let face = card.querySelector<HTMLElement>('[data-slot="payment-card-face"]')!;
		expect(getComputedStyle(face).filter).toContain("grayscale");
	});
});
