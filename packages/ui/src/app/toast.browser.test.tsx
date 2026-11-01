/**
 * Runs the toast stack in a real browser: a flash toast from server HTML shows and
 * closes without JavaScript, hydration adopts the same element and only then starts
 * its timer, the stack caps and peeks then fans out on hover, and promises update in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { AppRuntime } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { run } from "remix/component";
import { renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { pageToaster, Toast, TOAST_UNDO_DURATION, Toasts } from "./toast.js";

import "../reset.css";

const LABELS: Toast.Labels = { region: "Notifications", dismiss: "Dismiss" };

const FLASH: Toast.Flash = {
	id: "flash-1",
	color: "success",
	title: "Monitor deleted",
	duration: 300,
	action: { label: "Undo", form: { action: "/monitors/restore", fields: { id: "m_42" } } },
};

let mounted: RenderResult | undefined;
let app: AppRuntime | undefined;

beforeEach(async () => {
	await page.viewport(1280, 800);
	await parkPointer();
});

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	app?.dispose();
	app = undefined;
	pageToaster().dispose();
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

/** Waits `ms` of real time, for timers the queue owns. */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Moves the pointer to the page's top-left corner, away from wherever the stack sits. */
async function parkPointer(): Promise<void> {
	let corner = document.createElement("div");
	corner.style.cssText =
		"position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:8px;block-size:8px";
	document.body.appendChild(corner);
	await userEvent.hover(corner);
	corner.remove();
}

/** Every drawn toast item, oldest first. */
function items(): HTMLDialogElement[] {
	return [...document.querySelectorAll<HTMLDialogElement>('[data-slot="toast-item"]')];
}

/** The scale factor in an element's computed transform, or 1 when it has none. */
function scaleOf(element: Element): number {
	let transform = getComputedStyle(element).transform;
	if (transform === "none") return 1;
	return new DOMMatrixReadOnly(transform).a;
}

/** Mounts a client-only stack and waits for its first adoption pass. */
async function mountStack(props: Partial<Toasts.Props> = {}): Promise<void> {
	mounted = render(<Toasts labels={LABELS} {...props} />);
	await vi.waitFor(() => expect(document.querySelector('[data-slot="region"]')).not.toBeNull());
}

describe("Toasts flash toasts", () => {
	test("show from server HTML and close with the native close command, before any script", async () => {
		document.body.innerHTML = await renderToString(<Toasts labels={LABELS} initial={[FLASH]} />);

		let region = document.querySelector('[role="region"]');
		expect(region?.getAttribute("aria-label")).toBe("Notifications");
		let [item] = items();
		expect(item?.open).toBe(true);
		expect(item?.textContent).toContain("Monitor deleted");
		expect(item?.querySelector("form")?.getAttribute("action")).toBe("/monitors/restore");

		await sleep(400);
		expect(item?.open).toBe(true);

		await userEvent.click(page.getByRole("button", { name: "Dismiss" }));
		expect(item?.open).toBe(false);
		expect(item?.getBoundingClientRect().height).toBe(0);
	});

	test("are adopted on hydration as the same element, with the timer starting only then", async () => {
		document.body.innerHTML = await renderToString(<Toasts labels={LABELS} initial={[FLASH]} />);
		let [serverItem] = items();

		await sleep(400);
		expect(serverItem?.isConnected).toBe(true);

		app = run({ loadModule: () => Toasts });
		await app.ready();
		await vi.waitFor(() => expect(pageToaster().get("flash-1")).toBeDefined());

		expect(items()[0]).toBe(serverItem);
		expect(pageToaster().get("flash-1")?.duration).toBe(300);

		await vi.waitFor(() => expect(serverItem?.isConnected).toBe(false), { timeout: 2000 });
	});

	test("leave the queue when the user closes a hydrated one", async () => {
		document.body.innerHTML = await renderToString(
			<Toasts labels={LABELS} initial={[{ ...FLASH, duration: null }]} />,
		);
		app = run({ loadModule: () => Toasts });
		await app.ready();
		await vi.waitFor(() => expect(pageToaster().size).toBe(1));

		await userEvent.click(page.getByRole("button", { name: "Dismiss" }));

		await vi.waitFor(() => expect(items()).toHaveLength(0));
		expect(pageToaster().size).toBe(0);
	});
});

describe("Toasts stack", () => {
	test("shows three, folding the older two behind the newest at 0.95 and 0.9", async () => {
		await mountStack();
		for (let n = 1; n <= 5; n++)
			pageToaster().add({ title: `Monitor ${n} paused` }, { duration: null });
		await vi.waitFor(() => expect(items()).toHaveLength(5));

		let shown = items().filter((item) => getComputedStyle(item).display !== "none");
		expect(shown.map((item) => item.textContent)).toEqual([
			"Monitor 3 paused",
			"Monitor 4 paused",
			"Monitor 5 paused",
		]);

		let back = shown[0]!;
		let middle = shown[1]!;
		let front = shown[2]!;
		await vi.waitFor(() => {
			expect(scaleOf(front)).toBe(1);
			expect(scaleOf(middle)).toBeCloseTo(0.95);
			expect(scaleOf(back)).toBeCloseTo(0.9);
		});
		expect(middle.getBoundingClientRect().top).toBeLessThan(front.getBoundingClientRect().top);
		expect(back.getBoundingClientRect().top).toBeLessThan(middle.getBoundingClientRect().top);
		expect(middle.getBoundingClientRect().height).toBeCloseTo(
			front.getBoundingClientRect().height * 0.95,
			0,
		);
	});

	test("fans out into a list on hover and holds every timer while there", async () => {
		await mountStack();
		for (let n = 1; n <= 3; n++)
			pageToaster().add({ title: `Invite ${n} sent` }, { duration: 5000 });
		await vi.waitFor(() => expect(items()).toHaveLength(3));

		let front = items()[2]!;
		await userEvent.hover(front);

		await vi.waitFor(() => {
			let boxes = items().map((item) => item.getBoundingClientRect());
			expect(boxes[0]!.bottom).toBeLessThanOrEqual(boxes[1]!.top);
			expect(boxes[1]!.bottom).toBeLessThanOrEqual(boxes[2]!.top);
			expect(items().map(scaleOf)).toEqual([1, 1, 1]);
		});
		expect(pageToaster().toasts.every((toast) => toast.paused)).toBe(true);

		await parkPointer();
		await vi.waitFor(() => expect(pageToaster().toasts.some((toast) => toast.paused)).toBe(false));
	});

	test("caps a plain region of direct toasts too", async () => {
		mounted = render(
			<Toast.Region aria-label="Notifications" max={2}>
				<Toast>One</Toast>
				<Toast>Two</Toast>
				<Toast>Three</Toast>
			</Toast.Region>,
		);
		let toasts = [...document.querySelectorAll('[data-slot="toast"]')];

		expect(toasts.map((toast) => getComputedStyle(toast).display)).toEqual([
			"none",
			"flex",
			"flex",
		]);
	});

	test("animates the fold, and holds still under reduced motion", async () => {
		await mountStack();
		pageToaster().add({ title: "Domain added" }, { duration: null });
		await vi.waitFor(() => expect(items()).toHaveLength(1));
		expect(getComputedStyle(items()[0]!).transitionDuration).toBe("0.2s");

		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});

		expect(getComputedStyle(items()[0]!).transitionDuration).toBe("0s");
	});
});

describe("Toasts actions", () => {
	test("holds Undo for its longer duration and runs it once", async () => {
		await mountStack();
		let restore = vi.fn();
		let id = pageToaster().add(
			{ title: "Monitor deleted", action: { label: "Undo", onAction: restore } },
			{ duration: TOAST_UNDO_DURATION },
		);
		await vi.waitFor(() => expect(items()).toHaveLength(1));

		expect(TOAST_UNDO_DURATION).toBeGreaterThanOrEqual(5000);
		expect(TOAST_UNDO_DURATION).toBeLessThanOrEqual(10_000);
		expect(pageToaster().get(id)?.duration).toBe(TOAST_UNDO_DURATION);

		await userEvent.click(page.getByRole("button", { name: "Undo" }));

		expect(restore).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(items()).toHaveLength(0));
	});

	test("updates one toast in place as a promise settles", async () => {
		await mountStack();
		let { promise, resolve } = Promise.withResolvers<string>();

		pageToaster().promise(promise, {
			loading: { title: "Saving monitor", loading: true },
			success: (name) => ({ title: `${name} saved`, color: "success" }),
			error: { title: "Couldn't save monitor. Try again.", color: "danger" },
		});
		await vi.waitFor(() => expect(items()).toHaveLength(1));

		let item = items()[0]!;
		expect(item.querySelector('[data-slot="loader"]')).not.toBeNull();
		expect(item.querySelector('[data-slot="toast"]')?.getAttribute("aria-busy")).toBe("true");

		resolve("Checkout");
		await vi.waitFor(() => expect(item.textContent).toContain("Checkout saved"));

		expect(items()).toEqual([item]);
		expect(item.querySelector('[data-slot="loader"]')).toBeNull();
		expect(item.querySelector('[data-slot="toast"]')?.getAttribute("data-color")).toBe("success");
	});
});
