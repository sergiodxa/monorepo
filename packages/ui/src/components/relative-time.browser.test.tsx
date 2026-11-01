/**
 * Renders relative times in a real browser: the text steps through seconds, minutes, hours and
 * days and turns into a date at seven days, `datetime` carries the instant, the title names local
 * and UTC time, and the island rewrites both in the viewer's zone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp } from "vitest/browser";

import { formatRelativeTime, RelativeTime, RelativeTimeLocal } from "./relative-time.js";

const NOW = "2026-11-01T12:00:00.000Z";

/** Mounts `node` in a fresh host and returns its `<time>`. */
function mount(node: JSX.Element): HTMLTimeElement {
	let host = document.createElement("div");
	document.body.appendChild(host);
	render(node, { container: host });
	return host.querySelector("time")!;
}

/** The instant `ms` milliseconds before {@link NOW}. */
function before(ms: number): string {
	return new Date(Date.parse(NOW) - ms).toISOString();
}

afterEach(async () => {
	document.body.replaceChildren();
	await cdp().send("Emulation.setTimezoneOverride", { timezoneId: "" });
});

describe("RelativeTime", () => {
	for (let [ago, text] of [
		[0, "now"],
		[30 * 1000, "30s ago"],
		[2 * 60 * 1000, "2m ago"],
		[59 * 60 * 1000 + 59 * 1000, "59m ago"],
		[3 * 60 * 60 * 1000, "3h ago"],
		[2 * 24 * 60 * 60 * 1000, "2d ago"],
		[7 * 24 * 60 * 60 * 1000 - 1000, "6d ago"],
		[7 * 24 * 60 * 60 * 1000, "Oct 25, 2026"],
	] as const) {
		test(`reads ${text} for a moment ${ago}ms before now`, () => {
			let time = mount(<RelativeTime date={before(ago)} now={NOW} locale="en" />);
			expect(time.textContent).toBe(text);
		});
	}

	test("reads future moments forward", () => {
		let time = mount(<RelativeTime date="2026-11-01T12:05:00Z" now={NOW} locale="en" />);
		expect(time.textContent).toBe("in 5m");
	});

	test("carries the instant in datetime and the absolute time in the title", () => {
		let time = mount(<RelativeTime date="2026-11-01T11:58:00Z" now={NOW} locale="en" />);

		expect(time.dateTime).toBe("2026-11-01T11:58:00.000Z");
		expect(time.title).toBe("Nov 1, 2026, 11:58:00 AM UTC");
	});

	test("names the server's zone and UTC on two lines when they differ", () => {
		let time = mount(
			<RelativeTime date="2026-10-01T02:00:00Z" now={NOW} locale="en" timeZone="America/Lima" />,
		);

		expect(time.textContent).toBe("Sep 30, 2026");
		expect(time.title.split("\n")).toEqual([
			"Sep 30, 2026, 9:00:00 PM GMT-5",
			"Oct 1, 2026, 2:00:00 AM UTC",
		]);
	});

	test("renders a dash for a date that does not parse", () => {
		let time = mount(<RelativeTime date="not a date" now={NOW} />);

		expect(time.textContent).toBe("—");
		expect(time.hasAttribute("datetime")).toBe(false);
	});

	test("formats in the locale it is given", () => {
		expect(formatRelativeTime(before(2 * 60 * 60 * 1000), { now: NOW, locale: "es" }).text).toBe(
			"hace 2 h",
		);
	});
});

describe("RelativeTimeLocal", () => {
	test("rewrites the date and title in the viewer's zone", async () => {
		await cdp().send("Emulation.setTimezoneOverride", { timezoneId: "America/Lima" });
		let time = mount(<RelativeTimeLocal date="2020-03-01T02:00:00Z" locale="en" />);

		await expect.poll(() => time.textContent).toBe("Feb 29, 2020");
		expect(time.title.split("\n")).toEqual([
			"Feb 29, 2020, 9:00:00 PM GMT-5",
			"Mar 1, 2020, 2:00:00 AM UTC",
		]);
		expect(time.dateTime).toBe("2020-03-01T02:00:00.000Z");
	});

	test("counts from the given now while formatting in the viewer's zone", async () => {
		await cdp().send("Emulation.setTimezoneOverride", { timezoneId: "America/Lima" });
		let past = mount(
			<RelativeTimeLocal date="2020-03-01T02:00:00Z" now="2020-03-01T04:00:00Z" locale="en" />,
		);

		await expect.poll(() => past.title.split("\n")[0]).toBe("Feb 29, 2020, 9:00:00 PM GMT-5");
		expect(past.textContent).toBe("2h ago");

		let future = mount(
			<RelativeTime date="2020-03-01T06:00:00Z" now="2020-03-01T04:00:00Z" locale="en" local />,
		);
		await expect.poll(() => future.title.split("\n")[0]).toBe("Mar 1, 2020, 1:00:00 AM GMT-5");
		expect(future.textContent).toBe("in 2h");
	});

	test("is what RelativeTime renders with local", async () => {
		await cdp().send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Tokyo" });
		let time = mount(<RelativeTime date="2020-03-01T20:00:00Z" locale="en" local />);

		await expect.poll(() => time.textContent).toBe("Mar 2, 2020");
	});
});
