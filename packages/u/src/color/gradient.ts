/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A gradient stop's color. The `(string & {})` member keeps any CSS color
 * accepted, so `"transparent"` and `"currentColor"` add autocomplete while the
 * type stays a plain string.
 */
export type GradientColor = "transparent" | "currentColor" | (string & {});

export type GradientStop = GradientColor | { color: GradientColor; position?: string };

/**
 * CSS's `linear-gradient()` side-or-corner keywords. The `(string & {})`
 * member keeps a raw angle such as `"45deg"` or `"0.25turn"` accepted, so the
 * named directions only add autocomplete.
 */
export type GradientDirection =
	| "to top"
	| "to top right"
	| "to right"
	| "to bottom right"
	| "to bottom"
	| "to bottom left"
	| "to left"
	| "to top left"
	| (string & {});

/**
 * Position keywords accepted after `at` in `radial-gradient()`'s and
 * `conic-gradient()`'s position clause.
 */
export type GradientPosition =
	| "center"
	| "top"
	| "bottom"
	| "left"
	| "right"
	| "top left"
	| "top right"
	| "bottom left"
	| "bottom right";

type GradientExtent = "closest-side" | "closest-corner" | "farthest-side" | "farthest-corner";

/**
 * `radial-gradient()`'s shape and extent keywords, plus the compound
 * shape/extent/position clauses. The `(string & {})` member keeps a position
 * given as a percentage accepted, so the keywords only add autocomplete.
 */
export type GradientShape =
	| "circle"
	| "ellipse"
	| GradientExtent
	| `${"circle" | "ellipse"} at ${GradientPosition}`
	| `${"circle" | "ellipse"} ${GradientExtent}`
	| `${"circle" | "ellipse"} ${GradientExtent} at ${GradientPosition}`
	| (string & {});

function formatStop(stop: GradientStop): string {
	if (typeof stop === "string") return stop;
	return stop.position ? `${stop.color} ${stop.position}` : stop.color;
}

/**
 * Builds a `linear-gradient(...)` value string for any `background-image` use.
 * A numeric `angle` is treated as degrees; a string passes through unchanged,
 * so CSS's own side/corner keywords work too.
 *
 * @example u.linearGradient(45, "red", "blue")
 * @example "linear-gradient(45deg, red, blue)"
 * @example u.linearGradient("to right", { color: "red", position: "20%" }, "blue")
 * @example "linear-gradient(to right, red 20%, blue)"
 */
export function linearGradient(
	angle: number | GradientDirection,
	...stops: GradientStop[]
): string {
	let angleValue = typeof angle === "number" ? `${angle}deg` : angle;
	return `linear-gradient(${angleValue}, ${stops.map(formatStop).join(", ")})`;
}

/**
 * Builds a `radial-gradient(...)` value string for any `background-image` use.
 * `shape` is the raw shape/size/position clause CSS expects, so a compound
 * clause such as `"ellipse at top left"` passes through unchanged.
 *
 * @example u.radialGradient("circle", "red", "blue")
 * @example "radial-gradient(circle, red, blue)"
 * @example u.radialGradient("circle at top left", { color: "red", position: "20%" }, "blue")
 * @example "radial-gradient(circle at top left, red 20%, blue)"
 */
export function radialGradient(shape: GradientShape, ...stops: GradientStop[]): string {
	return `radial-gradient(${shape}, ${stops.map(formatStop).join(", ")})`;
}

/**
 * Builds a `conic-gradient(...)` value string for any `background-image` use.
 * A numeric `angle` is treated as degrees and wrapped in the `from` keyword
 * CSS requires; a string passes through as the full `from ... at ...` clause.
 *
 * @example u.conicGradient(45, "red", "blue")
 * @example "conic-gradient(from 45deg, red, blue)"
 * @example u.conicGradient("from 45deg at top left", "red", "blue")
 * @example "conic-gradient(from 45deg at top left, red, blue)"
 */
export function conicGradient(
	angle: number | `from ${number}deg` | `from ${number}deg at ${GradientPosition}` | (string & {}),
	...stops: GradientStop[]
): string {
	let angleValue = typeof angle === "number" ? `from ${angle}deg` : angle;
	return `conic-gradient(${angleValue}, ${stops.map(formatStop).join(", ")})`;
}
