/**
 * Covers how a `@sdxc/ui` subpath module becomes pages: which exports earn a page, how
 * a mixin's arguments are read from its type, and which page a companion lands on. A
 * module with several pages is where a wrong owner would show `Zoom.Options` on `fade`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { readUiModule, toKebab } from "~/scripts/ui-exports";

/** A mixin module: an annotated mixin, the event it dispatches and the command it answers. */
const MIXIN_MODULE = `
/**
 * Copies a target's text.
 */

/** The command a copy button declares. */
export const COPY_COMMAND = "--copy" as const;

/** Dispatched once the write settles. */
export class CopyEvent extends Event {
	/** Whether the text reached the clipboard. */
	readonly success: boolean;
}

/**
 * Writes the target's text to the clipboard.
 *
 * @param options The delay and the
 * fallback text.
 * @example <button mix={[copy()]} />
 */
export const copy: MixinFactory<HTMLButtonElement, [options?: Copy.Options]> = createMixin<
	HTMLButtonElement,
	[options?: Copy.Options]
>((handle) => () => {});
`;

/** Two animations in one module, each with the namespace its options live in. */
const ANIMATION_MODULE = `
/** Options accepted by {@link fade}. */
export namespace Fade {
	export interface Options {
		/** Exit-state opacity. */
		opacity?: number;
	}
}

/** Fades the host. */
export function fade(options: Fade.Options = {}): CSSMixinDescriptor {
	return css({});
}

/** Options accepted by {@link zoom}. */
export namespace Zoom {
	export interface Options {
		scale?: number;
	}
}

/** Zooms the host. */
export function zoom(options: Zoom.Options = {}): CSSMixinDescriptor {
	return css({});
}
`;

describe("readUiModule", () => {
	test("gives a mixin its page and lists what it is used with beside it", () => {
		let [page, ...rest] = readUiModule(MIXIN_MODULE, "mixins", "copy", []) ?? [];

		expect(rest).toHaveLength(0);
		expect(page?.slug).toBe("copy");
		expect(page?.summary).toBe("Copies a target's text.");
		expect(page?.module).toBe("copy");
		expect(page?.symbol.signature).toBe(
			"copy(options?: Copy.Options): MixinDescriptor<HTMLButtonElement>",
		);
		expect(page?.symbol.parameters).toEqual([
			{
				name: "options",
				type: "Copy.Options",
				optional: true,
				description: "The delay and the fallback text.",
				values: [],
			},
		]);
		expect(page?.companions.map((companion) => [companion.kind, companion.name])).toEqual([
			["event", "CopyEvent"],
			["constant", "COPY_COMMAND"],
		]);
		expect(page?.companions[1]?.signature).toBe('const COPY_COMMAND = "--copy" as const');
	});

	test("reads a mixin built by an unannotated createMixin call", () => {
		let source = `
/** Validates a field. */
export const validate = createMixin<HTMLElement, [schema: Schema<unknown, unknown>]>(
	(handle) => () => {},
);
`;
		let [page] = readUiModule(source, "mixins", "validate", []) ?? [];

		expect(page?.symbol.signature).toBe(
			"validate(schema: Schema<unknown, unknown>): MixinDescriptor<HTMLElement>",
		);
	});

	test("files a namespace's types under the export it is named after", () => {
		let pages = readUiModule(ANIMATION_MODULE, "animations", "transitions", []) ?? [];

		expect(pages.map((page) => page.name)).toEqual(["fade", "zoom"]);
		expect(pages.map((page) => page.summary)).toEqual(["Fades the host.", "Zooms the host."]);
		expect(pages[0]?.companions.map((companion) => companion.name)).toEqual(["Fade.Options"]);
		expect(pages[1]?.companions.map((companion) => companion.name)).toEqual(["Zoom.Options"]);
		expect(pages[0]?.symbol.parameters[0]?.optional).toBe(true);
	});

	test("gives every value its own page in a module holding none of the subpath's kind", () => {
		let source = `
/** Named curves. */
export const easings = { standard: "ease" } as const;

/** Named steps. */
export const durations = { fast: 100 } as const;
`;
		let pages = readUiModule(source, "animations", "tokens", []) ?? [];

		expect(pages.map((page) => page.name)).toEqual(["easings", "durations"]);
		expect(pages[0]?.symbol.signature).toBe('const easings = { standard: "ease" } as const');
	});

	test("reads a behavior class's constructor, properties and methods", () => {
		let source = `
/** The queue's types. */
export namespace Queue {
	/** Construction options. */
	export interface Init {
		/** How many items it holds. */
		limit?: number;
	}
}

/** A queue of items. */
export class Queue<Item = unknown> extends EventTarget {
	/** @param init Construction options. */
	constructor(init: Queue.Init = {}) {
		super();
	}

	/** Number of queued items. */
	get size(): number {
		return 0;
	}

	/** Queues an item. */
	add(item: Item): string {
		return "";
	}

	#drop(): void {}
}
`;
		let [page] = readUiModule(source, "behaviors", "queue", []) ?? [];

		expect(page?.symbol.signature).toBe("new Queue<Item = unknown>(init?: Queue.Init)");
		expect(page?.symbol.members.map((row) => row.name)).toEqual(["size"]);
		expect(page?.symbol.methods).toEqual([
			{ name: "add", signature: "add(item: Item): string", description: "Queues an item." },
		]);
		expect(page?.companions.map((companion) => companion.name)).toEqual(["Queue.Init"]);
	});
});

describe("toKebab", () => {
	test("addresses camelCase and PascalCase names alike", () => {
		expect(toKebab("copyToClipboard")).toBe("copy-to-clipboard");
		expect(toKebab("ScrollFollowModel")).toBe("scroll-follow-model");
		expect(toKebab("CHART_COLOR")).toBe("chart_color");
	});
});
