/**
 * Every part of a Pulse screen that streams in after the screen's shell, by its path: the
 * overview's stats and chart, a service's chart, strip, history and facts, and the peek
 * sheet's body. Each reads the state it needs from its own path and query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import type { DemoAppRequest } from "~/resources/views/demo-apps";

import { findService } from "./data";
import { ChartBody, StatsBody } from "./overview";
import { ServiceChart, ServiceUptime } from "./service";
import { PeekBody, ServiceProperties, ServiceTimeline } from "./service-parts";

/** The parts of one service, each named by the last segment of `services/<id>/<part>`. */
const SERVICE_PARTS = {
	chart: ServiceChart,
	uptime: ServiceUptime,
	activity: ServiceTimeline,
	details: ServiceProperties,
	peek: PeekBody,
} as const;

/**
 * Renders the part a frame's path names.
 *
 * @param part The path under the app, such as `overview/stats` or `services/checkout-api/chart`.
 * @param request The frame's request, whose query carries the screen state the part reads.
 * @returns The part's content, or `null` for a path or service Pulse lacks.
 */
export function pulseFrame(part: string, request: DemoAppRequest): RemixNode | null {
	if (part === "overview/chart") return <ChartBody request={request} />;
	if (part === "overview/stats") return <StatsBody request={request} />;
	let [first, id = "", name = "", extra] = part.split("/");
	if (first !== "services" || extra !== undefined || !Object.hasOwn(SERVICE_PARTS, name)) {
		return null;
	}
	let service = findService(id);
	if (service === undefined) return null;
	let Part = SERVICE_PARTS[name as keyof typeof SERVICE_PARTS];
	return <Part service={service} />;
}
