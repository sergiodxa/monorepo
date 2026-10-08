/**
 * The `remix/component` component for a formula: it parses TeX and builds the
 * MathML elements from the tree, so the markup is element nodes the renderer
 * owns. It doubles as the component `toRemix` draws a `math` tag with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { createElement } from "remix/component";

import type { MathNode } from "./index.js";

import { parseMath } from "./index.js";

/** The props {@link MathFormula} and {@link MathTag} accept. */
export namespace MathFormula {
	/** `tex` and `display` are the attributes a walked `math` tag carries. */
	export interface Props {
		tex: string;
		/** @default false */
		display?: boolean;
	}
}

/**
 * Renders TeX as MathML, or as the TeX in a `<code>` when it does not convert,
 * so a broken formula still shows what the author wrote. The elements render
 * as MathML from server markup, which the browser's HTML parser places in the
 * MathML namespace.
 *
 * @example <MathFormula tex="\frac{a}{b}" display />
 */
export function MathFormula(handle: Handle<MathFormula.Props>) {
	return () => {
		let { tex, display } = handle.props;
		let result = parseMath(tex, { display: display === true });
		if (result.status === "failure") return <code>{tex}</code>;
		return build(result.data);
	};
}

/**
 * {@link MathFormula} as `toRemix` draws a walked `math` tag: it takes the tag's
 * attributes as props, alongside the children every such component receives,
 * which a math tag never has.
 *
 * @example toRemix(document, { components: { math: MathTag } })
 */
export function MathTag(handle: Handle<{ tex: string; display?: boolean; children: RemixNode }>) {
	return () => <MathFormula tex={handle.props.tex} display={handle.props.display} />;
}

/** One tree node as a Remix node: an element with its attributes, or its text as a string. */
function build(node: MathNode): RemixNode {
	if (node.type === "text") return node.value;
	return createElement(node.name, { ...node.attributes }, node.children.map(build));
}
