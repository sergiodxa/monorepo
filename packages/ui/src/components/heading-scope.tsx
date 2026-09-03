/**
 * Establishes an ambient heading level read by nested headings and scopes,
 * keeping a document outline sequential without passing a level by hand.
 * Nesting moves one level deeper unless an explicit `level` fixes it, and
 * renders a `display: contents` host so composing it adds no layout box
 * while still exposing the depth via `data-heading-level`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { contents } from "@sdxc/u/layout";

/**
 * Semantic depth, from `1` (`<h1>`) through `6` (`<h6>`), shared by every
 * heading-related component's level resolution.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Native tag rendered for each supported {@link HeadingLevel}, as a single
 * level-to-element lookup table.
 */
export const TAG_BY_LEVEL: Record<HeadingLevel, "h1" | "h2" | "h3" | "h4" | "h5" | "h6"> = {
	1: "h1",
	2: "h2",
	3: "h3",
	4: "h4",
	5: "h5",
	6: "h6",
};

const DEFAULT_LEVEL: HeadingLevel = 1;

/** Deepest semantic depth the native heading elements support; a resolution past this clamps down to it. */
const MAX_LEVEL: HeadingLevel = 6;

/**
 * Prop and context types for {@link HeadingScope}.
 */
export namespace HeadingScope {
	/** Value {@link HeadingScope} provides to descendants through context. */
	export interface Context {
		/** Semantic depth this scope establishes for the headings and nested scopes rendered inside it. */
		level: HeadingLevel;
	}

	/**
	 * Native `<div>` attributes, plus `mix` and an optional `level` that
	 * fixes this scope's depth outright, overriding the ambient
	 * one-level-deeper default.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Explicit semantic depth for this scope. Defaults to one level past
		 * the nearest ancestor scope's depth, or `1` where no scope wraps
		 * this one at all.
		 */
		level?: HeadingLevel;
	}
}

/**
 * Reads the semantic depth from the nearest ancestor {@link HeadingScope},
 * always resolving safely to `undefined` when no ancestor scope exists,
 * regardless of how that absence surfaces.
 *
 * @param handle Runtime handle of the component performing the lookup.
 * @returns The nearest ancestor scope's depth, or `undefined` where nothing wraps the caller.
 * @example
 * let ambient = readAmbientLevel(handle); // 2, nested inside a HeadingScope holding level 2
 */
export function readAmbientLevel(handle: Handle<unknown, any>): HeadingLevel | undefined {
	try {
		let ambient = handle.context.get(HeadingScope) as HeadingScope.Context | undefined;

		return ambient?.level;
	} catch {
		return undefined;
	}
}

/**
 * Resolves the semantic depth a heading renders at: an explicit level wins,
 * then the nearest ancestor {@link HeadingScope}'s depth, then `1`, clamped
 * to `6` with a dev-mode warning to flatten or restart the nesting.
 *
 * @param handle Runtime handle of the component resolving its depth.
 * @param explicitLevel A `level` passed directly to the component, if any.
 * @returns The resolved, clamped {@link HeadingLevel}.
 * @example
 * let level = resolveHeadingLevel(handle, handle.props.level); // an explicit level always wins
 */
export function resolveHeadingLevel(
	handle: Handle<unknown, any>,
	explicitLevel?: HeadingLevel,
): HeadingLevel {
	let resolved: number = explicitLevel ?? readAmbientLevel(handle) ?? DEFAULT_LEVEL;

	if (resolved > MAX_LEVEL) {
		if (import.meta.env.DEV) {
			console.warn(
				`Heading nesting resolved to level ${resolved}, past the native "h1"–"h6" range. Flatten the nesting, or start a new top-level HeadingScope instead of nesting further.`,
			);
		}

		return MAX_LEVEL;
	}

	return resolved as HeadingLevel;
}

/**
 * Establishes an ambient heading level for descendants: an explicit `level`
 * fixes it, otherwise one level past the nearest ancestor {@link HeadingScope},
 * read before this scope publishes its own depth, or `1` with no ancestor.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing {@link HeadingScope.Context} to descendants.
 * @returns The render function producing the scope's markup.
 * @example
 * <HeadingScope>
 * 	<Heading>Document title</Heading>
 * 	<HeadingScope>
 * 		<Heading>Section title</Heading>
 * 	</HeadingScope>
 * </HeadingScope>
 */
export function HeadingScope(handle: Handle<HeadingScope.Props, HeadingScope.Context>) {
	return () => {
		let { level, mix, ...rest } = handle.props;
		let ambient = readAmbientLevel(handle);
		let requested = level ?? (ambient === undefined ? undefined : ((ambient + 1) as HeadingLevel));
		let resolved = resolveHeadingLevel(handle, requested);

		handle.context.set({ level: resolved });

		return <div {...rest} data-heading-level={resolved} mix={[contents(), mix]} />;
	};
}
