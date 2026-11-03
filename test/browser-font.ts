/**
 * Browser-test setup that sets every page, and every theme's font tokens, in fonts Linux resolves
 * to metric-compatible Liberation faces, so text wraps to the same lines on a developer's Mac and
 * on CI and a layout assertion measures the component instead of the operating system's fonts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Arial, Times New Roman and Courier New on macOS; Liberation Sans, Serif and Mono on Linux, which
 * share their glyph widths. Declared important on every element, the tokens win over a theme scoped
 * anywhere in the tree, and the root face covers text no token reaches.
 */
const FONTS = `
	:root { font-family: Arial, "Liberation Sans", sans-serif; }
	* {
		--ui-font-sans: Arial, "Liberation Sans", sans-serif !important;
		--ui-font-display: Arial, "Liberation Sans", sans-serif !important;
		--ui-font-serif: "Times New Roman", "Liberation Serif", serif !important;
		--ui-font-mono: "Courier New", "Liberation Mono", monospace !important;
	}
`;

/** The stylesheet carrying {@link FONTS}, appended once per page before any test file loads. */
const STYLE = document.createElement("style");
STYLE.textContent = FONTS;
document.head.append(STYLE);
