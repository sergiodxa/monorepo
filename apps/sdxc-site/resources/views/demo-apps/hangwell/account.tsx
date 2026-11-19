/**
 * The shopper's account: an overview, the orders with their status, the library of print files
 * they own, saved addresses they add, edit, make default or delete, and the wishlist. The
 * shopper is always signed in; everything they change lives in their own cookies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { LinkButton } from "@sdxc/ui/link-button";

import type { Address } from "./data";
import type { Order, Visitor } from "./state";

import { FramedArt, PosterArt } from "./art";
import {
	COUNTRIES,
	SHOPPER,
	actionHref,
	addressLine,
	fileHref,
	findPoster,
	href,
	money,
} from "./data";
import { isDelivered, orderTotals, parcelStep } from "./orders";
import { Gutter, PageTitle, PosterGrid, WALL } from "./parts";
import { isPhysical, linePoster } from "./state";

/** Which account page is open. */
export type AccountTab = "overview" | "orders" | "library" | "addresses" | "wishlist";

/** The account's pages, in tab order. */
const TABS: { id: AccountTab; label: string; page: string }[] = [
	{ id: "overview", label: "Overview", page: "account" },
	{ id: "orders", label: "Orders", page: "account/orders" },
	{ id: "library", label: "Library", page: "account/library" },
	{ id: "addresses", label: "Addresses", page: "account/addresses" },
	{ id: "wishlist", label: "Wishlist", page: "account/wishlist" },
];

/** The account's tabs: a row that scrolls sideways on a phone. */
function AccountTabs(handle: Handle<{ current: AccountTab }>) {
	return () => (
		<nav
			aria-label="Account"
			mix={[
				raw({
					display: "flex",
					gap: "0.25rem",
					overflowX: "auto",
					borderBlockEnd: "1px solid var(--ui-neutral-border)",
					marginBlockEnd: "1.5rem",
					scrollbarWidth: "none",
				}),
			]}
		>
			{TABS.map((tab) => (
				<a
					href={href(tab.page)}
					aria-current={handle.props.current === tab.id ? "page" : undefined}
					mix={[
						raw({
							flex: "none",
							paddingInline: "0.875rem",
							paddingBlock: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
							textDecoration: "none",
							fontWeight: "500",
							borderBlockEnd: "2px solid transparent",
							marginBlockEnd: "-1px",
							"&[aria-current]": {
								color: "var(--ui-neutral-fg-emphasis)",
								borderBlockEndColor: "var(--ui-neutral-fg-emphasis)",
							},
						}),
						when("&:hover", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
					]}
				>
					{tab.label}
				</a>
			))}
		</nav>
	);
}

/** An order's state in two words. */
function orderStatus(order: Order, now: number): string {
	if (!order.lines.some(isPhysical)) return "Downloaded";
	if (isDelivered(order, now)) return "Delivered";
	let labels = {
		placed: "Placed",
		printing: "Printing",
		framing: "Framing",
		shipped: "Shipped",
		out: "Out for delivery",
		delivered: "Delivered",
	};
	return labels[parcelStep(order, now)];
}

/** A row of an order list: its pictures, number, date, status and total. */
function OrderRow(handle: Handle<{ order: Order; now: number }>) {
	return () => {
		let { now, order } = handle.props;
		let date = new Intl.DateTimeFormat("en-IE", {
			day: "numeric",
			month: "short",
			year: "numeric",
		}).format(order.placedAt);
		return (
			<li>
				<a
					href={href(`orders/${order.id}`)}
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "auto minmax(0, 1fr) auto",
							alignItems: "center",
							gap: "1rem",
							padding: "1rem",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-lg)",
							color: "inherit",
							textDecoration: "none",
						}),
						when("&:hover", raw({ borderColor: "var(--ui-neutral-fg-muted)" })),
					]}
				>
					<span mix={[raw({ display: "flex" })]}>
						{order.lines.slice(0, 3).map((line, index) => (
							<span
								mix={[
									raw({
										inlineSize: "2.75rem",
										padding: "0.25rem",
										backgroundColor: WALL,
										borderRadius: "var(--ui-radius-sm)",
										marginInlineStart: index === 0 ? "0" : "-0.75rem",
										boxShadow: "0 0 0 2px var(--ui-bg)",
									}),
								]}
							>
								{line.variant.format === "framed" ? (
									<FramedArt poster={linePoster(line)} frame={line.variant.frame} />
								) : (
									<PosterArt poster={linePoster(line)} />
								)}
							</span>
						))}
					</span>
					<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
						<strong mix={[raw({ fontWeight: "600" })]}>{order.number}</strong>
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{date} · {orderStatus(order, now)}
						</span>
					</span>
					<span mix={[raw({ fontWeight: "600", fontVariantNumeric: "tabular-nums" })]}>
						{money(orderTotals(order).total)}
					</span>
				</a>
			</li>
		);
	};
}

/** A list of orders. */
function OrderList(handle: Handle<{ orders: Order[]; now: number }>) {
	return () => (
		<ul
			mix={[raw({ listStyle: "none", margin: "0", padding: "0", display: "grid", gap: "0.75rem" })]}
		>
			{handle.props.orders.map((order) => (
				<OrderRow order={order} now={handle.props.now} />
			))}
		</ul>
	);
}

namespace AccountPage {
	export interface Props {
		tab: AccountTab;
		visitor: Visitor;
		now: number;
		/** The address being edited, or `"new"` for the add form. */
		editing?: string;
		/** Errors on the address form, and what was typed. */
		addressErrors?: { fields: Record<string, string>; values: Partial<Address> };
	}
}

/** One account page under the account's tabs. */
export default function AccountPage(handle: Handle<AccountPage.Props>) {
	return () => {
		let { addressErrors, editing, now, tab, visitor } = handle.props;
		let title = TABS.find((entry) => entry.id === tab)!.label;
		return (
			<Gutter narrow>
				<PageTitle eyebrow={`Signed in as ${SHOPPER.name} (demo)`}>
					{tab === "overview" ? `Hello, ${SHOPPER.name.split(" ")[0]}` : title}
				</PageTitle>
				<AccountTabs current={tab} />
				{tab === "overview" ? <Overview visitor={visitor} now={now} /> : null}
				{tab === "orders" ? <OrderList orders={visitor.orders} now={now} /> : null}
				{tab === "library" ? <Library visitor={visitor} /> : null}
				{tab === "addresses" ? (
					<Addresses visitor={visitor} editing={editing} errors={addressErrors} />
				) : null}
				{tab === "wishlist" ? <Wishlist visitor={visitor} /> : null}
			</Gutter>
		);
	};
}

/** The overview: the latest order, and a way into each part of the account. */
function Overview(handle: Handle<{ visitor: Visitor; now: number }>) {
	return () => {
		let { now, visitor } = handle.props;
		let owned = visitor.orders.flatMap((order) =>
			order.lines.filter((line) => !isPhysical(line)),
		).length;
		let cards: { title: string; text: string; page: string }[] = [
			{
				title: "Orders",
				text: `${visitor.orders.length} orders, with tracking and returns.`,
				page: "account/orders",
			},
			{
				title: "Library",
				text: `${owned} print ${owned === 1 ? "file" : "files"} to download again.`,
				page: "account/library",
			},
			{
				title: "Addresses",
				text: `${visitor.addresses.length} saved for checkout.`,
				page: "account/addresses",
			},
			{
				title: "Wishlist",
				text: `${visitor.wish.length} saved ${visitor.wish.length === 1 ? "poster" : "posters"}.`,
				page: "account/wishlist",
			},
		];
		return (
			<div mix={[raw({ display: "grid", gap: "2rem" })]}>
				<section aria-labelledby="hw-latest" mix={[raw({ display: "grid", gap: "0.75rem" })]}>
					<h2 id="hw-latest" mix={[raw({ margin: "0", fontSize: "1.125rem", fontWeight: "600" })]}>
						Latest order
					</h2>
					<OrderList orders={visitor.orders.slice(0, 1)} now={now} />
				</section>
				<ul
					mix={[
						raw({
							listStyle: "none",
							margin: "0",
							padding: "0",
							display: "grid",
							gap: "0.75rem",
							gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
						}),
					]}
				>
					{cards.map((card) => (
						<li>
							<a
								href={href(card.page)}
								mix={[
									raw({
										display: "grid",
										gap: "0.375rem",
										padding: "1.25rem",
										blockSize: "100%",
										boxSizing: "border-box",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "var(--ui-radius-lg)",
										color: "inherit",
										textDecoration: "none",
									}),
									when("&:hover", raw({ borderColor: "var(--ui-neutral-fg-muted)" })),
								]}
							>
								<strong mix={[raw({ fontWeight: "600" })]}>{card.title}</strong>
								<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
									{card.text}
								</span>
							</a>
						</li>
					))}
				</ul>
			</div>
		);
	};
}

/** Every print file the shopper bought, each a download. */
function Library(handle: Handle<{ visitor: Visitor }>) {
	return () => {
		let files = handle.props.visitor.orders.flatMap((order) =>
			order.lines.filter((line) => !isPhysical(line)).map((line) => ({ order, line })),
		);
		if (files.length === 0) {
			return (
				<div mix={[raw({ display: "grid", gap: "0.75rem", justifyItems: "start" })]}>
					<p mix={[raw({ margin: "0" })]}>
						Print files you buy show up here, ready to download again.
					</p>
					<LinkButton href={href("shop")} variant="outline">
						Browse posters
					</LinkButton>
				</div>
			);
		}
		return (
			<ul
				mix={[
					raw({
						listStyle: "none",
						margin: "0",
						padding: "0",
						display: "grid",
						gap: "1rem",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(12rem, 100%), 1fr))",
					}),
				]}
			>
				{files.map(({ line, order }) => {
					let poster = linePoster(line);
					return (
						<li mix={[raw({ display: "grid", gap: "0.5rem" })]}>
							<span
								mix={[
									raw({
										display: "grid",
										placeItems: "center",
										aspectRatio: "4 / 5",
										padding: "15%",
										backgroundColor: WALL,
										borderRadius: "var(--ui-radius-md)",
									}),
								]}
							>
								<PosterArt poster={poster} />
							</span>
							<strong mix={[raw({ fontWeight: "600" })]}>{poster.title}</strong>
							<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
								From order {order.number}
							</span>
							<a
								href={fileHref(`orders/${order.id}/${poster.id}.svg`)}
								download={`${poster.id}.svg`}
								data-rmx-document=""
								mix={[raw({ color: "inherit", fontWeight: "600" })]}
							>
								Download print file
							</a>
						</li>
					);
				})}
			</ul>
		);
	};
}

namespace AddressForm {
	export interface Props {
		address: Partial<Address>;
		errors: Record<string, string>;
		action: string;
		submit: string;
	}
}

/** An address form: a post that keeps what was typed when a field is missing. */
function AddressForm(handle: Handle<AddressForm.Props>) {
	return () => {
		let { action, address, errors, submit } = handle.props;
		let field = (name: keyof Address, label: string, autocomplete: string, required = true) => (
			<div mix={[raw({ display: "grid", gap: "0.375rem" })]}>
				<label
					htmlFor={`hw-address-${name}`}
					mix={[raw({ fontSize: "0.875rem", fontWeight: "500" })]}
				>
					{label}
				</label>
				<input
					id={`hw-address-${name}`}
					name={name}
					value={address[name] ?? ""}
					required={required}
					autocomplete={autocomplete}
					aria-invalid={errors[name] === undefined ? undefined : "true"}
					mix={[
						raw({
							blockSize: "2.75rem",
							paddingInline: "0.75rem",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-md)",
							font: "inherit",
							backgroundColor: "var(--ui-bg)",
							color: "inherit",
							"&[aria-invalid]": { borderColor: "oklch(0.55 0.2 25)" },
						}),
					]}
				/>
				{errors[name] === undefined ? null : (
					<span mix={[raw({ fontSize: "0.8125rem", color: "oklch(0.5 0.2 25)" })]}>
						{errors[name]}
					</span>
				)}
			</div>
		);
		return (
			<form
				method="post"
				action={action}
				novalidate
				mix={[
					raw({
						display: "grid",
						gap: "0.75rem",
						gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
						padding: "1.25rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
					}),
				]}
			>
				{field("name", "Full name", "name")}
				{field("line1", "Address", "address-line1")}
				{field("line2", "Apartment, floor (optional)", "address-line2", false)}
				{field("city", "City", "address-level2")}
				{field("postcode", "Postcode", "postal-code")}
				<div mix={[raw({ display: "grid", gap: "0.375rem" })]}>
					<label
						htmlFor="hw-address-country"
						mix={[raw({ fontSize: "0.875rem", fontWeight: "500" })]}
					>
						Country
					</label>
					<select
						id="hw-address-country"
						name="country"
						mix={[
							raw({
								blockSize: "2.75rem",
								paddingInline: "0.5rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-md)",
								font: "inherit",
								backgroundColor: "var(--ui-bg)",
								color: "inherit",
							}),
						]}
					>
						{COUNTRIES.map((country) => (
							<option value={country.id} selected={(address.country ?? "PT") === country.id}>
								{country.name}
							</option>
						))}
					</select>
				</div>
				<div
					mix={[
						raw({ gridColumn: "1 / -1", display: "flex", gap: "0.75rem", alignItems: "center" }),
					]}
				>
					<button
						type="submit"
						mix={[
							raw({
								blockSize: "2.75rem",
								paddingInline: "1.25rem",
								border: "0",
								borderRadius: "var(--ui-cta-radius)",
								font: "inherit",
								fontWeight: "600",
								color: "var(--ui-bg)",
								backgroundColor: "var(--ui-neutral-fg-emphasis)",
								cursor: "pointer",
							}),
						]}
					>
						{submit}
					</button>
					<a href={href("account/addresses")} mix={[raw({ color: "inherit" })]}>
						Cancel
					</a>
				</div>
			</form>
		);
	};
}

/** Saved addresses, the first being the default, with add, edit, make default and delete. */
function Addresses(
	handle: Handle<{
		visitor: Visitor;
		editing?: string;
		errors?: { fields: Record<string, string>; values: Partial<Address> };
	}>,
) {
	return () => {
		let { editing, errors, visitor } = handle.props;
		let small = (label: string): RemixNode => label;
		return (
			<div mix={[raw({ display: "grid", gap: "1rem" })]}>
				<ul
					mix={[
						raw({
							listStyle: "none",
							margin: "0",
							padding: "0",
							display: "grid",
							gap: "0.75rem",
							gridTemplateColumns: "repeat(auto-fill, minmax(min(18rem, 100%), 1fr))",
						}),
					]}
				>
					{visitor.addresses.map((address, index) =>
						editing === address.id ? (
							<li mix={[raw({ gridColumn: "1 / -1" })]}>
								<AddressForm
									address={{ ...address, ...errors?.values }}
									errors={errors?.fields ?? {}}
									action={actionHref(`account/addresses/${address.id}`)}
									submit="Save address"
								/>
							</li>
						) : (
							<li
								id={`address-${address.id}`}
								mix={[
									raw({
										display: "grid",
										gap: "0.75rem",
										alignContent: "space-between",
										padding: "1.25rem",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "var(--ui-radius-lg)",
									}),
								]}
							>
								<div mix={[raw({ display: "grid", gap: "0.25rem" })]}>
									<strong mix={[raw({ fontWeight: "600" })]}>
										{address.name}
										{index === 0 ? (
											<span
												mix={[
													raw({
														marginInlineStart: "0.5rem",
														fontSize: "0.75rem",
														fontWeight: "600",
														paddingInline: "0.5rem",
														borderRadius: "999px",
														backgroundColor: "var(--ui-neutral-bg-tint)",
													}),
												]}
											>
												Default
											</span>
										) : null}
									</strong>
									<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "0.9375rem" })]}>
										{addressLine(address)}
									</span>
								</div>
								<div
									mix={[
										raw({
											display: "flex",
											flexWrap: "wrap",
											gap: "1rem",
											fontSize: "0.875rem",
											"& button, & a": {
												padding: "0",
												border: "0",
												background: "none",
												font: "inherit",
												color: "inherit",
												textDecoration: "underline",
												cursor: "pointer",
											},
										}),
									]}
								>
									<a href={href(`account/addresses?edit=${address.id}`)}>{small("Edit")}</a>
									{index === 0 ? null : (
										<form
											method="post"
											action={actionHref(`account/addresses/${address.id}/default`)}
										>
											<button type="submit">Make default</button>
										</form>
									)}
									<form method="post" action={actionHref(`account/addresses/${address.id}/delete`)}>
										<button type="submit">Delete</button>
									</form>
								</div>
							</li>
						),
					)}
				</ul>
				{editing === "new" ? (
					<AddressForm
						address={errors?.values ?? {}}
						errors={errors?.fields ?? {}}
						action={actionHref("account/addresses/new")}
						submit="Add address"
					/>
				) : null}
				{editing !== "new" && visitor.addresses.length >= 4 ? (
					<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
						The demo keeps up to four addresses.
					</p>
				) : null}
				{editing === "new" || visitor.addresses.length >= 4 ? null : (
					<LinkButton href={href("account/addresses?edit=new")} variant="outline">
						Add an address
					</LinkButton>
				)}
			</div>
		);
	};
}

/** The wishlist as a grid, or the way to fill it. */
function Wishlist(handle: Handle<{ visitor: Visitor }>) {
	return () => {
		let { visitor } = handle.props;
		let posters = visitor.wish.map((id) => findPoster(id)).filter((poster) => poster !== undefined);
		if (posters.length === 0) {
			return (
				<div mix={[raw({ display: "grid", gap: "0.75rem", justifyItems: "start" })]}>
					<p mix={[raw({ margin: "0" })]}>Tap the heart on any poster to keep it here.</p>
					<LinkButton href={href("shop")} variant="outline">
						Browse posters
					</LinkButton>
				</div>
			);
		}
		return (
			<PosterGrid
				posters={posters}
				wish={visitor.wish}
				back="account/wishlist"
				label="Your wishlist"
			/>
		);
	};
}
