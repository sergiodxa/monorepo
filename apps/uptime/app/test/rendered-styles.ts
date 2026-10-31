/**
 * Reads the CSS a server-rendered element carries. Every `css()` mixin class ships its rule in
 * a `<style data-rmx-style="<class>">` block beside the markup, so a page test can assert a
 * layout decision on a controller's output without a browser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The style rules of the element whose opening tag contains `marker`, searching from `from`.
 * Answers an empty list when no tag holds the marker, so an assertion on a missing element
 * fails on its expectation rather than on a thrown error.
 *
 * @param html - The rendered page.
 * @param marker - Text inside the element's opening tag, such as `data-slot="check-list"`.
 * @param from - The offset to start searching at, to reach an element inside one section.
 * @returns One rule block per class on the element, in class order.
 * @example elementStyles(body, 'data-slot="check-list"', body.indexOf('id="regions"'))
 */
export function elementStyles(html: string, marker: string, from = 0): string[] {
	let at = html.indexOf(marker, Math.max(from, 0));
	if (at === -1) return [];
	let tag = html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1);
	let classes = /\bclass="([^"]*)"/.exec(tag)?.[1]?.split(/\s+/).filter(Boolean) ?? [];
	return classes.flatMap((name) => {
		let rule = new RegExp(`<style data-rmx-style="${name}">([\\s\\S]*?)</style>`).exec(html);
		return rule?.[1] === undefined ? [] : [rule[1]];
	});
}
