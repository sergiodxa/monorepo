/**
 * The `sdxc diagram` handler: prints the project's layer import graph as Mermaid, or as JSON for
 * an agent, and optionally writes an SVG through `@sdxc/diagram`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, failure, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { buildDiagram, formatDiagramSummary } from "../diagram.js";
import { project } from "../middleware.js";

/** Builds the architecture diagram and prints Mermaid, JSON, or the SVG path. */
export default createCommand(SDXC_COMMANDS.diagram, {
	middleware: [project()],
	/** Fails only when SVG rendering or writing fails; an empty project still prints a diagram. */
	async handler(ctx) {
		let result = await buildDiagram(ctx.project.root, {
			svg: ctx.flags.svg,
			title: "Architecture",
		});
		if (isFailure(result)) {
			ctx.stderr(`${result.error.message}\n`);
			return failure(result.error);
		}
		if (ctx.flags.json) {
			ctx.stdout(
				`${JSON.stringify(
					{
						mermaid: result.data.mermaid,
						modules: result.data.graph.modules,
						edges: result.data.graph.edges,
						layers: result.data.graph.layers,
						cycles: result.data.graph.cycles,
						violations: result.data.graph.violations,
						svg: result.data.svgPath,
					},
					null,
					2,
				)}\n`,
			);
			return success();
		}
		if (result.data.svgPath) {
			ctx.stdout(`${result.data.svgPath}\n`);
			return success();
		}
		ctx.stdout(formatDiagramSummary(result.data.graph));
		return success();
	},
});
