/**
 * Diagrams written in Mermaid's text syntax, drawn as SVG on the server: the
 * source is parsed, laid out with text measured from font metrics, and built
 * as a JSON tree of SVG elements that a serializer or a component renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { DiagramSource } from "./lib/source.js";
import type { SvgElement } from "./lib/tree.js";

import { classDiagram } from "./lib/class.js";
import { DiagramError } from "./lib/errors.js";
import { flowchart } from "./lib/flowchart.js";
import { sequenceDiagram } from "./lib/sequence.js";
import { serialize } from "./lib/serialize.js";
import { readSource } from "./lib/source.js";
import { stateDiagram } from "./lib/state.js";

export { DiagramError } from "./lib/errors.js";
export type { SvgElement, SvgNode, SvgText } from "./lib/tree.js";

/** The keyword lines that open each kind, as Mermaid spells them. */
const KINDS: {
	pattern: RegExp;
	draw: (diagram: DiagramSource, header: RegExpExecArray) => SvgElement;
}[] = [
	{ pattern: /^sequenceDiagram$/, draw: (diagram) => sequenceDiagram(diagram) },
	{ pattern: /^classDiagram(?:-v2)?$/, draw: (diagram) => classDiagram(diagram) },
	{ pattern: /^stateDiagram(?:-v2)?$/, draw: (diagram) => stateDiagram(diagram) },
	{
		pattern: /^(?:flowchart|graph)(?:\s+(TB|TD|BT|LR|RL))?;?$/,
		draw: (diagram, header) => flowchart(diagram, header[1]),
	},
];

/** Options for {@link parseDiagram} and {@link toSVG}. */
export interface DiagramOptions {
	/**
	 * The drawing's accessible name, written as its `title` in place of the one
	 * the source's `title` or `accTitle` gives it. An empty string keeps the
	 * source's name.
	 */
	alt?: string;
}

/**
 * Reads a diagram into an SVG tree rooted at an `svg` element. The drawing uses
 * `currentColor` for lines and text, so it takes the color of the text around
 * it, and names itself through a `title` for assistive technology.
 *
 * @param source - Mermaid source, starting with the keyword that names its kind
 * @param options - The accessible name to give the drawing
 * @returns The tree, or the first statement outside the supported subset
 * @example parseDiagram("sequenceDiagram\nAlice->>Bob: Hi")
 */
export function parseDiagram(
	source: string,
	options: DiagramOptions = {},
): Result<SvgElement, DiagramError> {
	try {
		let diagram = readSource(source);
		if (options.alt) diagram.title = options.alt;
		for (let entry of KINDS) {
			let header = entry.pattern.exec(diagram.header.text);
			if (header) return success(entry.draw(diagram, header));
		}
		let keyword = diagram.header.text.split(/\s/)[0] ?? "";
		return failure(
			new DiagramError(
				`Unknown diagram type "${keyword}"; expected sequenceDiagram, classDiagram, stateDiagram or flowchart`,
				source,
				diagram.header.index,
			),
		);
	} catch (error) {
		if (error instanceof DiagramError) return failure(error);
		throw error;
	}
}

/**
 * Converts a diagram to an SVG string, safe to place in HTML or XHTML, or to
 * save as an `.svg` file, as it is.
 *
 * @param source - Mermaid source, starting with the keyword that names its kind
 * @param options - The accessible name to give the drawing
 * @returns The markup, or the first statement outside the supported subset
 * @example toSVG("flowchart LR\nA --> B") // '<svg xmlns="http://www.w3.org/2000/svg" …'
 */
export function toSVG(source: string, options: DiagramOptions = {}): Result<string, DiagramError> {
	let result = parseDiagram(source, options);
	if (result.status === "failure") return result;
	return success(serialize(result.data));
}
