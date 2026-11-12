/**
 * Holds every Pulse frame to the box its placeholder reserves: each part's placeholder and
 * its content take the same height at a phone's and a desktop's column width, so a frame
 * landing never moves what follows it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { themeScope } from "@sdxc/ui/styles";
import { describe, expect, test } from "vitest";

import { blockSize } from "~/app/test/frame-size";
import { demoThemeTokens } from "~/resources/components/demo-theme";
import pulse from "~/resources/views/demo-apps/pulse";
import { findService, SERVICES } from "~/resources/views/demo-apps/pulse/data";
import { RANGE_IDS } from "~/resources/views/demo-apps/pulse/metrics";
import {
	ChartBody,
	ChartPlaceholder,
	StatsBody,
	StatsPlaceholder,
} from "~/resources/views/demo-apps/pulse/overview";
import {
	ServiceChart,
	ServiceChartPlaceholder,
	ServiceUptime,
	ServiceUptimePlaceholder,
} from "~/resources/views/demo-apps/pulse/service";
import {
	ActivityBox,
	PeekBody,
	PeekPlaceholder,
	ServiceProperties,
	ServicePropertiesPlaceholder,
	ServiceTimeline,
	ServiceTimelinePlaceholder,
} from "~/resources/views/demo-apps/pulse/service-parts";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** The column widths the frames sit in, from a phone's content column to a desktop's. */
const WIDTHS = [343, 1100];

/** Wraps a node in Pulse's theme tokens, so type and spacing match the page. */
function themed(node: RemixNode): RemixNode {
	return (
		<div
			mix={[
				themeScope(),
				raw({ ...demoThemeTokens(pulse.theme), fontFamily: "var(--ui-font-sans)" }),
			]}
		>
			{node}
		</div>
	);
}

/** A request for a frame of Pulse, as the frame route builds it. */
function request(part: string) {
	let url = new URL(`https://sdxc.test/demo/apps/pulse/frames/${part}`);
	return { page: part, url, cookie: null };
}

describe("Pulse frames keep their placeholder's size", () => {
	test.each(WIDTHS)("the overview chart at %ipx", (width) => {
		let fallback = blockSize(<ChartPlaceholder />, width, themed);
		let content = blockSize(
			<ChartBody request={request("overview/chart?metric=latency&range=24h")} />,
			width,
			themed,
		);
		expect(content).toBeGreaterThan(0);
		expect(Math.abs(content - fallback)).toBeLessThanOrEqual(1);
	});

	describe.each(RANGE_IDS)("the overview stat tabs over %s", (range) => {
		test.each(WIDTHS)("at %ipx", (width) => {
			expectSameSize(
				<StatsPlaceholder />,
				<StatsBody request={request(`overview/stats?metric=errors&range=${range}`)} />,
				width,
			);
		});
	});

	describe.each(SERVICES.map((service) => service.id))("the %s page", (id) => {
		let service = findService(id)!;

		test.each(WIDTHS)("chart at %ipx", (width) => {
			expectSameSize(<ServiceChartPlaceholder />, <ServiceChart service={service} />, width);
		});

		test.each(WIDTHS)("uptime strip at %ipx", (width) => {
			expectSameSize(<ServiceUptimePlaceholder />, <ServiceUptime service={service} />, width);
		});

		test.each(WIDTHS)("history at %ipx", (width) => {
			expectSameSize(
				<ActivityBox service={service}>
					<ServiceTimelinePlaceholder service={service} limit={4} />
				</ActivityBox>,
				<ActivityBox service={service}>
					<ServiceTimeline service={service} />
				</ActivityBox>,
				width,
			);
		});

		test.each(WIDTHS)("details at %ipx", (width) => {
			expectSameSize(
				<ServicePropertiesPlaceholder />,
				<ServiceProperties service={service} />,
				width,
			);
		});

		test.each(WIDTHS)("peek sheet body at %ipx", (width) => {
			expectSameSize(<PeekPlaceholder service={service} />, <PeekBody service={service} />, width);
		});
	});
});

/** Holds a part's content to its placeholder's height, within a pixel, at one width. */
function expectSameSize(fallback: RemixNode, content: RemixNode, width: number) {
	let reserved = blockSize(fallback, width, themed);
	let landed = blockSize(content, width, themed);
	expect(landed).toBeGreaterThan(0);
	expect(Math.abs(landed - reserved)).toBeLessThanOrEqual(1);
}
