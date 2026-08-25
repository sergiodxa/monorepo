/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue, SemanticToneName } from "../types";

import { compose } from "../internal/descriptor";

import { bg } from "./bg";
import { border } from "./border";
import { fg } from "./fg";

export type SurfaceRecipe = "default" | "muted" | SemanticToneName | `${SemanticToneName}.tinted`;

/**
 * Composes `u.bg()`, `u.fg()`, and `u.border()` so a surface's contrast holds
 * by construction. Accepts recipe names only, because a surface's background,
 * foreground, and border must be chosen as one matching set.
 *
 * @example u.surface()
 * @example css({ backgroundColor: "var(--ui-bg, Canvas)", color: "var(--ui-fg, CanvasText)", borderColor: "var(--ui-border, ...)" })
 * @example u.surface("brand.tinted")
 * @example css({ backgroundColor: "var(--ui-brand-bg-tint)", color: "var(--ui-brand-fg-emphasis)", borderColor: "var(--ui-brand-border)" })
 * @example u.surface("danger")
 * @example css({ backgroundColor: "var(--ui-danger-bg-solid)", color: "var(--ui-danger-fg-on-solid)", borderColor: "var(--ui-danger-bg-solid)" })
 */
export function surface<Node extends Element = Element>(recipe: SurfaceRecipe = "default") {
	if (recipe === "default") {
		return compose<Node>([bg<Node>(), fg<Node>(), border<Node>()], (styles) => styles);
	}

	if (recipe === "muted") {
		return compose<Node>(
			[bg<Node>("neutral.tint"), fg<Node>("neutral"), border<Node>("neutral")],
			(styles) => styles,
		);
	}

	let [tone, variant] = recipe.split(".") as [SemanticToneName, string | undefined];

	if (variant === "tinted") {
		return compose<Node>(
			[
				bg<Node>(`${tone}.tint` as ColorValue),
				fg<Node>(`${tone}.emphasis` as ColorValue),
				border<Node>(`${tone}.border` as ColorValue),
			],
			(styles) => styles,
		);
	}

	return compose<Node>(
		[
			bg<Node>(`${tone}.solid` as ColorValue),
			fg<Node>(`${tone}.onSolid` as ColorValue),
			border<Node>(`${tone}.solid` as ColorValue),
		],
		(styles) => styles,
	);
}
