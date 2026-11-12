/**
 * The code-shaped placeholder for Tern's canvas: a whole region laid out unseen under bars
 * that follow its lines of type, so the placeholder takes the exact size of the code it
 * stands in for at every width. Inline text uses `Skeleton.Text` from `@sdxc/ui`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

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
