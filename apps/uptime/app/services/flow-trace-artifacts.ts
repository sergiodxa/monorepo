/**
 * An {@link ArtifactStore} that keeps Performance-trace JSON in memory for the
 * life of one flow check, so `browser.trace.stop` can land without a filesystem
 * and the host can upload the last trace after the result row exists (ADR-037).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ArtifactStore } from "@sdxc/spec";

/**
 * Collects artifact writes during a flow run. Only the last JSON body is kept —
 * one downloadable Performance trace per result.
 */
export interface FlowTraceBuffer {
	/** The ArtifactStore handed to `runTests`. */
	store: ArtifactStore;
	/** The last chrome://tracing JSON written, when the flow recorded one. */
	lastTraceJson(): string | null;
}

/** Build a buffer that records every `write` and exposes the last JSON body. */
export function createFlowTraceBuffer(): FlowTraceBuffer {
	let last: string | null = null;
	return {
		store: {
			directory: "flow-traces",
			async write(name, contents) {
				last = typeof contents === "string" ? contents : new TextDecoder().decode(contents);
				return name;
			},
		},
		lastTraceJson() {
			return last;
		},
	};
}
