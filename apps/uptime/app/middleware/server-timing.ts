/**
 * Server-Timing middleware and helpers for the app's request pipeline. Wires up
 * `createServerTimingMiddleware`, exposes the middleware, and provides a `measure` helper
 * that resolves the request-scoped timing collector from context storage to time async work.
 * Exists so route and loader code can record Server-Timing spans without threading the
 * collector through by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Timing } from "@edgefirst-dev/server-timing";

import { createServerTimingMiddleware } from "remix-utils/middleware/server-timing";

import { getContext } from "./context-storage";

const [serverTimingMiddleware, getTimingCollectorFromContext] = createServerTimingMiddleware();

export { serverTimingMiddleware };

function getTimingCollector() {
	return getTimingCollectorFromContext(getContext());
}

export function measure<T>(description: string, fn: Timing.MeasureFunction<T>) {
	return getTimingCollector().measure(description, description, fn);
}
