/**
 * Deep-clone helpers for RSS channel, item, and extension element data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RSS } from "../index.js";

/**
 * Clones channel data deeply enough to protect internal state.
 *
 * @param channel - The channel to clone
 * @returns The cloned channel
 */
export function cloneChannel(channel: RSS.Channel): RSS.Channel {
	let category = cloneCategoryInput(channel.category);
	let atomLink = cloneAtomLinkInput(channel.atomLink);
	let dcCreator = cloneStringInput(channel.dcCreator);

	return {
		...channel,
		category,
		cloud: channel.cloud ? cloneCloud(channel.cloud) : undefined,
		image: channel.image ? cloneImage(channel.image) : undefined,
		textInput: channel.textInput ? cloneTextInput(channel.textInput) : undefined,
		skipHours: channel.skipHours ? [...channel.skipHours] : undefined,
		skipDays: channel.skipDays ? [...channel.skipDays] : undefined,
		atomLink,
		dcCreator,
		namespaces: cloneAttributes(channel.namespaces),
		attributes: cloneAttributes(channel.attributes),
		extensions: cloneExtensionElements(channel.extensions),
	};
}

/**
 * Clones one item deeply enough to protect internal state.
 *
 * @param item - The item to clone
 * @returns The cloned item
 */
export function cloneItem(item: RSS.Item): RSS.Item {
	let guid = cloneGuidInput(item.guid);
	let category = cloneCategoryInput(item.category);
	let enclosure = cloneEnclosureInput(item.enclosure);
	let atomLink = cloneAtomLinkInput(item.atomLink);
	let dcCreator = cloneStringInput(item.dcCreator);

	return {
		...item,
		guid,
		category,
		enclosure,
		source: item.source ? cloneSource(item.source) : undefined,
		atomLink,
		dcCreator,
		attributes: cloneAttributes(item.attributes),
		extensions: cloneExtensionElements(item.extensions),
	};
}

/**
 * Clones a string record when present.
 *
 * @param attributes - The record to clone
 * @returns The cloned record
 */
export function cloneAttributes(
	attributes?: Record<string, string>,
): Record<string, string> | undefined {
	if (!attributes) return undefined;
	return { ...attributes };
}

/**
 * Clones a list of extension elements.
 *
 * @param elements - The elements to clone
 * @returns The cloned elements
 */
export function cloneExtensionElements(elements?: RSS.Element[]): RSS.Element[] | undefined {
	if (!elements) return undefined;
	return elements.map(cloneExtensionElement);
}

/**
 * Clones one extension element recursively.
 *
 * @param element - The element to clone
 * @returns The cloned element
 */
export function cloneExtensionElement(element: RSS.Element): RSS.Element {
	let children: RSS.Node[] = [];
	for (let child of element.children ?? []) {
		if (typeof child === "string") {
			children.push(child);
			continue;
		}
		children.push(cloneExtensionElement(child));
	}

	return {
		name: element.name,
		attributes: cloneAttributes(element.attributes),
		children,
	};
}

/**
 * Clones string-or-string-array fields.
 *
 * @param value - The value to clone
 * @returns The cloned value
 */
export function cloneStringInput(value?: string | string[]): string | string[] | undefined {
	if (value === undefined) return undefined;
	if (Array.isArray(value)) return [...value];
	return value;
}

/**
 * Clones guid values while preserving the string shortcut API.
 *
 * @param value - The guid value to clone
 * @returns The cloned guid value
 */
export function cloneGuidInput(value?: RSS.GuidInput): RSS.GuidInput | undefined {
	if (value === undefined || typeof value === "string") return value;
	return {
		...value,
		attributes: cloneAttributes(value.attributes),
		extensions: cloneExtensionElements(value.extensions),
	};
}

/**
 * Clones category values while preserving the scalar-or-array API.
 *
 * @param value - The category value to clone
 * @returns The cloned category value
 */
export function cloneCategoryInput(
	value?: RSS.CategoryInput | RSS.CategoryInput[],
): RSS.CategoryInput | RSS.CategoryInput[] | undefined {
	if (value === undefined) return undefined;
	if (Array.isArray(value)) return value.map(cloneCategoryValue) as RSS.CategoryInput[];
	return cloneCategoryValue(value);
}

/**
 * Clones Atom link values while preserving the scalar-or-array API.
 *
 * @param value - The Atom link value to clone
 * @returns The cloned Atom link value
 */
export function cloneAtomLinkInput(value?: RSS.AtomLinkInput): RSS.AtomLinkInput | undefined {
	if (value === undefined) return undefined;
	if (Array.isArray(value)) return value.map(cloneAtomLink) as RSS.AtomLink[];
	return cloneAtomLink(value);
}

/**
 * Clones enclosure values while preserving the scalar-or-array API.
 *
 * @param value - The enclosure value to clone
 * @returns The cloned enclosure value
 */
export function cloneEnclosureInput(value?: RSS.EnclosureInput): RSS.EnclosureInput | undefined {
	if (value === undefined) return undefined;
	if (Array.isArray(value)) return value.map(cloneEnclosure) as RSS.Enclosure[];
	return cloneEnclosure(value);
}

/**
 * Clones one category input value.
 *
 * @param value - The category value to clone
 * @returns The cloned category
 */
function cloneCategoryValue(value: RSS.CategoryInput): RSS.CategoryInput {
	if (typeof value === "string") return value;
	return {
		...value,
		attributes: cloneAttributes(value.attributes),
		extensions: cloneExtensionElements(value.extensions),
	};
}

/**
 * Clones one cloud value.
 *
 * @param cloud - The cloud to clone
 * @returns The cloned cloud
 */
function cloneCloud(cloud: RSS.Cloud): RSS.Cloud {
	return {
		...cloud,
		attributes: cloneAttributes(cloud.attributes),
		extensions: cloneExtensionElements(cloud.extensions),
	};
}

/**
 * Clones one image value.
 *
 * @param image - The image to clone
 * @returns The cloned image
 */
function cloneImage(image: RSS.Image): RSS.Image {
	return {
		...image,
		attributes: cloneAttributes(image.attributes),
		extensions: cloneExtensionElements(image.extensions),
	};
}

/**
 * Clones one textInput value.
 *
 * @param textInput - The textInput to clone
 * @returns The cloned textInput
 */
function cloneTextInput(textInput: RSS.TextInput): RSS.TextInput {
	return {
		...textInput,
		attributes: cloneAttributes(textInput.attributes),
		extensions: cloneExtensionElements(textInput.extensions),
	};
}

/**
 * Clones one Atom link value.
 *
 * @param atomLink - The Atom link to clone
 * @returns The cloned Atom link
 */
function cloneAtomLink(atomLink: RSS.AtomLink): RSS.AtomLink {
	return {
		...atomLink,
		attributes: cloneAttributes(atomLink.attributes),
		extensions: cloneExtensionElements(atomLink.extensions),
	};
}

/**
 * Clones one enclosure value.
 *
 * @param enclosure - The enclosure to clone
 * @returns The cloned enclosure
 */
function cloneEnclosure(enclosure: RSS.Enclosure): RSS.Enclosure {
	return {
		...enclosure,
		attributes: cloneAttributes(enclosure.attributes),
		extensions: cloneExtensionElements(enclosure.extensions),
	};
}

/**
 * Clones one source value.
 *
 * @param source - The source to clone
 * @returns The cloned source
 */
function cloneSource(source: RSS.Source): RSS.Source {
	return {
		...source,
		attributes: cloneAttributes(source.attributes),
		extensions: cloneExtensionElements(source.extensions),
	};
}
