/**
 * Fence code-block component and its Markdoc tag definition, using Prism to syntax
 * highlight fenced code in supported languages and falling back to plain preformatted
 * text when a language grammar is missing, so book content renders highlighted code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import Prism from "prismjs";

import "prismjs/components/prism-cshtml";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";

type FenceProps = {
	children: string;
	language: string;
};

export function Fence({ children, language }: FenceProps) {
	let grammar = Prism.languages[language];
	if (!grammar) return <pre className={`language-${language}`}>{children}</pre>;

	let content = Prism.highlight(children, grammar, language);

	return <pre className={`language-${language}`} dangerouslySetInnerHTML={{ __html: content }} />;
}

export const fence = {
	render: "Fence",
	attributes: { language: { type: String } },
};
