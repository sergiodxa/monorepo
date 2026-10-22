/**
 * Checks how card text is derived: a marketing page's headline and highlighted phrase from its
 * markup, a status page's bars, uptime and "since" line from its overview, and how cards are
 * addressed, keyed and versioned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import type { StatusPageOverview } from "~/app/services/status-page-overview";

import {
	describeSince,
	marketingCardContent,
	marketingCardVersion,
	pagePathFromCardPath,
	readPageFacts,
	SOCIAL_CARD_TEMPLATE,
	socialCardKey,
	socialCardUrl,
	statusCardContent,
	STATUS_CARD_SERVICES,
} from "~/app/services/social-card";

const TODAY = "2026-10-16";

/** A day key `offset` days before {@link TODAY}. */
function dayBefore(offset: number): string {
	return new Date(Date.parse(`${TODAY}T00:00:00Z`) - offset * 86_400_000)
		.toISOString()
		.slice(0, 10);
}

/** A daily stats row for one day of a bar service. */
function day(offset: number, status: "up" | "degraded" | "down", successful = 100, total = 100) {
	return { date: dayBefore(offset), status, successful_checks: successful, total_checks: total };
}

/** An overview of bar services with the given statuses and days. */
function overview(
	overall: StatusPageOverview["overallStatus"],
	services: Array<{
		name: string;
		status: StatusPageOverview["overallStatus"];
		days: ReturnType<typeof day>[];
	}>,
): StatusPageOverview {
	return {
		overallStatus: overall,
		cronServices: [],
		barServices: services.map((service, index) => ({ kind: "http", id: `m${index}`, ...service })),
	} as unknown as StatusPageOverview;
}

describe("readPageFacts", () => {
	test("reads the title, description, headline and its highlighted phrase", () => {
		let html = `<head><meta property="og:title" content="Uptime by Sergio Xalambr&#237;"><meta property="og:description" content="Alerts &amp; more"></head><h1 class="x">Monitor your services <span class="y">with confidence</span></h1>`;
		expect(readPageFacts(html, "/")).toEqual({
			title: "Uptime by Sergio Xalambrí",
			description: "Alerts & more",
			headline: "Monitor your services with confidence",
			accent: "with confidence",
			path: "/",
		});
	});

	test("a page with no title is no page", () => {
		expect(readPageFacts("<h1>Hi</h1>", "/x")).toBeNull();
	});
});

describe("marketingCardContent", () => {
	test("splits the highlighted phrase off the headline", () => {
		let card = marketingCardContent({
			title: "Uptime by Sergio Xalambrí",
			description: "d",
			headline: "Monitor your services with confidence",
			accent: "with confidence",
			path: "/",
		});
		expect(card).toMatchObject({
			eyebrow: "Uptime Monitoring",
			title: "Monitor your services",
			accent: "with confidence",
			url: "uptime.sergiodxa.com",
		});
	});

	test("names the section by the path and falls back to the title's own name", () => {
		let card = marketingCardContent({
			title: "Uptime vs Pingdom | Uptime",
			description: "d",
			headline: null,
			accent: null,
			path: "/vs/pingdom",
		});
		expect(card).toMatchObject({ eyebrow: "Comparison", title: "Uptime vs Pingdom", accent: null });
		expect(
			marketingCardContent({
				...card,
				title: "Status Pages | Uptime",
				headline: null,
				accent: null,
				path: "/features/status-pages",
			}).eyebrow,
		).toBe("Feature");
	});

	test("keeps a highlighted phrase that is not the headline's ending inside the title", () => {
		let card = marketingCardContent({
			title: "t",
			description: "",
			headline: "Fast and calm",
			accent: "calm and",
			path: "/",
		});
		expect(card).toMatchObject({ title: "Fast and calm", accent: null });
	});
});

describe("statusCardContent", () => {
	test("bars cover the 90-day window and uptime counts completed days only", () => {
		let content = statusCardContent(
			{ title: "Acme", slug: "acme" },
			overview("operational", [
				{
					name: "API",
					status: "operational",
					days: [day(1, "degraded", 90), day(0, "down", 0, 50)],
				},
			]),
			"since",
			TODAY,
		);
		let [service] = content.services;
		expect(service?.days).toHaveLength(90);
		expect(service?.days.at(-1)).toBe("down");
		expect(service?.days.at(-2)).toBe("degraded");
		expect(service?.days[0]).toBeNull();
		expect(service?.uptime).toBe("90.00%");
		expect(content.url).toBe("uptime.sergiodxa.com/status/acme");
	});

	test("lists a few services and counts the rest", () => {
		let services = Array.from({ length: STATUS_CARD_SERVICES + 2 }, (_, index) => ({
			name: `S${index}`,
			status: "operational" as const,
			days: [],
		}));
		let content = statusCardContent(
			{ title: "Acme", slug: "acme" },
			overview("operational", services),
			"",
			TODAY,
		);
		expect(content.services).toHaveLength(STATUS_CARD_SERVICES);
		expect(content.more).toBe(2);
		expect(content.services[0]?.uptime).toBeNull();
	});
});

describe("describeSince", () => {
	test("counts the clean days ending today", () => {
		let page = overview("operational", [
			{
				name: "API",
				status: "operational",
				days: [day(3, "down"), day(2, "up"), day(1, "up"), day(0, "up")],
			},
		]);
		expect(describeSince(page, TODAY, null)).toBe("No downtime in 3 days");
	});

	test("an incident reads from its start in UTC, or the day when nothing records it", () => {
		let page = overview("degraded", [{ name: "API", status: "degraded", days: [] }]);
		expect(describeSince(page, TODAY, Date.parse("2026-10-16T14:32:00Z"))).toBe(
			"Since Oct 16, 14:32 UTC",
		);
		expect(describeSince(page, TODAY, null)).toBe(`As of ${TODAY}`);
	});

	test("an operational page with downtime today reads as operational", () => {
		let page = overview("operational", [
			{ name: "API", status: "operational", days: [day(0, "degraded")] },
		]);
		expect(describeSince(page, TODAY, null)).toBe("Operational");
	});
});

describe("card addresses", () => {
	test("a card lives at its page's path with .png added", () => {
		expect(socialCardUrl("/vs/pingdom", "abc")).toBe(
			"https://uptime.sergiodxa.com/vs/pingdom.png?v=abc",
		);
		expect(socialCardUrl("/", "abc")).toBe("https://uptime.sergiodxa.com/index.png?v=abc");
		expect(pagePathFromCardPath("/index.png")).toBe("/");
		expect(pagePathFromCardPath("/status/acme.png")).toBe("/status/acme");
	});

	test("keys live under the app's prefix and versions follow the page", () => {
		expect(socialCardKey("abc")).toBe(`uptime/${SOCIAL_CARD_TEMPLATE}/abc.png`);
		expect(marketingCardVersion("t", "d", "/")).toBe(marketingCardVersion("t", "d", "/"));
		expect(marketingCardVersion("t", "d", "/")).not.toBe(marketingCardVersion("t", "e", "/"));
	});
});
