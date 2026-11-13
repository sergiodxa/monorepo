/**
 * The one set of token colours every code surface paints highlighted runs with, so a file,
 * a diff and a thread excerpt read the same `keyword` in the same ink, in light and dark,
 * and a page's own `--highlight-*` properties restyle all of them at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Token colours as `[light, dark]` pairs, used when the page declares no `--highlight-*`
 * property of its own. A run whose type is missing here draws as plain text.
 */
export const CODE_TOKEN_PALETTE: Readonly<Record<string, readonly [string, string]>> = {
	comment: ["#6a737d", "#8b949e"],
	keyword: ["#d73a49", "#ff7b72"],
	operator: ["#d73a49", "#ff7b72"],
	string: ["#032f62", "#a5d6ff"],
	builtin: ["#032f62", "#a5d6ff"],
	"attr-name": ["#032f62", "#a5d6ff"],
	"attr-value": ["#032f62", "#a5d6ff"],
	number: ["#005cc5", "#79c0ff"],
	boolean: ["#005cc5", "#79c0ff"],
	constant: ["#005cc5", "#79c0ff"],
	property: ["#005cc5", "#79c0ff"],
	tag: ["#005cc5", "#79c0ff"],
	function: ["#6f42c1", "#d2a8ff"],
	"class-name": ["#6f42c1", "#d2a8ff"],
	regex: ["#e36209", "#ffa657"],
	variable: ["#e36209", "#ffa657"],
	punctuation: ["#24292f", "#e6edf3"],
	inserted: ["#22863a", "#7ee787"],
	deleted: ["#b31d28", "#ffa198"],
};

/**
 * One rule per token type for `span.token.<type>` under the host, each reading the page's
 * `--highlight-<type>` first. Spread into the host's `raw()` rules once, so rows carry no
 * class of their own beyond the run's.
 *
 * @returns Nested rules keyed by selector.
 * @example raw({ ...codeTokenRules(), fontFamily: "monospace" })
 */
export function codeTokenRules(): Record<string, { color: string }> {
	return Object.fromEntries(
		Object.entries(CODE_TOKEN_PALETTE).map(([type, [light, dark]]) => [
			`& .token.${type}`,
			{ color: `var(--highlight-${type}, light-dark(${light}, ${dark}))` },
		]),
	);
}
