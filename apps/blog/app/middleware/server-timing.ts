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
