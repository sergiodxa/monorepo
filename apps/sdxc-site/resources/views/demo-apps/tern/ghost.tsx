/**
 * Placeholder shapes for Tern's frames: a ghost lays its content out unseen and paints a bar
 * per line, or a block of bars over a whole region, so a placeholder takes the exact size of
 * the part it stands in for at every width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

/**
 * Renders inline content invisibly under a neutral bar that repeats on every wrapped line, so
 * a name that wraps on a phone wraps in its placeholder too.
 */
export function Ghost(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<span
			data-slot="tern-ghost"
			mix={[
				raw({
					backgroundColor: "var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-sm, 0.25rem)",
					boxDecorationBreak: "clone",
					WebkitBoxDecorationBreak: "clone",
					userSelect: "none",
				}),
			]}
		>
			<span mix={[raw({ visibility: "hidden" })]}>{handle.props.children}</span>
		</span>
	);
}

/**
 * Lays out a whole region unseen and draws text-height bars across it, one per line of its
 * type, for content such as code whose lines the bars should follow.
 */
export function GhostBlock(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<div
			aria-hidden="true"
			inert
			mix={[
				raw({
					position: "relative",
					"&::after": {
						content: '""',
						position: "absolute",
						inset: "1rem",
						borderRadius: "var(--ui-radius-sm, 0.25rem)",
						background:
							"repeating-linear-gradient(to bottom, var(--ui-neutral-border) 0 0.75em, transparent 0.75em 1.6em)",
						maskImage: "linear-gradient(to right, black 70%, transparent)",
					},
				}),
			]}
		>
			<div mix={[raw({ visibility: "hidden" })]}>{handle.props.children}</div>
		</div>
	);
}
