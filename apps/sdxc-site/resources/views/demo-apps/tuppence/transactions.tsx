/**
 * Tuppence's statement: every movement grouped by day with each day's net, searchable and
 * filtered by direction, category and account in the address, with the open transaction in
 * a side sheet where its category, split and note are changed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { allocate } from "@sdxc/money";
import { raw } from "@sdxc/u/general";
import { Button, LinkButton, Select, TextArea } from "@sdxc/ui";
import { setParamHref } from "@sdxc/ui/app";
import { DetailSheet } from "@sdxc/ui/app/detail-sheet";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { Ledger } from "@sdxc/ui/finance/ledger";

import type { Entry, Wallet } from "./state";

import {
	ACCOUNTS,
	CATEGORIES,
	HOME,
	LOCALE,
	TODAY,
	actionHref,
	findAccount,
	findCategory,
	findMerchant,
	href,
	toHome,
} from "./data";
import { EntryRow } from "./ledger-parts";
import {
	CategoryTile,
	MerchantMark,
	Money,
	SERIF,
	Screen,
	ScreenTitle,
	dayTitle,
	longDate,
} from "./parts";
import { NOTE_LIMIT, SPLIT_LIMIT, entries } from "./state";

/** How many movements a page shows before "Show older". */
const PAGE = 60;

/** The filter bar's strings. */
const FILTER_LABELS: FilterBar.Labels = {
	toolbar: "Filter transactions",
	tabs: "Direction",
	filters: "Filters",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
	options: "Options",
};

/** The detail sheet's strings. */
const SHEET_LABELS: DetailSheet.Labels = {
	close: "Close",
	copyLink: "Copy link",
	linkCopied: "Link copied",
	previous: "Previous transaction",
	next: "Next transaction",
	position: "Transaction",
};

/** The statement's state as the address carries it. */
export interface StatementQuery {
	q: string;
	flow: "all" | "in" | "out";
	categories: string[];
	accounts: string[];
	limit: number;
	tx: string | null;
}

/**
 * Reads the statement's filters from the address; unknown values are dropped.
 *
 * @param url The page's address.
 * @param account An account the screen is fixed to, which then ignores the account filter.
 */
export function readQuery(url: URL, account?: string): StatementQuery {
	let params = url.searchParams;
	let flow = params.get("flow");
	return {
		q: (params.get("q") ?? "").trim(),
		flow: flow === "in" || flow === "out" ? flow : "all",
		categories: params.getAll("category").filter((id) => findCategory(id) !== undefined),
		accounts:
			account === undefined
				? params.getAll("account").filter((id) => findAccount(id) !== undefined)
				: [account],
		limit: Math.max(PAGE, Math.min(600, Number(params.get("limit")) || PAGE)),
		tx: params.get("tx"),
	};
}

/** Folds accents and case, so "cafe" finds "Café Lumen". */
function fold(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/**
 * The movements a query keeps, newest first, ignoring the filters named in `skip` so a facet
 * can count what choosing it would show.
 *
 * @param all Every movement.
 * @param query The statement's state.
 * @param skip Filters left out.
 */
export function filterEntries(
	all: readonly Entry[],
	query: StatementQuery,
	skip: ReadonlyArray<"flow" | "category" | "account"> = [],
): Entry[] {
	let needle = fold(query.q);
	return all.filter((entry) => {
		if (!skip.includes("flow") && query.flow === "in" && entry.amount <= 0) return false;
		if (!skip.includes("flow") && query.flow === "out" && entry.amount >= 0) return false;
		if (
			!skip.includes("category") &&
			query.categories.length > 0 &&
			!query.categories.includes(entry.category)
		)
			return false;
		if (
			!skip.includes("account") &&
			query.accounts.length > 0 &&
			!query.accounts.includes(entry.account)
		)
			return false;
		if (needle === "") return true;
		let merchant = findMerchant(entry.merchant);
		let haystack = fold(
			[
				merchant?.name,
				merchant?.place,
				findCategory(entry.category)?.name,
				entry.note,
				entry.reference,
			].join(" "),
		);
		return haystack.includes(needle);
	});
}

namespace Statement {
	export interface Props {
		wallet: Wallet;
		url: URL;
		/** The page path the statement lives on, which edits return to. */
		page: string;
		/** Fixes the statement to one account. */
		account?: string;
		/** A heading shown over an account's statement. */
		children?: JSX.Element;
	}
}

/**
 * The statement with its filter bar, the day groups, "Show older" and the open transaction's
 * sheet. Both the transactions screen and an account's screen draw it.
 */
export function Statement(handle: Handle<Statement.Props>) {
	return () => {
		let { wallet, url, page, account } = handle.props;
		let query = readQuery(url, account);
		let all = entries(wallet);
		let found = filterEntries(all, query);
		let shown = found.slice(0, query.limit);
		let days = [...new Set(shown.map((entry) => entry.date))];
		let open = query.tx === null ? undefined : all.find((entry) => entry.id === query.tx);
		let openIndex = open === undefined ? -1 : found.indexOf(open);
		let listHref = (tx: string | null) => setParamHref(url, "tx", tx);
		let back = `${page}${new URL(listHref(null), url).search}`;
		return (
			<>
				<FilterBar
					prefetch="intent"
					id="tuppence-statement"
					url={url}
					locale={LOCALE}
					tabs={(["all", "in", "out"] as const).map((flow) => ({
						label: { all: "All", in: "Money in", out: "Money out" }[flow],
						count: filterEntries(all, { ...query, flow }, []).length,
						href: setParamHref(setParamHref(url, "tx", null), "flow", flow === "all" ? null : flow),
						current: query.flow === flow,
					}))}
					facets={[
						{
							name: "category",
							label: "Category",
							options: CATEGORIES.map((category) => ({
								value: category.id,
								label: category.name,
								count: filterEntries(all, query, ["category"]).filter(
									(entry) => entry.category === category.id,
								).length,
								icon: <CategoryTile category={category.id} size={1.25} />,
							})),
						},
						...(account === undefined
							? [
									{
										name: "account",
										label: "Account",
										options: ACCOUNTS.map((option) => ({
											value: option.id,
											label: `${option.name} · ${option.currency}`,
											count: filterEntries(all, query, ["account"]).filter(
												(entry) => entry.account === option.id,
											).length,
										})),
									},
								]
							: []),
					]}
					search={{
						label: "Search transactions",
						placeholder: "Search merchants, notes, references",
					}}
					collapse
					labels={FILTER_LABELS}
				/>
				{days.length === 0 ? (
					<Empty kind="no-results">
						<Empty.Title>No transactions match</Empty.Title>
						<Empty.Description>
							{query.q === "" ? (
								"Nothing fits these filters."
							) : (
								<>
									Nothing matches <Empty.Query>{query.q}</Empty.Query>.
								</>
							)}
						</Empty.Description>
						<Empty.Action>
							<LinkButton href={href(page)} variant="outline" color="neutral">
								Clear filters
							</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<div
						mix={raw({
							borderRadius: "1.25rem",
							backgroundColor: "var(--tuppence-card)",
							boxShadow: "0 0 0 1px var(--tuppence-hairline)",
							padding: "0.5rem 0.25rem",
							"--ui-ledger-bg": "var(--tuppence-card)",
							"--ui-ledger-sticky-top": "var(--tuppence-sticky-top, 0px)",
						})}
					>
						<Ledger>
							{days.map((day) => {
								let onDay = shown.filter((entry) => entry.date === day);
								let net = onDay.reduce(
									(sum, entry) =>
										sum + toHome(entry.share, findAccount(entry.account)?.currency ?? HOME),
									0,
								);
								return (
									<Ledger.Day
										title={dayTitle(day, TODAY)}
										total={onDay.length > 1 ? <Money value={net} currency={HOME} /> : undefined}
									>
										{onDay.map((entry) => (
											<EntryRow
												entry={entry}
												link={listHref(entry.id)}
												current={entry.id === open?.id}
											/>
										))}
									</Ledger.Day>
								);
							})}
						</Ledger>
					</div>
				)}
				{found.length > shown.length ? (
					<div mix={raw({ display: "flex", justifyContent: "center" })}>
						<LinkButton
							href={setParamHref(url, "limit", String(query.limit + PAGE))}
							variant="outline"
							color="neutral"
						>
							Show older
						</LinkButton>
					</div>
				) : null}
				{open === undefined ? null : (
					<TransactionSheet
						entry={open}
						back={back}
						closeHref={listHref(null)}
						position={{
							index: openIndex + 1,
							total: found.length,
							previousHref: openIndex > 0 ? listHref(found[openIndex - 1]!.id) : null,
							nextHref:
								openIndex >= 0 && openIndex < found.length - 1
									? listHref(found[openIndex + 1]!.id)
									: null,
						}}
					/>
				)}
			</>
		);
	};
}

/** One label/value row in the sheet's properties. */
function Property(handle: Handle<{ label: string; children: JSX.Element | string }>) {
	return () => (
		<div
			mix={raw({
				display: "flex",
				justifyContent: "space-between",
				gap: "1rem",
				paddingBlock: "0.5rem",
				borderBlockEnd: "1px solid var(--tuppence-hairline)",
				fontSize: "0.875rem",
			})}
		>
			<dt mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>{handle.props.label}</dt>
			<dd mix={raw({ margin: "0", textAlign: "end", fontWeight: "500" })}>
				{handle.props.children}
			</dd>
		</div>
	);
}

/** A small form heading inside the sheet. */
function FormTitle(handle: Handle<{ for?: string; children: string }>) {
	return () => (
		<label
			for={handle.props.for}
			mix={raw({
				fontSize: "0.8125rem",
				fontWeight: "600",
				color: "var(--ui-neutral-fg-muted)",
				textTransform: "uppercase",
				letterSpacing: "0.04em",
			})}
		>
			{handle.props.children}
		</label>
	);
}

namespace TransactionSheet {
	export interface Props {
		entry: Entry;
		/** The list address a save returns to. */
		back: string;
		closeHref: string;
		position: DetailSheet.Position;
	}
}

/** How each movement method reads in the sheet. */
const METHODS: Record<Entry["method"], string> = {
	card: "Card •• 4821",
	"direct-debit": "Direct debit",
	transfer: "Bank transfer",
	pot: "Pot move",
	exchange: "Currency exchange",
};

/**
 * The open transaction: its amount and merchant, its details, and three small forms that
 * each save one thing (category, split, note) with an explicit button.
 */
function TransactionSheet(handle: Handle<TransactionSheet.Props>) {
	return () => {
		let { entry, back, closeHref, position } = handle.props;
		let merchant = findMerchant(entry.merchant);
		let account = findAccount(entry.account);
		let currency = account?.currency ?? HOME;
		let action = actionHref(`transactions/${entry.id}`);
		let canSplit = entry.amount < 0 && entry.method === "card";
		let shares = entry.split === undefined ? [] : allocate(entry.amount, entry.split);
		return (
			<DetailSheet
				id="tuppence-transaction"
				title={merchant?.name ?? entry.merchant}
				description={`${longDate(entry.date)} at ${entry.time}`}
				closeHref={closeHref}
				position={position}
				labels={SHEET_LABELS}
				keys="sheet"
			>
				<div mix={raw({ display: "flex", flexDirection: "column", gap: "1.25rem" })}>
					<div mix={raw({ display: "flex", alignItems: "center", gap: "0.875rem" })}>
						<MerchantMark merchant={merchant} size={3.25} />
						<div mix={raw({ display: "flex", flexDirection: "column" })}>
							<span
								mix={raw({
									fontFamily: SERIF,
									fontSize: "2rem",
									fontWeight: "600",
									letterSpacing: "-0.015em",
								})}
							>
								<Money value={entry.amount} currency={currency} sign="ledger" smallMinor />
							</span>
							<span mix={raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })}>
								{entry.pending ? "Pending · " : ""}
								{merchant?.place}
							</span>
						</div>
					</div>
					<dl mix={raw({ margin: "0" })}>
						<Property label="Account">{`${account?.name} · ${currency}`}</Property>
						<Property label="Method">{METHODS[entry.method]}</Property>
						{currency === HOME ? null : (
							<Property label="In euros">
								<Money value={toHome(entry.amount, currency)} currency={HOME} />
							</Property>
						)}
						{entry.reference === undefined ? null : (
							<Property label="Reference">{entry.reference}</Property>
						)}
						<Property label="Status">{entry.pending ? "Pending" : "Settled"}</Property>
					</dl>
					<form
						method="post"
						action={action}
						mix={raw({ display: "flex", flexDirection: "column", gap: "0.5rem" })}
					>
						<input type="hidden" name="intent" value="category" />
						<input type="hidden" name="back" value={back} />
						<FormTitle for="tuppence-category">Category</FormTitle>
						<div mix={raw({ display: "flex", gap: "0.5rem" })}>
							<Select
								id="tuppence-category"
								name="category"
								aria-label="Category"
								mix={raw({ flex: "1" })}
							>
								{CATEGORIES.map((category) => (
									<Select.Option value={category.id} selected={category.id === entry.category}>
										{category.name}
									</Select.Option>
								))}
							</Select>
							<Button type="submit" variant="outline" color="neutral">
								Save
							</Button>
						</div>
					</form>
					{canSplit ? (
						<form
							method="post"
							action={action}
							mix={raw({ display: "flex", flexDirection: "column", gap: "0.5rem" })}
						>
							<input type="hidden" name="intent" value="split" />
							<input type="hidden" name="back" value={back} />
							<FormTitle for="tuppence-split">Split the bill</FormTitle>
							<div mix={raw({ display: "flex", gap: "0.5rem" })}>
								<Select
									id="tuppence-split"
									name="split"
									aria-label="People sharing it"
									mix={raw({ flex: "1" })}
								>
									{Array.from({ length: SPLIT_LIMIT }, (_, index) => index + 1).map((people) => (
										<Select.Option value={String(people)} selected={people === (entry.split ?? 1)}>
											{people === 1 ? "Not split" : `Between ${people} people`}
										</Select.Option>
									))}
								</Select>
								<Button type="submit" variant="outline" color="neutral">
									Save
								</Button>
							</div>
							{entry.split === undefined ? null : (
								<p
									data-slot="tuppence-split-summary"
									mix={raw({
										margin: "0",
										fontSize: "0.875rem",
										color: "var(--ui-neutral-fg-muted)",
									})}
								>
									Your share is <Money value={-entry.share} currency={currency} />; the other{" "}
									{entry.split - 1} owe you{" "}
									<Money value={-(entry.amount - entry.share)} currency={currency} /> between them
									{shares.length > 0 && shares[0] !== shares[shares.length - 1]
										? ", the odd cent on the first"
										: ""}
									.
								</p>
							)}
						</form>
					) : null}
					<form
						method="post"
						action={action}
						mix={raw({ display: "flex", flexDirection: "column", gap: "0.5rem" })}
					>
						<input type="hidden" name="intent" value="note" />
						<input type="hidden" name="back" value={back} />
						<FormTitle for="tuppence-note">Note</FormTitle>
						<TextArea
							id="tuppence-note"
							name="note"
							rows={3}
							maxLength={NOTE_LIMIT}
							placeholder="Add a note only you can see"
							defaultValue={entry.note ?? ""}
						/>
						<div mix={raw({ display: "flex", justifyContent: "flex-end" })}>
							<Button type="submit" variant="outline" color="neutral">
								Save note
							</Button>
						</div>
					</form>
				</div>
			</DetailSheet>
		);
	};
}

namespace TransactionsScreen {
	export interface Props {
		wallet: Wallet;
		url: URL;
	}
}

/** The transactions screen. */
export function TransactionsScreen(handle: Handle<TransactionsScreen.Props>) {
	return () => (
		<Screen width="56rem">
			<ScreenTitle
				title="Transactions"
				detail="Every account, newest first. Amounts in their own currency."
			/>
			<Statement wallet={handle.props.wallet} url={handle.props.url} page="transactions" />
		</Screen>
	);
}
