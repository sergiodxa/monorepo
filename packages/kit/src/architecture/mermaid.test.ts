/**
 * Mermaid emission for layer graphs: nodes for present layers, solid inward edges, dashed
 * breaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { ProjectGraph } from "./graph.js";

import { toMermaid } from "./mermaid.js";

describe("toMermaid", () => {
	test("draws inward and breach edges", () => {
		let graph: ProjectGraph = {
			modules: ["app/http/a.ts", "app/models/b.ts"],
			edges: [],
			testEdges: [],
			layers: [
				{ from: "http", to: "models", count: 2, allowed: true },
				{ from: "models", to: "http", count: 1, allowed: false },
			],
			cycles: [],
			violations: [],
		};

		let mermaid = toMermaid(graph);

		expect(mermaid).toContain("flowchart TB");
		expect(mermaid).toContain('L_http["http"]');
		expect(mermaid).toContain("L_http -->|2 imports| L_models");
		expect(mermaid).toContain("L_models -.->|1 import, breaks rule| L_http");
	});
});
