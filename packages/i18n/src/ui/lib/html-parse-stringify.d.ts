/**
 * Ambient types for `html-parse-stringify`, which ships no type declarations
 * of its own. Scoped to the `parse` shape `parse-trans.ts` actually reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

declare module "html-parse-stringify" {
	export interface HtmlAstTextNode {
		type: "text";
		content: string;
	}

	export interface HtmlAstTagNode {
		type: "tag";
		name: string;
		voidElement: boolean;
		attrs: Record<string, string>;
		children: HtmlAstNode[];
	}

	export interface HtmlAstCommentNode {
		type: "comment";
		comment: string;
	}

	export type HtmlAstNode = HtmlAstTextNode | HtmlAstTagNode | HtmlAstCommentNode;

	const HTML: {
		parse(html: string): HtmlAstNode[];
		stringify(ast: HtmlAstNode[]): string;
	};

	export default HTML;
}
