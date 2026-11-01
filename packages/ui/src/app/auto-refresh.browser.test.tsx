/**
 * Drives the auto-refresh control in a real browser: the interval menu as links marking the
 * choice from the URL, a cookie-backed value, and the time island reloading on its interval,
 * resting while the tab is hidden and rewriting the time after each reload.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AutoRefresh } from "./auto-refresh.js";
import { autoRefresh } from "./mixins/auto-refresh.js";

const OPTIONS: AutoRefresh.Option[] = [
	{ value: 0, label: "Off" },
	{ value: 10, label: "10s" },
	{ value: 30, label: "30s" },
	{ value: 60, label: "1m" },
	{ value: 300, label: "5m" },
];

const LABELS: AutoRefresh.Labels = { trigger: "Auto-refresh", updated: "Updated" };

const REFRESHED = new Date("2026-11-01T10:00:00Z");

let mounted: RenderResult | undefined;
let hidden = false;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
	hidden = false;
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Mounts the control for `url` with any extra props. */
function mount(url: string, props: Partial<AutoRefresh.Props> = {}): HTMLElement {
	mounted = render(
		<AutoRefresh
			id="runs"
			url={url}
			options={OPTIONS}
			refreshedAt={REFRESHED}
			locale="en-US"
			timeZone="UTC"
			labels={LABELS}
			{...props}
		/>,
	);
	return mounted.container;
}

/** The menu's items as [href, checked] pairs. */
function items(): [string | null, string | null][] {
	return [...document.querySelectorAll("#runs-menu a")].map((item) => [
		item.getAttribute("href"),
		item.getAttribute("aria-checked"),
	]);
}

/** Flips the page's visibility the way switching tabs does. */
function setHidden(value: boolean): void {
	hidden = value;
	document.dispatchEvent(new Event("visibilitychange"));
}

describe("AutoRefresh", () => {
	test("offers each interval as a link and marks the URL's choice", () => {
		let host = mount("/runs?status=failed&refresh=30");

		expect(host.querySelector('[data-slot="auto-refresh-trigger"]')?.textContent).toBe(
			"Auto-refresh30s",
		);
		expect(items()).toEqual([
			["/runs?status=failed", "false"],
			["/runs?status=failed&refresh=10", "false"],
			["/runs?status=failed&refresh=30", "true"],
			["/runs?status=failed&refresh=60", "false"],
			["/runs?status=failed&refresh=300", "false"],
		]);
		expect(host.querySelector('[data-slot="auto-refresh"]')?.getAttribute("data-interval")).toBe(
			"30",
		);
	});

	test("falls back to the default for an interval the menu does not offer", () => {
		let host = mount("/runs?refresh=7", { defaultValue: 60 });

		expect(host.querySelector('[data-slot="value"]')?.textContent).toBe("1m");
		expect(items()[3]).toEqual(["/runs", "true"]);
	});

	test("reads a cookie-held value and links through hrefFor", () => {
		mount("/runs?refresh=10", {
			value: 300,
			hrefFor: (seconds) => `/preferences/refresh?seconds=${seconds}`,
		});

		expect(items()[4]).toEqual(["/preferences/refresh?seconds=300", "true"]);
		expect(items()[1]?.[1]).toBe("false");
	});

	test("shows when the list was last fetched", () => {
		let host = mount("/runs");
		let time = host.querySelector("time")!;

		expect(host.querySelector('[data-slot="auto-refresh-status"]')?.textContent).toBe(
			"Updated 10:00:00 AM",
		);
		expect(time.dateTime).toBe("2026-11-01T10:00:00.000Z");
	});

	test("places the time where the updated template's {time} sits", () => {
		let host = mount("/runs", {
			labels: { trigger: "Auto-refresh", updated: "Actualizado a las {time} (UTC)" },
		});
		let status = host.querySelector('[data-slot="auto-refresh-status"]')!;

		expect(status.textContent).toBe("Actualizado a las 10:00:00 AM (UTC)");
		expect(status.querySelector("time")?.textContent).toBe("10:00:00 AM");
	});

	test("keeps the template around the time after each reload", async () => {
		vi.useFakeTimers({ now: REFRESHED });
		let host = mount("/runs", {
			value: 10,
			frame: "runs",
			labels: { trigger: "Auto-refresh", updated: "{time} — last fetch" },
		});
		let status = host.querySelector('[data-slot="auto-refresh-status"]')!;

		await vi.advanceTimersByTimeAsync(10_000);
		expect(status.querySelector("time")?.dateTime).toBe("2026-11-01T10:00:10.000Z");
		expect(status.textContent).toMatch(/^\S.* — last fetch$/);
	});
});

describe(autoRefresh.name, () => {
	/** Mounts a bare `<time>` running the mixin with a counting reload. */
	function mountTime(every: number): { time: HTMLTimeElement; reloads: () => number } {
		let count = 0;
		vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
		mounted = render(
			<time
				dateTime={new Date().toISOString()}
				mix={[
					autoRefresh({
						every,
						locale: "en-US",
						reload: async () => {
							count++;
						},
					}),
				]}
			>
				then
			</time>,
		);
		return { time: mounted.container.querySelector("time")!, reloads: () => count };
	}

	test("reloads on the chosen interval and rewrites the time", async () => {
		vi.useFakeTimers({ now: new Date("2026-11-01T10:00:00Z") });
		let { time, reloads } = mountTime(30_000);

		await vi.advanceTimersByTimeAsync(29_999);
		expect(reloads()).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(reloads()).toBe(1);
		expect(time.dateTime).toBe("2026-11-01T10:00:30.000Z");
		expect(time.textContent).not.toBe("then");
	});

	test("rests while the tab is hidden and catches up once it is shown", async () => {
		vi.useFakeTimers({ now: new Date("2026-11-01T10:00:00Z") });
		let { time, reloads } = mountTime(10_000);

		setHidden(true);
		expect(time.hasAttribute("data-paused")).toBe(true);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(reloads()).toBe(0);

		setHidden(false);
		await vi.advanceTimersByTimeAsync(0);
		expect(reloads()).toBe(1);
		expect(time.hasAttribute("data-paused")).toBe(false);
	});

	test("never reloads when off", async () => {
		vi.useFakeTimers();
		let { reloads } = mountTime(0);

		await vi.advanceTimersByTimeAsync(600_000);
		expect(reloads()).toBe(0);
	});
});
