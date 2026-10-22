/**
 * Turns a {@link ProjectGraph} into Mermaid flowchart source: one node per layer that appears,
 * edges labelled with import counts, and dependency-rule breaches drawn as dashed red links so
 * `@sdxc/diagram` can render the same text the command prints.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ProjectGraph } from "./graph.js";
import type { Layer } from "./layers.js";

import { LAYER_ORDER, layerOf } from "./layers.js";

/** Options for {@link toMermaid}. */
export interface MermaidOptions {
	/** Accessible name passed to {@link toSVG} as `alt`; omitted from the Mermaid text. */
	title?: string;
}

/**
 * A `flowchart TB` of the project's layers. Empty projects still produce a valid one-node
 * diagram so `toSVG` and `--json` have something to print. Edges that break the dependency
 * rule are dashed and labelled so they read without Mermaid styling statements.
 */
export function toMermaid(graph: ProjectGraph, _options: MermaidOptions = {}): string {
	let present = new Set<Layer>();
	for (let edge of graph.layers) {
		present.add(edge.from);
		present.add(edge.to);
	}
	for (let module of graph.modules) {
		let layer = layerOf(module);
		if (layer) present.add(layer);
	}
	let nodes = LAYER_ORDER.filter((layer) => present.has(layer));
	if (nodes.length === 0) nodes = ["models"];

	let lines = ["flowchart TB"];
	for (let layer of nodes) {
		lines.push(`  ${nodeId(layer)}["${escapeLabel(layer)}"]`);
	}
	for (let edge of graph.layers) {
		let label = edge.count === 1 ? "1 import" : `${edge.count} imports`;
		if (edge.allowed) {
			lines.push(`  ${nodeId(edge.from)} -->|${escapeLabel(label)}| ${nodeId(edge.to)}`);
		} else {
			lines.push(
				`  ${nodeId(edge.from)} -.->|${escapeLabel(`${label}, breaks rule`)}| ${nodeId(edge.to)}`,
			);
		}
	}
	return `${lines.join("\n")}\n`;
}

/** Stable Mermaid node id for a layer name. */
function nodeId(layer: Layer): string {
	return `L_${layer}`;
}

/** Mermaid breaks on `"` inside labels; keep labels plain. */
function escapeLabel(text: string): string {
	return text.replace(/"/g, "'");
}
