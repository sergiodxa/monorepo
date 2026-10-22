/**
 * Computes an element's accessible name the way HTML-AAM and AccName do — through
 * `aria-labelledby`, `aria-label`, an associated `<label>`, an `alt`, and finally the
 * subtree's text — and normalizes it, since that is the form every query compares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { iife } from "@sdxc/iife";

import type { DOMElement, DOMNode } from "./dom.js";

import { roleOf } from "./roles.js";
import { INLINE_TAGS, normalize } from "./text.js";
import { hiddenByStyle, isNonRendered } from "./visibility.js";

/** Roles whose name comes from their content when no attribute or label names them. */
const NAME_FROM_CONTENT_ROLES = new Set([
	"button",
	"cell",
	"checkbox",
	"columnheader",
	"gridcell",
	"heading",
	"link",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
	"option",
	"radio",
	"row",
	"rowheader",
	"switch",
	"tab",
	"tooltip",
	"treeitem",
]);

/** Tags a `<label>` names, which is what makes a label's content their name. */
const LABELABLE_TAGS = new Set([
	"button",
	"input",
	"meter",
	"output",
	"progress",
	"select",
	"textarea",
]);

/** `<input>` types whose `value` attribute is the visible caption of a button. */
const BUTTON_INPUT_TYPES = new Set(["button", "reset", "submit"]);

/** Roles an embedded control contributes its current value under, inside another's label. */
const TEXT_VALUE_ROLES = new Set(["searchbox", "textbox"]);

/** Roles an embedded control contributes its chosen option under, inside another's label. */
const CHOICE_ROLES = new Set(["combobox", "listbox"]);

/** Roles an embedded control contributes its numeric value under, inside another's label. */
const RANGE_ROLES = new Set(["meter", "progressbar", "scrollbar", "slider", "spinbutton"]);

/** Node type of a text node, as `Node.TEXT_NODE` spells it. */
const TEXT_NODE = 3;

/** Node type of an element, as `Node.ELEMENT_NODE` spells it. */
const ELEMENT_NODE = 1;

/** Where a step of the computation sits, which decides the rules that apply to it. */
interface Traversal {
	/** The element whose name is being computed, which never names itself through recursion. */
	root: DOMElement;
	/** Inside an `aria-labelledby` reference, where references stop being followed. */
	referenced: boolean;
	/** Inside a hidden reference, where hidden content counts toward the name. */
	includeHidden: boolean;
	/** Reached through a parent's content, a label or a reference rather than as the root. */
	recursive: boolean;
	/** Elements already named in this computation, so a label shared by two controls ends. */
	visited: Set<DOMElement>;
}

/**
 * Reads the name a person addressing the element by voice or by label would use,
 * whitespace-normalized, and empty for an element that names nothing.
 */
export function accessibleName(element: DOMElement): string {
	let traversal: Traversal = {
		root: element,
		referenced: false,
		includeHidden: false,
		recursive: false,
		visited: new Set(),
	};
	return normalize(nameOf(element, traversal));
}

/**
 * Runs the AccName steps over one element in their defined order: hiding, then
 * references, an embedded control's value, `aria-label`, the host language's own
 * sources, the element's content, and `title` last.
 */
function nameOf(element: DOMElement, traversal: Traversal): string {
	if (element !== traversal.root) {
		if (traversal.visited.has(element)) return "";
		traversal.visited.add(element);
	}

	if (!traversal.includeHidden && isHiddenNode(element)) return "";

	if (!traversal.referenced) {
		let referenced = labelledByName(element, traversal);
		if (referenced.trim()) return referenced;
	}

	let role = roleOf(element);
	if (traversal.recursive && element !== traversal.root) {
		let embedded = embeddedValue(element, role);
		if (embedded !== undefined) return embedded;
	}

	let label = element.getAttribute("aria-label")?.trim();
	if (label) return label;

	if (role !== "presentation" && role !== "none") {
		let native = nativeName(element, traversal);
		if (native.trim()) return native;
	}

	if (traversal.recursive || allowsNameFromContent(element, role)) {
		let content = contentName(element, traversal);
		if (content.trim()) return content;
	}

	return element.getAttribute("title")?.trim() ?? "";
}

/**
 * Joins the names of every element `aria-labelledby` points at, in the order it lists
 * them; an id that matches nothing is skipped, and a hidden target still names.
 */
function labelledByName(element: DOMElement, traversal: Traversal): string {
	let ids = element.getAttribute("aria-labelledby")?.trim().split(/\s+/u) ?? [];
	if (ids.length === 0 || ids[0] === "") return "";

	return ids
		.map((id) => byId(element, id))
		.filter((target) => target !== null)
		.map((target) =>
			nameOf(target, {
				...traversal,
				referenced: true,
				includeHidden: traversal.includeHidden || isHiddenNode(target),
				recursive: true,
			}),
		)
		.join(" ");
}

/**
 * Reads the value a control embedded in another element's label contributes: the
 * text a field holds, the option a select shows, or a range's reading.
 */
function embeddedValue(element: DOMElement, role: string | undefined): string | undefined {
	if (role === undefined) return undefined;
	let tag = element.localName.toLowerCase();

	if (TEXT_VALUE_ROLES.has(role)) {
		if (tag === "textarea") return element.textContent ?? "";
		if (tag === "input") return element.getAttribute("value") ?? "";
		return element.textContent ?? "";
	}

	if (CHOICE_ROLES.has(role)) {
		let options = Array.from(element.querySelectorAll("option, [role='option']"));
		let selected = options.filter(
			(option) =>
				option.hasAttribute("selected") || option.getAttribute("aria-selected") === "true",
		);
		let chosen = iife((): typeof options => {
			if (selected.length > 0) return selected;
			if (tag === "select") return options.slice(0, 1);
			return [];
		});
		return chosen.map((option) => option.textContent ?? "").join(" ");
	}

	if (RANGE_ROLES.has(role)) {
		return (
			element.getAttribute("aria-valuetext") ??
			element.getAttribute("aria-valuenow") ??
			element.getAttribute("value") ??
			""
		);
	}

	return undefined;
}

/**
 * Applies the name sources HTML gives each element: labels for a form control, the
 * caption of a button-like input, `alt` for an image, and the captioning child of a
 * fieldset, table, figure or SVG.
 */
function nativeName(element: DOMElement, traversal: Traversal): string {
	let tag = element.localName.toLowerCase();

	if (LABELABLE_TAGS.has(tag)) {
		let labelled = labelsOf(element)
			.map((label) => nameOf(label, { ...traversal, recursive: true }))
			.join(" ");
		if (labelled.trim()) return labelled;
	}

	switch (tag) {
		case "input":
			return inputName(element);
		case "img":
		case "area":
			return element.getAttribute("alt") ?? "";
		case "fieldset":
			return captionName(element, "legend", traversal);
		case "table":
			return captionName(element, "caption", traversal);
		case "figure":
			return captionName(element, "figcaption", traversal);
		case "svg":
			return childOfTag(element, "title")?.textContent ?? "";
		case "textarea":
		case "select":
			return element.getAttribute("title") ?? element.getAttribute("placeholder") ?? "";
		default:
			return "";
	}
}

/**
 * Names an unlabelled `<input>`: a button-like one by its value or the caption a
 * browser renders by default, an image button by its `alt`, and a field by its
 * `title` and then its `placeholder`.
 */
function inputName(element: DOMElement): string {
	let type = element.getAttribute("type")?.toLowerCase() ?? "text";

	if (BUTTON_INPUT_TYPES.has(type)) {
		let value = element.getAttribute("value");
		if (value !== null) return value;
		if (type === "submit") return "Submit";
		if (type === "reset") return "Reset";
		return "";
	}

	if (type === "image") {
		return element.getAttribute("alt") ?? element.getAttribute("title") ?? "Submit Query";
	}

	return element.getAttribute("title") ?? element.getAttribute("placeholder") ?? "";
}

/** Reads the name of the first child carrying the tag that captions its parent. */
function captionName(element: DOMElement, tag: string, traversal: Traversal): string {
	let caption = childOfTag(element, tag);
	if (!caption) return "";
	return nameOf(caption, { ...traversal, recursive: true });
}

/**
 * Assembles a name from the element's children in document order, spacing apart
 * the blocks a browser would lay out on their own lines; the element being named is
 * left out when its own label wraps it.
 */
function contentName(element: DOMElement, traversal: Traversal): string {
	let text = "";

	for (let child of Array.from(element.childNodes) as DOMNode[]) {
		if (child.nodeType === TEXT_NODE) {
			text += child.nodeValue ?? "";
			continue;
		}

		if (child.nodeType !== ELEMENT_NODE) continue;

		let node = child as DOMElement;
		let tag = node.localName.toLowerCase();
		if (node === traversal.root || isNonRendered(tag)) continue;
		if (tag === "br") {
			text += " ";
			continue;
		}

		let name = nameOf(node, { ...traversal, recursive: true });
		text += INLINE_TAGS.has(tag) ? name : ` ${name} `;
	}

	return text;
}

/** Reports whether an element's role takes its name from what it contains. */
function allowsNameFromContent(element: DOMElement, role: string | undefined): boolean {
	if (role !== undefined && NAME_FROM_CONTENT_ROLES.has(role)) return true;
	let tag = element.localName.toLowerCase();
	return tag === "label" || tag === "legend";
}

/**
 * Lists the labels associated with a control: those pointing at its id through
 * `for`, in document order, and then the one wrapping it.
 */
function labelsOf(element: DOMElement): DOMElement[] {
	let labels: DOMElement[] = [];
	let id = element.getAttribute("id");

	if (id) {
		for (let label of Array.from(rootOf(element).querySelectorAll("label"))) {
			if (label.getAttribute("for") === id) labels.push(label);
		}
	}

	let wrapping = element.closest("label");
	if (wrapping && !wrapping.hasAttribute("for") && !labels.includes(wrapping))
		labels.push(wrapping);

	return labels;
}

/** Finds the element carrying an id anywhere in the element's document. */
function byId(element: DOMElement, id: string): DOMElement | null {
	let root = rootOf(element);
	if (root.getAttribute("id") === id) return root;

	for (let candidate of Array.from(root.querySelectorAll("[id]"))) {
		if (candidate.getAttribute("id") === id) return candidate;
	}

	return null;
}

/** Climbs to the outermost element, which every id and `for` lookup searches from. */
function rootOf(element: DOMElement): DOMElement {
	let node = element;
	while (node.parentElement) node = node.parentElement;
	return node;
}

/** Reads the first direct child with the given tag. */
function childOfTag(element: DOMElement, tag: string): DOMElement | undefined {
	return Array.from(element.children).find((child) => child.localName.toLowerCase() === tag);
}

/**
 * Applies the hiding rules to one element on its own — its ancestors were already
 * judged on the way down — so a hidden reference can still name through its subtree.
 */
function isHiddenNode(element: DOMElement): boolean {
	if (element.hasAttribute("hidden")) return true;
	if (element.getAttribute("aria-hidden") === "true") return true;
	if (isNonRendered(element.localName.toLowerCase())) return true;
	if (
		element.localName.toLowerCase() === "input" &&
		element.getAttribute("type")?.toLowerCase() === "hidden"
	) {
		return true;
	}
	return hiddenByStyle(element);
}
