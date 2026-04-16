import type { XML } from "../index";

/**
 * Clones one XML element tree recursively.
 *
 * @param element - The element tree to clone
 * @returns A deep clone of the provided element
 */
export function cloneElement(element: XML.Element): XML.Element {
	let attributes = element.attributes ? { ...element.attributes } : undefined;
	let children = element.children?.map((child) => {
		if (typeof child === "string") return child;
		return cloneElement(child);
	});

	return { name: element.name, attributes, children };
}
