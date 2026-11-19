/**
 * Holds the cart drawer to its contract in a real browser: the bag link names its count, the
 * drawer lays out lines and a footer, an empty bag shows its message alone, and once hydrated
 * the link opens the drawer in place, following its href when the drawer is absent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { CartDrawer } from "./cart-drawer.js";
import { CartLine } from "./cart-line.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

/** The words every drawer here carries. */
const LABELS = { checkout: "Checkout", viewCart: "View bag", close: "Close bag" };

let mounted: RenderResult | undefined;

afterEach(() => {
	for (let dialog of document.querySelectorAll("dialog")) dialog.close();
	mounted?.cleanup();
	mounted = undefined;
});

/** Waits until a check passes, for an island that attaches after mounting. */
async function until(check: () => boolean, timeout = 2000): Promise<void> {
	let start = performance.now();
	while (!check()) {
		if (performance.now() - start > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

/**
 * Clicks a link and reports whether the page would have followed it, cancelling the
 * navigation either way so the test page stays put.
 */
function clickFollows(link: HTMLAnchorElement): boolean {
	let followed = false;
	let record = (event: Event) => {
		followed = !event.defaultPrevented;
		event.preventDefault();
	};
	window.addEventListener("click", record, { once: true });
	link.click();
	return followed;
}

describe("CartDrawer.Trigger", () => {
	test("links to the cart page, named by its label and count, with a badge", () => {
		mounted = render(<CartDrawer.Trigger drawer="bag" href="/cart" count={2} label="Bag" />);
		let link = mounted.container.querySelector<HTMLAnchorElement>("a")!;
		expect(link.getAttribute("href")).toBe("/cart");
		expect(link.getAttribute("aria-label")).toBe("Bag, 2 items");
		expect(mounted.container.querySelector('[data-slot="cart-drawer-count"]')!.textContent).toBe(
			"2",
		);
	});

	test("hides the badge for an empty bag", () => {
		mounted = render(<CartDrawer.Trigger drawer="bag" href="/cart" count={0} label="Bag" />);
		expect(mounted.container.querySelector('[data-slot="cart-drawer-count"]')).toBeNull();
	});
});

describe("CartDrawer", () => {
	test("opens from its trigger once hydrated, with the lines, subtotal and checkout", async () => {
		mounted = render(
			<div>
				<CartDrawer.Trigger drawer="bag" href="/cart" count={1} label="Bag" />
				<CartDrawer
					id="bag"
					title="Your bag"
					subtotal={
						<>
							<span>Subtotal</span>
							<span>€48.00</span>
						</>
					}
					note="You're €12 away from free shipping"
					checkoutHref="/checkout"
					cartHref="/cart"
					labels={LABELS}
				>
					<ul>
						<CartLine name="Tidepool print" price="€48.00" />
					</ul>
				</CartDrawer>
			</div>,
		);
		let dialog = document.getElementById("bag") as HTMLDialogElement;
		let link = mounted.container.querySelector<HTMLAnchorElement>("a[data-cart-drawer]")!;
		await until(() => mounted!.container.querySelector('[data-slot="cart-drawer-live"]') !== null);
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(clickFollows(link)).toBe(false);
		expect(dialog.open).toBe(true);
		expect(dialog.matches(":modal")).toBe(true);
		expect(dialog.getAttribute("aria-labelledby")).toBe("bag-title");
		expect(document.getElementById("bag-title")!.textContent).toBe("Your bag");
		expect(getComputedStyle(document.getElementById("bag-title")!).textAlign).toBe("start");
		let footer = dialog.querySelector<HTMLElement>('[data-slot="cart-drawer-footer"]')!;
		expect(footer.textContent).toBe(
			"You're €12 away from free shipping" + "Subtotal€48.00CheckoutView bag",
		);
		expect(footer.querySelector('a[href="/checkout"]')).not.toBeNull();
		let style = getComputedStyle(dialog);
		expect(style.right).toBe("0px");
		expect(dialog.offsetWidth).toBe(Math.min(26 * 16, document.documentElement.clientWidth));
		expect(style.paddingTop).toBe("0px");
	});

	test("follows the link when its drawer is not on the page", async () => {
		mounted = render(<CartDrawer.Trigger drawer="missing" href="/cart" count={1} label="Bag" />);
		await until(() => mounted!.container.querySelector('[data-slot="cart-drawer-live"]') !== null);
		await new Promise((resolve) => setTimeout(resolve, 50));
		let link = mounted.container.querySelector<HTMLAnchorElement>("a")!;
		expect(clickFollows(link)).toBe(true);
	});

	test("shows only the empty message for an empty bag", () => {
		mounted = render(
			<CartDrawer
				id="empty-bag"
				title="Your bag"
				empty="Your bag is empty."
				subtotal="€0.00"
				checkoutHref="/checkout"
				cartHref="/cart"
				labels={LABELS}
			/>,
		);
		let dialog = document.getElementById("empty-bag")!;
		expect(dialog.querySelector('[data-slot="cart-drawer-empty"]')!.textContent).toBe(
			"Your bag is empty.",
		);
		expect(dialog.querySelector('[data-slot="cart-drawer-footer"]')).toBeNull();
	});
});
