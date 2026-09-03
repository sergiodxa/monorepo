/**
 * Public entrypoint for this package's pure token resolvers — `spacing()`,
 * `color()`, `radius()`, `font()`, `text()`, `container()`,
 * `containerLength()`, `shadow()`, `blur()` — plain string functions a
 * component package composes into a larger CSS object. It stays its own
 * subpath because several resolvers share a name with a root-namespace mixin
 * (`font()`, `text()`, `shadow()`, `blur()`): this subpath always yields the
 * resolver, the root always yields the mixin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export * from "./internal/tokens.js";
