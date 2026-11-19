/**
 * The bag a shop slides in from the side: the lines, a note such as a free-shipping meter, the
 * subtotal and the way to checkout, in a drawer the header's bag link opens. The link goes to
 * the cart page without script, and opens the drawer in place once the page has hydrated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ShoppingBagIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { clientEntry } from "remix/component";

import { Drawer } from "../components/drawer.js";
import { LinkButton } from "../components/link-button.js";

/** Prop types for {@link CartDrawer} and {@link CartDrawer.Trigger}. */
export namespace CartDrawer {
	/** The words the drawer's controls carry. */
	export interface Labels {
		checkout: string;
		viewCart: string;
		/** The close button's name. */
		close: string;
	}

	/** Props accepted by {@link CartDrawer}; the host is the drawer's `<dialog>`. */
	export interface Props {
		/** The dialog's id, which {@link CartDrawer.Trigger} names as its `drawer`. */
		id: string;
		title: RemixNode;
		/** The lines, usually a `<ul>` of `CartLine`; leave it out for an empty bag. */
		children?: RemixNode;
		/** Shown in place of the lines, subtotal and checkout when the bag is empty. */
		empty?: RemixNode;
		/** The subtotal as the reader sees it, set beside its own label by the caller. */
		subtotal: RemixNode;
		/** Above the subtotal, such as a free-shipping meter. */
		note?: RemixNode;
		checkoutHref: string;
		cartHref: string;
		labels: Labels;
	}

	/** Props accepted by {@link CartDrawer.Trigger}; the host is an `<a>` named by `label` and `count`. */
	export interface TriggerProps extends Pick<TagProps<"a">, "id" | "mix" | "title"> {
		/** The id of the {@link CartDrawer} it opens. */
		drawer: string;
		/** The cart page, followed when the drawer is absent or the page has no script. */
		href: string;
		/** How many items the bag holds; the badge hides at zero. */
		count: number;
		/** The link's name, such as "Bag"; the count is appended for assistive tech. */
		label: string;
		/** Appended to the name with `{n}` for the count. @default "{n} items" */
		countLabel?: string;
	}

	/** Props {@link CartDrawerLive} serializes for hydration. */
	export type LiveProps = Record<never, never>;
}

/** Whether a click asks for the link's page somewhere else: a new tab, window or download. */
function opensElsewhere(event: MouseEvent, link: HTMLAnchorElement): boolean {
	return (
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey ||
		(link.target !== "" && link.target !== "_self")
	);
}

/**
 * Opens the drawer a bag link names instead of following it. One listener on the document
 * serves every bag link on the page, and a click another listener already took is left alone,
 * so several triggers never open the drawer twice. A link whose drawer is missing navigates.
 */
export const CartDrawerLive: EntryComponent<CartDrawer.LiveProps> = clientEntry(
	"@sdxc/ui/commerce/cart-drawer#CartDrawerLive",
	function CartDrawerLive(handle: Handle<CartDrawer.LiveProps>) {
		handle.queueTask(() => {
			if (handle.signal.aborted) return;
			document.addEventListener(
				"click",
				(event) => {
					if (event.defaultPrevented || !(event.target instanceof Element)) return;
					let link = event.target.closest<HTMLAnchorElement>("a[data-cart-drawer]");
					if (link === null || opensElsewhere(event, link)) return;
					let dialog = document.getElementById(link.dataset.cartDrawer ?? "");
					if (!(dialog instanceof HTMLDialogElement)) return;
					event.preventDefault();
					if (!dialog.open) dialog.showModal();
				},
				{ signal: handle.signal },
			);
		});
		return () => <span hidden data-slot="cart-drawer-live" />;
	},
);

/**
 * Renders the drawer docked to the right edge: the title and close button, the lines
 * scrolling between them and a footer holding the note, the subtotal, a full-width checkout
 * link and a link to the cart page. An empty bag shows `empty` alone.
 *
 * @example
 * <CartDrawer id="bag" title="Your bag" subtotal={<Amount value={4800} currency="EUR" />} checkoutHref="/checkout" cartHref="/cart" labels={{ checkout: "Checkout", viewCart: "View bag", close: "Close" }}><ul>…</ul></CartDrawer>
 */
export function CartDrawer(handle: Handle<CartDrawer.Props>) {
	return () => {
		let { cartHref, checkoutHref, children, empty, id, labels, note, subtotal, title } =
			handle.props;
		let titleId = `${id}-title`;
		let isEmpty =
			children === undefined ||
			children === null ||
			children === false ||
			(Array.isArray(children) && children.length === 0);
		return (
			<Drawer
				id={id}
				placement="right"
				closedby="any"
				aria-labelledby={titleId}
				data-cart-drawer-panel=""
				mix={[
					raw({
						inlineSize: "min(26rem, 100vw)",
						maxInlineSize: "100vw",
						gap: "0",
						padding: "0",
					}),
				]}
			>
				<Drawer.Header
					mix={[
						raw({
							paddingBlock: "1.25rem 1rem",
							paddingInline: "1.25rem 3.5rem",
							textAlign: "start",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<Drawer.Title id={titleId}>{title}</Drawer.Title>
				</Drawer.Header>
				<Drawer.Close commandfor={id} aria-label={labels.close} />
				<div
					data-slot="cart-drawer-lines"
					mix={[
						raw({
							flex: "1 1 auto",
							minBlockSize: "0",
							overflowY: "auto",
							overscrollBehavior: "contain",
							paddingInline: "1.25rem",
							"& > ul": { margin: "0", padding: "0", listStyle: "none" },
						}),
					]}
				>
					{isEmpty ? (
						<div
							data-slot="cart-drawer-empty"
							mix={[
								raw({
									paddingBlock: "2.5rem",
									textAlign: "center",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{empty}
						</div>
					) : (
						children
					)}
				</div>
				{isEmpty ? null : (
					<div
						data-slot="cart-drawer-footer"
						mix={[
							raw({
								display: "grid",
								gap: "0.75rem",
								padding: "1rem 1.25rem 1.25rem",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
								backgroundColor: "var(--ui-neutral-bg-tint, transparent)",
							}),
						]}
					>
						{note === undefined ? null : <div data-slot="cart-drawer-note">{note}</div>}
						<div
							data-slot="cart-drawer-subtotal"
							mix={[
								raw({
									display: "flex",
									justifyContent: "space-between",
									alignItems: "baseline",
									gap: "1rem",
									fontWeight: "650",
									color: "var(--ui-neutral-fg-emphasis)",
									fontVariantNumeric: "tabular-nums",
								}),
							]}
						>
							{subtotal}
						</div>
						<LinkButton href={checkoutHref} size="lg" mix={[raw({ inlineSize: "100%" })]}>
							{labels.checkout}
						</LinkButton>
						<a
							href={cartHref}
							mix={[
								raw({
									justifySelf: "center",
									fontSize: "0.875rem",
									color: "var(--ui-neutral-fg)",
									textDecoration: "underline",
									textUnderlineOffset: "0.2em",
								}),
							]}
						>
							{labels.viewCart}
						</a>
					</div>
				)}
			</Drawer>
		);
	};
}

/**
 * Renders the header's bag link: an icon with a count badge, named "Bag, 2 items" for
 * assistive tech. It follows `href` until {@link CartDrawerLive} runs, then opens the drawer
 * in place when that drawer is on the page.
 *
 * @example <CartDrawer.Trigger drawer="bag" href="/cart" count={2} label="Bag" />
 */
CartDrawer.Trigger = function CartDrawerTrigger(handle: Handle<CartDrawer.TriggerProps>) {
	return () => {
		let { count, countLabel = "{n} items", drawer, href, label, mix, ...rest } = handle.props;
		let name = `${label}, ${countLabel.replace("{n}", String(count))}`;
		return (
			<>
				<a
					{...rest}
					href={href}
					aria-label={name}
					aria-haspopup="dialog"
					data-cart-drawer={drawer}
					data-slot="cart-drawer-trigger"
					mix={mergeMix(
						[
							raw({
								position: "relative",
								display: "inline-grid",
								placeItems: "center",
								inlineSize: "2.75rem",
								blockSize: "2.75rem",
								borderRadius: "999px",
								color: "var(--ui-neutral-fg-emphasis)",
								"& > svg": { inlineSize: "1.375rem", blockSize: "1.375rem" },
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
								"&:focus-visible": {
									outline: "2px solid var(--ui-brand-ring)",
									outlineOffset: "2px",
								},
							}),
						],
						mix,
					)}
				>
					<ShoppingBagIcon aria-hidden="true" />
					{count > 0 ? (
						<span
							data-slot="cart-drawer-count"
							aria-hidden="true"
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "0.125rem",
									insetInlineEnd: "0.0625rem",
									minInlineSize: "1.125rem",
									blockSize: "1.125rem",
									paddingInline: "0.3125rem",
									boxSizing: "border-box",
									borderRadius: "999px",
									display: "grid",
									placeItems: "center",
									fontSize: "0.6875rem",
									fontWeight: "700",
									lineHeight: "1",
									fontVariantNumeric: "tabular-nums",
									color: "var(--ui-brand-fg-on-solid)",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						>
							{count > 99 ? "99+" : String(count)}
						</span>
					) : null}
				</a>
				<CartDrawerLive />
			</>
		);
	};
};
