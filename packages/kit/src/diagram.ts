/**
 * `sdxc diagram`: the project's layer import graph as Mermaid, optionally drawn to SVG through
 * `@sdxc/diagram`, so an agent can read the architecture without opening every file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { toSVG } from "@sdxc/diagram";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { ProjectGraph } from "./architecture/graph.js";

import { projectGraph } from "./architecture/graph.js";
import { toMermaid } from "./architecture/mermaid.js";

/** What the command prints or writes. */
export interface DiagramResult {
	/** Mermaid flowchart source. */
	mermaid: string;
	/** The graph behind the diagram, for `--json`. */
	graph: ProjectGraph;
	/** Absolute path of a written SVG, when one was requested. */
	svgPath: string | null;
}

/** Options for {@link buildDiagram}. */
export interface DiagramOptions {
	/** When set, render SVG with `@sdxc/diagram` and write it to this path (relative to root). */
	svg?: string;
	/** Accessible name for the SVG title. */
	title?: string;
}

/**
 * Builds the architecture diagram for the project at `root`. With `svg`, writes the drawing and
 * returns its path; without it, only the Mermaid text is produced.
 */
export async function buildDiagram(
	root: string,
	options: DiagramOptions = {},
): Promise<Result<DiagramResult, Error>> {
	let graph = await projectGraph(root);
	let mermaid = toMermaid(graph, { title: options.title });
	if (!options.svg) {
		return success({ mermaid, graph, svgPath: null });
	}
	let drawn = toSVG(mermaid, { alt: options.title ?? "Architecture" });
	if (isFailure(drawn)) {
		return failure(new Error(drawn.error.message));
	}
	let svgPath = join(root, options.svg);
	let written = await wrap(() => writeFile(svgPath, drawn.data));
	if (isFailure(written)) return failure(written.error);
	return success({ mermaid, graph, svgPath });
}

/** Human-readable summary of the graph for a terminal without Mermaid rendering. */
export function formatDiagramSummary(graph: ProjectGraph): string {
	let lines = [
		`Modules: ${graph.modules.length}`,
		`Imports: ${graph.edges.length}`,
		`Layer edges: ${graph.layers.length}`,
		`Dependency-rule breaches: ${graph.violations.length}`,
		`Import cycles: ${graph.cycles.length}`,
		"",
		toMermaid(graph).trimEnd(),
		"",
	];
	return lines.join("\n");
}
