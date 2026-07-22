/**
 * Public entrypoint for this package's pure token resolvers — `spacing()`,
 * `color()`, `radius()`, `font()`, `text()`, `container()`, `shadow()`,
 * `blur()` — for component packages that need to build a larger CSS object
 * without duplicating this package's token-resolution logic. These resolvers
 * are plain string functions: they don't call `css()`, build a mixin, or
 * register anything at runtime.
 *
 * Kept as its own subpath (`@pkg/u/tokens`) rather than re-exported from the
 * package root, since several resolvers here share a name with a utility
 * mixin in the root namespace (`font()`/`text()`/`shadow()`/`blur()` each
 * name both a resolver and a mixin) — importing from this subpath always
 * gets the resolver, importing `u.font()` etc. from the root always gets
 * the mixin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export * from "./internal/tokens";
