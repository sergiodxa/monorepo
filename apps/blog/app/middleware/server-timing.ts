/**
 * Server-timing middleware and helpers for the blog app. Sets up a timing
 * collector via remix-utils and exposes getTimingCollector plus a measure()
 * helper that wraps async work in a named timing span, so performance data is
 * gathered and surfaced through Server-Timing headers throughout the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Timing } from "@edgefirst-dev/server-timing";

import { createServerTimingMiddleware } from "remix-utils/middleware/server-timing";

import { getContext } from "./context-storage";

const [serverTimingMiddleware, getTimingCollectorFromContext] = createServerTimingMiddleware();

export { serverTimingMiddleware };

export function getTimingCollector() {
	return getTimingCollectorFromContext(getContext());
}

export function measure<T>(description: string, fn: Timing.MeasureFunction<T>) {
	return getTimingCollector().measure(description, description, fn);
}
