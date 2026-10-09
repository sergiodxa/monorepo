/**
 * The `remix/component` component for a diagram: it parses Mermaid source and
 * builds the SVG elements from the tree, so the markup is element nodes the
 * renderer owns. It doubles as the component `toRemix` draws a `diagram` tag with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { createElement } from "remix/component";

import type { SvgNode } from "./index.js";

import { parseDiagram } from "./index.js";

/** The props {@link Diagram} accepts. */
export namespace Diagram {
	/** `source` is the attribute a walked `diagram` tag carries. */
	export interface Props {
		source: string;
	}
}

/**
 * Renders Mermaid source as SVG, or as the source in a code block when it does
 * not parse, so a broken diagram still shows what the author wrote.
 *
 * @example <Diagram source={"sequenceDiagram\nAlice->>Bob: Hi"} />
 */
export function Diagram(handle: Handle<Diagram.Props>) {
	return () => {
		let { source } = handle.props;
		let result = parseDiagram(source);
		if (result.status === "failure") {
			return (
				<pre>
					<code class="language-mermaid">{source}</code>
				</pre>
			);
		}
		return build(result.data);
	};
}

/**
 * {@link Diagram} as `toRemix` draws a walked `diagram` tag: it takes the tag's
 * attributes as props, alongside the children every such component receives,
 * which a diagram tag never has.
 *
 * @example toRemix(document, { components: { diagram: DiagramTag } })
 */
export function DiagramTag(handle: Handle<{ source: string; children: RemixNode }>) {
	return () => <Diagram source={handle.props.source} />;
}

/** One tree node as a Remix node: an element with its attributes, or its text as a string. */
function build(node: SvgNode): RemixNode {
	if (node.type === "text") return node.value;
	return createElement(node.name, { ...node.attributes }, node.children.map(build));
}
