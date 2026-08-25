/**
 * The root entrypoint: every public utility mixin from every family,
 * re-exported so `import * as u from "@pkg/u"` carries the whole surface
 * while `import { bg, p } from "@pkg/u"` still tree-shakes down to just those
 * utilities. The token-name interfaces ship here too, since declaration
 * merging (`declare module "@pkg/u"`) targets this module specifier. Pure
 * token resolvers live at the `@pkg/u/tokens` subpath.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export * from "./a11y";
export * from "./animation";
export * from "./color";
export * from "./effects";
export * from "./general";
export * from "./layout";
export * from "./overflow";
export * from "./responsive";
export * from "./size";
export * from "./stacking";
export * from "./state";
export * from "./transform";
export * from "./types";
export * from "./typography";
