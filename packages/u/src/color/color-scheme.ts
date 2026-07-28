/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/**
 * The values `color-scheme` accepts. `"light dark"` and `"dark light"` both
 * declare support for both schemes — the order is only a preference hint used
 * when the user has expressed none. `"normal"` is the initial value: the
 * element declares no scheme at all. The `"only "` prefix pins a scheme and
 * additionally opts out of the browser's own automatic dark-mode adjustments.
 * A raw string escape hatch stays open for values this union hasn't caught up
 * with yet.
 */
export type ColorSchemeValue =
	| "light"
	| "dark"
	| "light dark"
	| "dark light"
	| "normal"
	| "only light"
	| "only dark"
	| (string & {});

/**
 * Sets `color-scheme`, the declaration that tells the browser which color
 * schemes an element renders correctly in — and therefore how to paint the
 * chrome it draws itself.
 *
 * This closes the one hole the rest of the dark-mode story can't reach.
 * `u.scheme()`/`u.dark()`/`u.light()`, the `.dark`/`.light`/`.system`
 * ancestor-class protocol, and the semantic tone layer that redefines every
 * `--ui-{tone}-*` variable together recolor everything *these utilities*
 * paint. They have no effect on what the *browser* paints: scrollbars, the
 * canvas background behind the document, `<select>` dropdown menus, date and
 * color pickers, number-input spinner buttons, and the default borders of
 * form controls. Without `color-scheme`, a fully dark-themed app still renders
 * a white scrollbar and a light date picker over its dark page.
 *
 * `color-scheme` is inherited, so declaring it once on `<html>` covers the
 * whole document — that is the normal usage. Reach for it on a single element
 * only for a subtree that genuinely opts out of the document's scheme, such as
 * a permanently light preview panel inside a dark app.
 *
 * The values, and when each is the right one:
 *
 * - `"light dark"` (the default here) declares that the element supports both
 *   schemes and the user's preference decides. This is the value that makes
 *   native UI follow `prefers-color-scheme` automatically, with no media query
 *   of its own, which is why it is the default.
 * - A single value such as `"dark"` *forces* dark native UI regardless of the
 *   user's preference. This is what an app with a forced theme wants: it is
 *   the native-UI counterpart to the `.dark` ancestor class `u.scheme()` reads,
 *   so an app that forces `.dark` on `<html>` should set `u.colorScheme("dark")`
 *   there too, or its own colors will be dark while the browser's stay light.
 * - `"only light"` pins the light scheme *and* opts out of the browser's
 *   automatic dark-mode adjustments entirely, for a design that must render
 *   exactly as authored.
 * - `"normal"` is the initial value — no scheme declared, which in practice
 *   means light native chrome.
 *
 * There is one more payoff worth knowing about. `color-scheme` also changes
 * what the `Canvas` and `CanvasText` system colors resolve to, and those are
 * exactly the fallbacks a bare `u.bg()` and `u.fg()` use before an app defines
 * `--ui-bg`/`--ui-fg` — so setting the scheme makes those tiny system defaults
 * follow it for free.
 *
 * Once the scheme is set, individual pieces of native chrome can still be
 * overridden by hand: `u.accent()` for checkboxes, radios, ranges, and
 * progress bars, `u.caretColor()` for the text-insertion cursor, and
 * `u.scrollbarColor()` for a scrollbar's thumb and track.
 *
 * @example u.colorScheme()
 * @example css({ colorScheme: "light dark" })
 * @example u.colorScheme("dark")
 * @example css({ colorScheme: "dark" })
 * @example u.colorScheme("only light")
 * @example css({ colorScheme: "only light" })
 */
export function colorScheme<Node extends Element = Element>(
	value: ColorSchemeValue = "light dark",
): UtilityMixin<Node> {
	return utility<Node>(() => ({ colorScheme: value }) as CSSStyles);
}
