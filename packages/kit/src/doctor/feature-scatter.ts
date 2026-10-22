/**
 * The `feature-scatter` check: a feature folder name that appears under one app layer should
 * also appear under the others that already use feature folders, so a glob on that name finds
 * the whole feature (ADR-129).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/** Layers that group by feature with the same folder name. */
const FEATURE_LAYERS = [
	"app/http/controllers",
	"app/http/middleware",
	"app/http/validators",
	"app/jobs",
	"app/services",
	"app/policies",
	"app/emails",
	"app/commands",
	"app/mcp/tools",
	"app/mcp/resources",
] as const;

/**
 * Warns when a feature name already spans two or more layers but is missing from another
 * layer that also hosts multi-layer features. A folder that exists in only one layer is left
 * alone — not every feature crosses every kind.
 */
export const featureScatterCheck: Check = {
	name: "feature-scatter",
	async run(context): Promise<CheckResult> {
		let byLayer = new Map<string, Set<string>>();
		for (let layer of FEATURE_LAYERS) {
			let names = await featureFolders(context.root, layer);
			if (names.size > 0) byLayer.set(layer, names);
		}
		if (byLayer.size < 2) {
			return skipped("Fewer than two layers use feature folders");
		}
		let layersFor = new Map<string, string[]>();
		for (let [layer, names] of byLayer) {
			for (let name of names) {
				let list = layersFor.get(name) ?? [];
				list.push(layer);
				layersFor.set(name, list);
			}
		}
		let multi = [...layersFor.entries()].filter(([, layers]) => layers.length >= 2);
		if (multi.length === 0) {
			return skipped("No feature folder name appears in more than one layer");
		}
		let peerLayers = new Set(multi.flatMap(([, layers]) => layers));
		let findings: string[] = [];
		for (let [feature, present] of multi.sort((a, b) => a[0].localeCompare(b[0]))) {
			let missing = [...peerLayers].filter((layer) => !present.includes(layer)).sort();
			if (missing.length === 0) continue;
			findings.push(
				`${feature}: in ${present.sort().join(", ")} but missing from ${missing.join(", ")}`,
			);
		}
		if (findings.length === 0) {
			return passed("Multi-layer feature folders line up across their peer layers");
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 feature scattered across layers"
					: `Found ${findings.length} features scattered across layers`,
			findings,
			fix: "Add the missing feature folder (or move the files) so the shared name groups the feature in every peer layer",
		};
	},
};

/** Immediate subdirectories of `layer` that look like feature groups (not files). */
async function featureFolders(root: string, layer: string): Promise<Set<string>> {
	let entries = await wrap(() => readdir(join(root, layer), { withFileTypes: true }));
	if (isFailure(entries)) return new Set();
	return new Set(
		entries.data
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
			.map((entry) => entry.name),
	);
}
