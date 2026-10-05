/**
 * The `@sdxc/ui` subpaths the site documents beside its components, and how each is
 * titled. They live apart from the document reader so the build-time extractor can
 * import them without the bundler's glob that loads the document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The subpaths, in the order the sidebar and the package's index list them. */
export const UI_SUBPATHS = ["mixins", "behaviors", "animations", "styles"] as const;

/** One subpath of the package, imported as `@sdxc/ui/<subpath>`. */
export type UiSubpath = (typeof UI_SUBPATHS)[number];

/** How each subpath is titled in the sidebar and on the package's index. */
export const UI_SUBPATH_TITLES: Record<UiSubpath, string> = {
	mixins: "Mixins",
	behaviors: "Behaviors",
	animations: "Animations",
	styles: "Styles",
};

/** Whether a URL segment names one of the documented subpaths. */
export function isUiSubpath(value: string): value is UiSubpath {
	return (UI_SUBPATHS as readonly string[]).includes(value);
}
