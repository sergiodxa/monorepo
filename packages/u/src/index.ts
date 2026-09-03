/**
 * The root entrypoint: every public utility mixin from every family,
 * re-exported so `import * as u from "@sdxc/u"` carries the whole surface
 * while `import { bg, p } from "@sdxc/u"` still tree-shakes down to just those
 * utilities. The token-name interfaces ship here too, since declaration
 * merging (`declare module "@sdxc/u"`) targets this module specifier. Pure
 * token resolvers live at the `@sdxc/u/tokens` subpath.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export * from "./a11y/index.js";
export * from "./animation/index.js";
export * from "./color/index.js";
export * from "./effects/index.js";
export * from "./general/index.js";
export * from "./layout/index.js";
export * from "./overflow/index.js";
export * from "./responsive/index.js";
export * from "./size/index.js";
export * from "./stacking/index.js";
export * from "./state/index.js";
export * from "./transform/index.js";
export * from "./types.js";
export * from "./typography/index.js";
