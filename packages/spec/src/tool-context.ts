/**
 * Assembling the {@link ToolContext} one tool call receives. The runner builds
 * it per test from the run's services; a test of one plugin builds it here
 * too, overriding only the part that call is about, so a new context field
 * reaches every caller without each of them restating the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";

import type { ToolContext } from "./plugin.js";

import { createBaseSet, createConnectionSet } from "./bases.js";
import { ToolError } from "./errors.js";
import { createPermissionSet } from "./permissions.js";

/** The grant set a context defaults to: nothing granted, as `spec run` starts. */
const NOTHING_GRANTED = {
	run: { mode: "denied" },
	net: { mode: "denied" },
	env: { mode: "denied" },
	hostFs: { mode: "denied" },
	db: { mode: "denied" },
} as const;

/**
 * Build a tool context, filling anything the caller left out with the inert
 * defaults of a run that granted nothing and configured nothing.
 *
 * @param overrides - The parts of the context this call is about.
 * @returns A complete context to hand a plugin.
 */
export function createToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
	let context: ToolContext = {
		workspace: overrides.workspace ?? {
			root: "<no filesystem>",
			resolve(path) {
				return failure(
					new ToolError(
						`Cannot resolve ${JSON.stringify(path)}: this run has no filesystem, so no path can be read or written.`,
					),
				);
			},
			async cleanup() {
				return undefined;
			},
		},
		permissions: overrides.permissions ?? createPermissionSet({ ...NOTHING_GRANTED }),
		random: overrides.random ?? createRandom("spec"),
		now: overrides.now ?? new Date("2026-01-01T00:00:00.000Z"),
		run: overrides.run ?? { id: "run", attempt: 1, nonce: "run-1" },
		bases: overrides.bases ?? createBaseSet([]),
		connections: overrides.connections ?? createConnectionSet([]),
	};
	if (overrides.artifacts !== undefined) context.artifacts = overrides.artifacts;
	return context;
}
