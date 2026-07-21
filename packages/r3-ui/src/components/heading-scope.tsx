/**
 * Establishes an ambient heading level read by every heading and every
 * further nested scope rendered inside it, so composing sections keeps a
 * document outline sequential without ever passing a level by hand. The
 * outermost scope in a tree, with nothing wrapping it, starts the outline
 * at its first level; a scope nested inside another moves one level deeper
 * automatically; and an explicit `level` fixes a scope's depth outright
 * where a document's structure calls for it. Renders a real host element
 * styled with `display: contents`, so composing it never inserts a layout
 * box of its own, while still giving a DOM-based lookup something concrete
 * to find through `data-heading-level`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

/**
 * Semantic depth, from `1` (`<h1>`) through `6` (`<h6>`), shared by every
 * heading-related component's level resolution.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Native tag rendered for each supported {@link HeadingLevel}, keeping the
 * level-to-element mapping a single lookup instead of a conditional chain.
 */
export const TAG_BY_LEVEL: Record<HeadingLevel, "h1" | "h2" | "h3" | "h4" | "h5" | "h6"> = {
	1: "h1",
	2: "h2",
	3: "h3",
	4: "h4",
	5: "h5",
	6: "h6",
};

/** Semantic depth a resolution falls back to when nothing supplies one at all. */
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
	 * Every native `<div>` attribute, plus the `mix` passthrough and an
	 * optional `level` fixing this scope's depth outright instead of moving
	 * one level past its own ambient scope.
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
 * Reads the semantic depth provided by the nearest ancestor
 * {@link HeadingScope}, guarded so a lookup finding no ancestor scope at
 * all resolves to `undefined` rather than reaching the caller as a thrown
 * error, whichever way that absence happens to surface.
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
 * Resolves the semantic depth a heading renders at: an explicit level
 * always wins, otherwise the nearest ancestor {@link HeadingScope}'s depth
 * applies, and `1` is the final fallback where nothing supplies either.
 * The result always lands in the native `1`–`6` range — a resolution past
 * `6` clamps down to it and, in dev mode, logs a `console.warn` explaining
 * that the nesting has gone past the native heading range and should be
 * flattened, or restarted from a new top-level scope, instead of nested
 * further.
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
 * Establishes an ambient heading level for every heading and every further
 * nested {@link HeadingScope} rendered inside it. An explicit `level` prop
 * fixes this scope's depth outright; otherwise, this scope moves one level
 * past its own ambient scope, or starts the outline at `1` where no scope
 * wraps it at all — reading that ambient value through
 * {@link readAmbientLevel} always resolves to the nearest ancestor scope's
 * depth, never this scope's own, since a scope's own depth has not been
 * published yet at the point it looks outward for one. Renders a `<div>`
 * styled with `display: contents`, so it never inserts a layout box of its
 * own, forwarding `mix` and every other host attribute, and carries
 * `data-heading-level` so a DOM-based lookup can find the active scope's
 * depth directly.
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

		return (
			<div {...rest} data-heading-level={resolved} mix={[css({ display: "contents" }), mix]} />
		);
	};
}
