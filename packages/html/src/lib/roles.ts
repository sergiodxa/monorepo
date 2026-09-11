/**
 * Maps an element to the ARIA role a browser exposes it as, so a query addresses a
 * document by the role it exposes. An explicit `role` attribute wins, and
 * the contextual cases — a link, a header, a table header — read their surroundings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMElement } from "./dom.js";

/** Roles that depend only on the tag name. */
const TAG_ROLES = new Map<string, string>([
	["address", "group"],
	["article", "article"],
	["aside", "complementary"],
	["blockquote", "blockquote"],
	["button", "button"],
	["caption", "caption"],
	["code", "code"],
	["datalist", "listbox"],
	["dd", "definition"],
	["del", "deletion"],
	["details", "group"],
	["dfn", "term"],
	["dialog", "dialog"],
	["dt", "term"],
	["em", "emphasis"],
	["fieldset", "group"],
	["figcaption", "caption"],
	["figure", "figure"],
	["form", "form"],
	["h1", "heading"],
	["h2", "heading"],
	["h3", "heading"],
	["h4", "heading"],
	["h5", "heading"],
	["h6", "heading"],
	["hgroup", "group"],
	["hr", "separator"],
	["html", "document"],
	["ins", "insertion"],
	["main", "main"],
	["mark", "mark"],
	["menu", "list"],
	["meter", "meter"],
	["nav", "navigation"],
	["ol", "list"],
	["optgroup", "group"],
	["option", "option"],
	["output", "status"],
	["p", "paragraph"],
	["progress", "progressbar"],
	["search", "search"],
	["strong", "strong"],
	["sub", "subscript"],
	["sup", "superscript"],
	["svg", "graphics-document"],
	["table", "table"],
	["tbody", "rowgroup"],
	["textarea", "textbox"],
	["tfoot", "rowgroup"],
	["thead", "rowgroup"],
	["time", "time"],
	["tr", "row"],
	["ul", "list"],
]);

/** Roles an `<input>` takes from its `type`, which defaults to `text`. */
const INPUT_ROLES = new Map<string, string>([
	["button", "button"],
	["checkbox", "checkbox"],
	["email", "textbox"],
	["image", "button"],
	["number", "spinbutton"],
	["radio", "radio"],
	["range", "slider"],
	["reset", "button"],
	["search", "searchbox"],
	["submit", "button"],
	["tel", "textbox"],
	["text", "textbox"],
	["url", "textbox"],
]);

/** Elements that scope a `<header>` or `<footer>` out of the banner and contentinfo roles. */
const SECTIONING_TAGS = new Set(["article", "aside", "main", "nav", "section"]);

/** Elements a `<li>` is a list item inside of. */
const LIST_TAGS = new Set(["menu", "ol", "ul"]);

/**
 * Resolves the role a query matches against, absent when the element carries none
 * — an `<input type="hidden">`, a password field, a `<div>` used as a wrapper.
 */
export function roleOf(element: DOMElement): string | undefined {
	let explicit = element.getAttribute("role")?.trim().split(/\s+/u).at(0);
	if (explicit) return explicit;

	let tag = element.localName.toLowerCase();

	switch (tag) {
		case "a":
		case "area":
			return element.hasAttribute("href") ? "link" : "generic";
		case "img":
			return element.getAttribute("alt") === "" ? "presentation" : "image";
		case "input":
			return INPUT_ROLES.get(element.getAttribute("type")?.toLowerCase() ?? "text");
		case "select":
			return isDropdown(element) ? "combobox" : "listbox";
		case "li":
			return LIST_TAGS.has(element.parentElement?.localName.toLowerCase() ?? "")
				? "listitem"
				: "generic";
		case "td":
			return element.closest("table") ? "cell" : undefined;
		case "th":
			return headerRoleOf(element);
		case "header":
			return isBodyScoped(element) ? "banner" : "generic";
		case "footer":
			return isBodyScoped(element) ? "contentinfo" : "generic";
		case "section":
			return isNamed(element) ? "region" : "generic";
		case "div":
		case "span":
			return "generic";
		default:
			return TAG_ROLES.get(tag);
	}
}

/** Reads the dropdown form of a `<select>`, which is the one exposed as a combobox. */
function isDropdown(element: DOMElement): boolean {
	if (element.hasAttribute("multiple")) return false;
	let size = Number(element.getAttribute("size") ?? "1");
	return !Number.isFinite(size) || size <= 1;
}

/**
 * Chooses between the two header roles: an explicit `scope` decides, and otherwise a
 * row made only of header cells labels columns while a lone header cell labels its row.
 */
function headerRoleOf(element: DOMElement): string | undefined {
	if (!element.closest("table")) return undefined;

	let scope = element.getAttribute("scope")?.toLowerCase();
	if (scope === "row" || scope === "rowgroup") return "rowheader";
	if (scope === "col" || scope === "colgroup") return "columnheader";

	let row = element.closest("tr");
	if (row?.querySelector("td")) return "rowheader";
	return "columnheader";
}

/** Reports whether a `<header>` or `<footer>` belongs to the page as a whole. */
function isBodyScoped(element: DOMElement): boolean {
	for (let node = element.parentElement; node; node = node.parentElement) {
		if (SECTIONING_TAGS.has(node.localName.toLowerCase())) return false;
	}

	return true;
}

/** Reads the attributes that give a `<section>` an accessible name, and so a region role. */
function isNamed(element: DOMElement): boolean {
	if (element.getAttribute("aria-label")?.trim()) return true;
	if (element.getAttribute("aria-labelledby")?.trim()) return true;
	return Boolean(element.getAttribute("title")?.trim());
}
