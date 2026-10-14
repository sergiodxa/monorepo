/**
 * Reconciles the DOM `Element` with the Workers runtime's HTMLRewriter `Element`, which the
 * generated runtime types declare globally and TypeScript merges into one interface, so a
 * `<select>` takes the same `mix` values as every other element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The merged `Element` requires a `remove(): Element` overload that only `HTMLSelectElement`
 * lacks, since it alone redeclares `remove()`; this overload keeps it an `Element`, so a
 * `MixinDescriptor<Element>` from `css()` or `@sdxc/u` is accepted on `<select>`.
 */
interface HTMLSelectElement {
	remove(): Element;
}
