/**
 * One filterable popover list for every "pick from many" trigger: a branch or tag picker whose
 * items are links, and label, assignee or milestone pickers whose radios or checkboxes post as
 * a form when the popover closes. Without script the links and a Save button still work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { CheckIcon, ChevronDownIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { accent, bg, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import {
	flex,
	flexCol,
	gap,
	grow,
	hidden,
	inlineFlex,
	items,
	justify,
	relative,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { overflowY, overscrollBehavior } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, maxBs, minBs, minIs, p, pb, pbs, pi } from "@sdxc/u/size";
import { before, focusVisible, hover, when } from "@sdxc/u/state";
import { leading, nowrap, text, textDecoration, truncate, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { Badge } from "../components/badge.js";
import { Button } from "../components/button.js";
import { LabelChip } from "../components/label-chip.js";
import { Popover } from "../components/popover.js";
import { SearchField } from "../components/search-field.js";

import { FILTER_MENU_ROW_SLOT, filterMenuKeys } from "./mixins/filter-menu-keys.js";
import { submitOnClose } from "./mixins/submit-on-close.js";

/** How many matching rows the list draws at most; the rest are counted in one closing row. */
const DEFAULT_LIMIT = 100;

/** Side of the trigger the popover opens on when `placement` is unset. */
const DEFAULT_PLACEMENT: Popover.Placement = "bottom-start";

/** The viewport width at and below which the popover is drawn as a bottom sheet. */
const SHEET_QUERY = "(max-width: 40rem)";

/**
 * Prop types for {@link FilterMenu} and its parts. Items, groups and labels are `type`s
 * because they cross into the browser with the {@link FilterMenuList} island.
 */
export namespace FilterMenu {
	/**
	 * `"navigate"` makes every item a link (a branch picker); `"single"` and `"multiple"` make
	 * them radios or checkboxes named `name`, posted to `action` when the popover closes.
	 */
	export type Mode = "navigate" | "single" | "multiple";

	/** One choice. */
	export type Item = {
		/** What the form posts for the item, and its identity in the list. */
		value: string;
		/** The row's text, which the filter field matches against. */
		label: string;
		/** Where a `navigate` item goes. */
		href?: string;
		/** A second, muted line under the label. */
		description?: string;
		/** Any CSS colour; the label is drawn as a `LabelChip` with this colour's dot. */
		color?: string;
		/** A short tag after the label, such as "default". */
		badge?: string;
		/** Checked, or the current page for a link; selected items sort first. */
		selected?: boolean;
	};

	/** A titled run of items: stacked sections, or one tab each with `tabs`. */
	export type Group = {
		/** The section heading, or the tab's name with `tabs`. */
		label: string;
		/** The group's choices, drawn in this order after the selected ones. */
		items: Item[];
	};

	/** Every string the menu shows. */
	export type Labels = {
		/** The popover's heading and accessible name, such as "Switch branches/tags". */
		title?: string;
		/** The filter field's name and placeholder, such as "Filter branches". */
		filter: string;
		/** Said when nothing matches the filter, such as "Nothing to show". */
		empty: string;
		/** The closing row past the limit, with `{count}` where the number goes. */
		more: string;
		/** The submit button a picker shows without script, such as "Save". */
		save: string;
		/** The accessible name of the tab strip, such as "Ref type". */
		tabs?: string;
	};

	/** Props the {@link FilterMenuList} island receives, all plain data. */
	export type ListProps = {
		/** Prefix for every id the list renders. */
		id: string;
		/** Whether rows are links, radios or checkboxes. */
		mode: Mode;
		/** The field name radios and checkboxes post under. */
		name?: string;
		/** Every choice; the island filters them in the browser. */
		groups: Group[];
		/** Draws one tab per group instead of stacked sections. */
		tabs?: boolean;
		/** How many matches the list draws before one closing "more" row. @default 100 */
		limit?: number;
		/** The filter the server already applied, such as the `q` a no-script filter sent. */
		query?: string;
		/** The id of the GET form the filter field and tabs belong to. */
		filterForm: string;
		/** Whether that form has an address to filter on, which shows the field without script. */
		searchable?: boolean;
		/** Every string the list shows. */
		labels: Labels;
	};

	/** Props {@link FilterMenu.Popover} accepts: everything but the trigger. */
	export interface PopoverProps extends Omit<TagProps<"div">, "id" | "children" | "popover"> {
		/** The popover's id, which the trigger, or any `popovertarget`, opens. */
		id: string;
		/** Whether rows are links, radios or checkboxes. */
		mode: Mode;
		/** Every choice, sent whole to the island so filtering never waits on the server. */
		groups: Group[];
		/** Draws the groups as tabs (Branches | Tags) instead of stacked sections. */
		tabs?: boolean;
		/** The field name radios and checkboxes post under; required for `single` and `multiple`. */
		name?: string;
		/** Where `single` and `multiple` post. Defaults to the current address. */
		action?: string;
		/** The named `<Frame>` the post loads into, so only that frame reloads. */
		target?: string;
		/** A page that filters with `?q=`, which the filter field submits to without script. */
		filterAction?: string;
		/** The filter already applied, as the `filterAction` page read it. */
		query?: string;
		/** How many matches the list draws before one closing "more" row. @default 100 */
		limit?: number;
		/** A closing link or action, such as "View all branches". */
		footer?: RemixNode;
		/** The trigger's side the popover opens on above phone widths. @default "bottom-start" */
		placement?: Popover.Placement;
		/** Every string the menu shows, so it reads in any language. */
		labels: Labels;
	}

	/** Props {@link FilterMenu} accepts: the popover's, plus what its trigger shows. */
	export interface Props extends PopoverProps {
		/** The trigger's content, such as a branch icon and the current branch's name. */
		trigger: RemixNode;
	}
}

/**
 * Renders a trigger and its native popover: links in `navigate` mode, a form posted to `action` by
 * its Save button in `single` and `multiple`. Mapping `@sdxc/ui/app/filter-menu` in the browser
 * entry runs {@link FilterMenuList}: typing filters, arrows walk, and closing a changed picker posts.
 *
 * @param handle Runtime handle carrying the menu's props.
 * @returns The render function producing the trigger and popover.
 * @example
 * <FilterMenu id="ref-picker" mode="navigate" tabs trigger={<><GitBranchIcon /> main</>}
 * 	groups={[{ label: "Branches", items: branches }, { label: "Tags", items: tags }]}
 * 	filterAction="/delta/branches" footer={<a href="/delta/branches">View all branches</a>} labels={labels} />
 * @example
 * <FilterMenu id="labels" mode="multiple" name="label" action={`/issues/${id}/labels`}
 * 	trigger="Labels" groups={[{ label: "Labels", items: labels }]} labels={copy} />
 */
export function FilterMenu(handle: Handle<FilterMenu.Props>) {
	return () => {
		let { trigger, ...rest } = handle.props;

		return (
			<>
				<Button
					type="button"
					variant="outline"
					size="sm"
					id={`${rest.id}-trigger`}
					popovertarget={rest.id}
					aria-haspopup="dialog"
					data-slot="filter-menu-trigger"
					mix={[minIs(0)]}
				>
					<span mix={[inlineFlex(), items("center"), gap(1.5), minIs(0), truncate()]}>
						{trigger}
					</span>
					<ChevronDownIcon size={14} aria-hidden="true" mix={[shrink(0), fg("neutral.muted")]} />
				</Button>
				<FilterMenu.Popover {...rest} />
			</>
		);
	};
}

/**
 * Renders the popover alone, for a trigger the page already has, such as a property row's
 * edit button targeting `id`. It holds the heading, the filter, the list and the footer; at
 * phone widths the same element is drawn as a bottom sheet over a dimmed page.
 *
 * @param handle Runtime handle carrying the popover's props.
 * @returns The render function producing the popover.
 * @example
 * <button popovertarget="issue-labels">Labels</button>
 * <FilterMenu.Popover id="issue-labels" mode="multiple" name="label" groups={groups} labels={labels} />
 */
FilterMenu.Popover = function FilterMenuPopover(handle: Handle<FilterMenu.PopoverProps>) {
	return () => {
		let {
			id,
			mode,
			groups,
			tabs,
			name,
			action,
			target,
			filterAction,
			query,
			limit,
			footer,
			placement,
			labels,
			mix,
			...rest
		} = handle.props;
		let titleId = `${id}-title`;
		let filterForm = `${id}-filter-form`;
		let list = (
			<FilterMenuList
				id={id}
				mode={mode}
				name={name}
				groups={groups}
				tabs={tabs}
				limit={limit}
				query={query}
				filterForm={filterForm}
				searchable={filterAction !== undefined}
				labels={labels}
			/>
		);

		return (
			<Popover
				id={id}
				placement={placement ?? DEFAULT_PLACEMENT}
				role="dialog"
				aria-labelledby={labels.title ? titleId : undefined}
				aria-label={labels.title ? undefined : labels.filter}
				data-slot="filter-menu"
				data-mode={mode}
				{...rest}
				mix={mergeMix(
					[
						p(0),
						is("20rem"),
						raw({ maxInlineSize: "calc(100vw - 2rem)" }),
						maxBs("min(30rem, calc(100dvh - 2rem))"),
						flexCol(),
						raw({ overflow: "hidden" }),
						text("sm"),
						/**
						 * On a phone the popover leaves its anchor and rests on the bottom edge at full width,
						 * over a dimmed page a tap dismisses, with room for the home indicator.
						 */
						media(
							SHEET_QUERY,
							raw({
								positionArea: "none",
								positionTryFallbacks: "none",
								inset: "auto 0 0 0",
								margin: "0 !important",
								inlineSize: "100%",
								maxInlineSize: "100%",
								maxBlockSize: "85dvh",
								borderEndStartRadius: "0",
								borderEndEndRadius: "0",
								paddingBlockEnd: "env(safe-area-inset-bottom)",
							}),
						),
						media(SHEET_QUERY, when("&::backdrop", raw({ backgroundColor: "rgb(0 0 0 / 0.32)" }))),
					],
					mix,
				)}
			>
				{labels.title ? (
					<p
						id={titleId}
						data-slot="filter-menu-title"
						mix={[
							m(0),
							pi(3),
							pb(2),
							weight("semibold"),
							borderEdge("block-end", { width: 1, style: "solid", color: "neutral" }),
						]}
					>
						{labels.title}
					</p>
				) : null}
				<form id={filterForm} method="get" action={filterAction} hidden />
				{mode === "navigate" ? (
					list
				) : (
					<form
						method="post"
						action={action}
						data-rmx-target={target}
						data-slot="filter-menu-form"
						mix={[flexCol(), minBs(0), grow()]}
					>
						{list}
					</form>
				)}
				{footer ? (
					<div
						data-slot="filter-menu-footer"
						mix={[
							flex(),
							pi(3),
							pb(2),
							borderEdge("block-start", { width: 1, style: "solid", color: "neutral" }),
							when("& a", [
								fg("brand"),
								textDecoration("none"),
								hover(textDecoration("underline")),
							]),
						]}
					>
						{footer}
					</div>
				) : null}
			</Popover>
		);
	};
};

/** One item as the list keeps it: its group, its row's ids and its normalized search text. */
interface Entry {
	item: FilterMenu.Item;
	group: number;
	/** Stable across renders and unique in the menu: the group and the item's original index. */
	key: string;
	/** The id of the row's link or input, which `aria-activedescendant` names. */
	controlId: string;
	search: string;
}

/** One group's rows as drawn: its label and the matches that fit the limit. */
interface DrawnGroup {
	index: number;
	label: string;
	entries: Entry[];
}

/** What one panel draws: a tab's group, or every group stacked, and how many matches it held back. */
interface Scope {
	/** The tab this scope is, or `null` for stacked groups. */
	tab: number | null;
	groups: DrawnGroup[];
	matched: number;
	drawn: number;
}

/**
 * Folds case and accents away, so "resume" finds "Résumé" and "MAIN" finds "main".
 *
 * @param text Any label, value or query.
 * @returns The comparable form.
 */
function fold(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/**
 * Prepares every group for filtering: selected items first, each run in its given order.
 *
 * @param groups The groups as the caller passed them.
 * @param id The menu's id prefix.
 * @returns One list of entries per group.
 */
function prepare(groups: FilterMenu.Group[], id: string): Entry[][] {
	return groups.map((group, g) => {
		let entries = group.items.map((item, i) => ({
			item,
			group: g,
			key: `${g}:${i}`,
			controlId: `${id}-option-${g}-${i}`,
			search: fold(`${item.label} ${item.value} ${item.description ?? ""}`),
		}));
		return [
			...entries.filter((entry) => entry.item.selected),
			...entries.filter((entry) => !entry.item.selected),
		];
	});
}

/**
 * Filters the prepared groups into what the list draws: one scope per tab, each limited on
 * its own, or one scope for stacked groups limited across all of them.
 *
 * @returns The scopes, in tab order.
 */
function scopesFor(
	prepared: Entry[][],
	labels: string[],
	query: string,
	tabs: boolean,
	limit: number,
): Scope[] {
	let needle = fold(query.trim());
	let matches = prepared.map((entries) =>
		needle ? entries.filter((entry) => entry.search.includes(needle)) : entries,
	);
	let runs = tabs ? matches.map((_, g) => [g]) : [matches.map((_, g) => g)];
	return runs.map((run) => {
		let room = limit;
		let groups = run.map((g) => {
			let entries = (matches[g] ?? []).slice(0, Math.max(room, 0));
			room -= entries.length;
			return { index: g, label: labels[g] ?? "", entries };
		});
		return {
			tab: tabs ? (run[0] ?? 0) : null,
			groups: groups.filter((group) => group.entries.length > 0),
			matched: run.reduce((sum, g) => sum + (matches[g]?.length ?? 0), 0),
			drawn: groups.reduce((sum, group) => sum + group.entries.length, 0),
		};
	});
}

/** The values the server marked selected, which the list starts from. */
function selectedValues(groups: FilterMenu.Group[]): Set<string> {
	return new Set(
		groups.flatMap((group) =>
			group.items.filter((item) => item.selected).map((item) => item.value),
		),
	);
}

/**
 * Client island: the filter field, the tabs and the rows of a {@link FilterMenu}. It draws at
 * most `limit` matches, so a list of thousands keeps a small page; typing filters, ↑↓ move the
 * highlighted row, Enter follows or picks it, Escape closes, and a changed picker then submits.
 *
 * @example <FilterMenuList id="labels" mode="multiple" name="label" groups={groups} filterForm="labels-filter-form" labels={labels} />
 */
export const FilterMenuList: EntryComponent<FilterMenu.ListProps> = clientEntry(
	"@sdxc/ui/app/filter-menu#FilterMenuList",
	function FilterMenuList(handle: Handle<FilterMenu.ListProps>) {
		let preparedFrom = handle.props.groups;
		let prepared = prepare(preparedFrom, handle.props.id);
		let selected = selectedValues(preparedFrom);
		let query = handle.props.query ?? "";
		let tab = Math.max(
			prepared.findIndex((entries) => entries.some((entry) => entry.item.selected)),
			0,
		);
		let active: string | undefined;
		let hydrated = false;
		let scopes: Scope[] = [];

		handle.queueTask(() => {
			hydrated = true;
			void handle.update();
		});

		/** The rows the arrows walk: the open tab's, or every stacked group's. */
		function walkable(): Entry[] {
			let scope = handle.props.tabs ? scopes[tab] : scopes[0];
			return scope ? scope.groups.flatMap((group) => group.entries) : [];
		}

		/** Re-renders, then scrolls the highlighted row into view inside the list. */
		async function show(): Promise<void> {
			await handle.update();
			let entry = walkable().find((candidate) => candidate.key === active);
			if (!entry) return;
			document
				.getElementById(entry.controlId)
				?.closest(`[data-slot="${FILTER_MENU_ROW_SLOT}"]`)
				?.scrollIntoView({ block: "nearest" });
		}

		/** Closes the popover holding the list, which submits a changed picker. */
		async function close(root: HTMLElement): Promise<void> {
			await handle.update();
			let popover = root.closest<HTMLElement>("[popover]");
			if (popover?.matches(":popover-open")) popover.hidePopover();
		}

		/** Follows, picks or toggles one row, as Enter on the highlighted row does. */
		function choose(entry: Entry, root: HTMLElement): void {
			let { mode } = handle.props;
			if (mode === "navigate") {
				document.getElementById(entry.controlId)?.click();
				return;
			}
			if (mode === "single") {
				selected = new Set([entry.item.value]);
				void close(root);
				return;
			}
			let control = document.getElementById(entry.controlId);
			toggle(entry.item.value, control instanceof HTMLInputElement ? control : undefined);
		}

		/**
		 * Flips one checkbox's value in the picked set, sets its box at once, so a popover
		 * closed in the same moment submits the new value, and renders. A rendered checkbox holds
		 * its rendered `checked` until the next render, so the set says what a click meant.
		 */
		function toggle(value: string, control?: HTMLInputElement): void {
			if (selected.has(value)) selected.delete(value);
			else selected.add(value);
			if (control) control.checked = selected.has(value);
			void handle.update();
		}

		/** Moves the highlight `step` rows, wrapping at either end. */
		function move(step: number): void {
			let rows = walkable();
			if (rows.length === 0) return;
			let at = rows.findIndex((entry) => entry.key === active);
			if (at === -1) at = step > 0 ? -1 : 0;
			active = rows[(at + step + rows.length) % rows.length]?.key;
			void show();
		}

		return () => {
			let { id, mode, name, groups, tabs, filterForm, searchable, labels } = handle.props;
			if (groups !== preparedFrom) {
				preparedFrom = groups;
				prepared = prepare(groups, id);
				selected = selectedValues(groups);
			}
			let limit = handle.props.limit ?? DEFAULT_LIMIT;
			scopes = scopesFor(
				prepared,
				groups.map((group) => group.label),
				query,
				tabs === true,
				limit,
			);
			let inputId = `${id}-filter`;
			let listId = `${id}-list`;
			let picker = mode !== "navigate";
			let activeEntry = walkable().find((entry) => entry.key === active);
			let drawnValues = new Set(
				scopes.flatMap((scope) =>
					scope.groups.flatMap((group) => group.entries.map((entry) => entry.item.value)),
				),
			);
			let heldSelected = picker ? [...selected].filter((value) => !drawnValues.has(value)) : [];

			return (
				<div
					data-slot="filter-menu-list"
					mix={[
						flexCol(),
						minBs(0),
						grow(),
						picker ? submitOnClose() : null,
						filterMenuKeys({
							input: inputId,
							onFilter(value) {
								query = value;
								scopes = scopesFor(
									prepared,
									handle.props.groups.map((group) => group.label),
									query,
									handle.props.tabs === true,
									handle.props.limit ?? DEFAULT_LIMIT,
								);
								active = walkable()[0]?.key;
								void show();
							},
							onMove: move,
							onChoose(host) {
								let entry = walkable().find((candidate) => candidate.key === active);
								if (entry) choose(entry, host);
							},
							onClose(host) {
								void close(host);
							},
							onTab(index) {
								tab = index;
								active = undefined;
								void handle.update();
							},
							onPick(input, host) {
								if (name === undefined || input.name !== name) return;
								if (mode !== "single") {
									toggle(input.value, input);
									return;
								}
								selected = new Set([input.value]);
								void close(host);
							},
							onHover(key) {
								if (key === active) return;
								active = key;
								void handle.update();
							},
						}),
					]}
				>
					<div
						data-slot="filter-menu-filter"
						hidden={!hydrated && !searchable}
						mix={[
							p(2),
							borderEdge("block-end", { width: 1, style: "solid", color: "neutral" }),
							when("&[hidden]", hidden()),
						]}
					>
						<SearchField.Input
							id={inputId}
							name={searchable ? "q" : undefined}
							form={filterForm}
							defaultValue={query}
							autofocus
							autocomplete="off"
							aria-label={labels.filter}
							aria-autocomplete="list"
							aria-controls={listId}
							aria-activedescendant={activeEntry?.controlId}
							placeholder={labels.filter}
						/>
					</div>
					{tabs ? (
						<FilterMenuTabs
							id={id}
							groups={groups}
							tab={tab}
							filterForm={filterForm}
							label={labels.tabs ?? labels.title ?? labels.filter}
						/>
					) : null}
					<div
						id={listId}
						data-slot="filter-menu-items"
						mix={[
							grow(),
							minBs(0),
							overflowY("auto"),
							overscrollBehavior("contain"),
							p(1),
							maxBs("min(24rem, 60dvh)"),
						]}
					>
						{scopes.map((scope) => (
							<FilterMenuScope
								scope={scope}
								id={id}
								mode={mode}
								name={name}
								selected={selected}
								active={active}
								stacked={!tabs && groups.length > 1}
								labels={labels}
							/>
						))}
					</div>
					{heldSelected.map((value) => (
						<input type="hidden" name={name} value={value} data-slot="filter-menu-held" />
					))}
					{picker && !hydrated ? (
						<div
							data-slot="filter-menu-actions"
							mix={[
								p(2),
								borderEdge("block-start", { width: 1, style: "solid", color: "neutral" }),
							]}
						>
							<Button
								type="submit"
								size="sm"
								color="brand"
								data-slot="filter-menu-save"
								mix={[is("full")]}
							>
								{labels.save}
							</Button>
						</div>
					) : null}
				</div>
			);
		};
	},
);

/** Props {@link FilterMenuTabs} reads. */
interface FilterMenuTabsProps {
	id: string;
	groups: FilterMenu.Group[];
	tab: number;
	filterForm: string;
	label: string;
}

/**
 * The tab strip: one radio per group, styled as underlined tabs. The radios belong to the
 * filter form, so a picker's post never carries them, and CSS alone shows the chosen tab's
 * panel, so tabs switch without script.
 *
 * @param handle Runtime handle carrying the groups and the chosen tab.
 * @returns The render function producing the strip.
 */
function FilterMenuTabs(handle: Handle<FilterMenuTabsProps>) {
	return () => {
		let { id, groups, tab, filterForm, label } = handle.props;

		return (
			<div
				role="radiogroup"
				aria-label={label}
				data-slot="filter-menu-tabs"
				mix={[
					flex(),
					gap(1),
					pi(2),
					borderEdge("block-end", { width: 1, style: "solid", color: "neutral" }),
				]}
			>
				{groups.map((group, g) => (
					<label
						data-slot="filter-menu-tab"
						mix={[
							relative(),
							inlineFlex(),
							items("center"),
							minBs("2.25rem"),
							pi(2),
							text("sm"),
							weight("medium"),
							fg("neutral.muted"),
							cursor("pointer"),
							nowrap(),
							hover(fg()),
							when("&:has(input:checked)", [
								fg(),
								weight("semibold"),
								before(
									raw({
										content: '""',
										position: "absolute",
										insetInline: "0",
										insetBlockEnd: "-1px",
										blockSize: "2px",
										borderRadius: "1px",
										backgroundColor: "var(--ui-brand-bg-solid)",
									}),
								),
							]),
							when("&:has(input:focus-visible)", [
								rounded("md"),
								outline({ color: "brand.ring", width: 2, offset: -2 }),
							]),
						]}
					>
						<input
							type="radio"
							name={`${id}-tab`}
							value={String(g)}
							form={filterForm}
							checked={g === tab}
							data-tab-index={String(g)}
							mix={[visuallyHidden()]}
						/>
						{group.label}
					</label>
				))}
			</div>
		);
	};
}

/** Props {@link FilterMenuScope} reads. */
interface FilterMenuScopeProps {
	scope: Scope;
	id: string;
	mode: FilterMenu.Mode;
	name?: string;
	selected: Set<string>;
	active?: string;
	stacked: boolean;
	labels: FilterMenu.Labels;
}

/**
 * One panel of rows: a tab's group, or every group stacked under its heading, followed by
 * "Nothing to show" when the filter matched nothing and by the count it held back past the limit.
 *
 * @param handle Runtime handle carrying the scope and the list's state.
 * @returns The render function producing the panel.
 */
function FilterMenuScope(handle: Handle<FilterMenuScopeProps>) {
	return () => {
		let { scope, id, mode, name, selected, active, stacked, labels } = handle.props;
		let held = scope.matched - scope.drawn;
		let tabRule =
			scope.tab === null
				? null
				: when(
						`[data-slot="filter-menu-list"]:has(input[data-tab-index="${scope.tab}"]:not(:checked)) &`,
						hidden(),
					);

		return (
			<div
				data-slot="filter-menu-scope"
				data-tab={scope.tab ?? undefined}
				mix={[vstack({ gap: 0 }), tabRule]}
			>
				{scope.groups.map((group) => {
					let headingId = `${id}-group-${group.index}`;
					return (
						<div
							role="group"
							aria-labelledby={stacked ? headingId : undefined}
							aria-label={stacked ? undefined : group.label}
							data-slot="filter-menu-group"
							mix={[vstack({ gap: 0 })]}
						>
							{stacked ? (
								<p
									id={headingId}
									data-slot="filter-menu-group-label"
									mix={[
										m(0),
										pi(2),
										pbs(2),
										pb(1),
										text("xs"),
										weight("semibold"),
										fg("neutral.muted"),
									]}
								>
									{group.label}
								</p>
							) : null}
							{group.entries.map((entry) => (
								<FilterMenuRow
									key={entry.key}
									entry={entry}
									mode={mode}
									name={name}
									checked={
										mode === "navigate"
											? entry.item.selected === true
											: selected.has(entry.item.value)
									}
									active={entry.key === active}
								/>
							))}
						</div>
					);
				})}
				{scope.matched === 0 ? (
					<p data-slot="filter-menu-empty" mix={[m(0), pi(2), pb(3), fg("neutral.muted")]}>
						{labels.empty}
					</p>
				) : null}
				{held > 0 ? (
					<p
						data-slot="filter-menu-more"
						mix={[m(0), pi(2), pb(2), text("xs"), fg("neutral.muted")]}
					>
						{labels.more.replace("{count}", held.toLocaleString())}
					</p>
				) : null}
			</div>
		);
	};
}

/** Props {@link FilterMenuRow} reads. */
interface FilterMenuRowProps {
	entry: Entry;
	mode: FilterMenu.Mode;
	name?: string;
	checked: boolean;
	active: boolean;
}

/**
 * One 32px row (44px under a coarse pointer): a link in `navigate` mode, else a label wrapping
 * its radio or checkbox. The highlighted row takes a tinted fill and a 4px accent bar on its
 * start edge; a link to the current page and a picked radio show a check.
 *
 * @param handle Runtime handle carrying the entry and its state.
 * @returns The render function producing the row.
 */
function FilterMenuRow(handle: Handle<FilterMenuRowProps>) {
	return () => {
		let { entry, mode, name, checked, active } = handle.props;
		let { item } = entry;
		let rowMix = [
			relative(),
			flex(),
			items("center"),
			gap(2),
			is("full"),
			minBs("2rem"),
			pi(2),
			pb(1),
			rounded("md"),
			fg("neutral.emphasis"),
			textDecoration("none"),
			cursor("pointer"),
			raw({ boxSizing: "border-box", "@media (pointer: coarse)": { minBlockSize: "2.75rem" } }),
			hover(bg("neutral.bg-tint-hover")),
			when("&[data-active]", [
				bg("neutral.bg-tint-hover"),
				before(
					raw({
						content: '""',
						position: "absolute",
						insetInlineStart: "0",
						insetBlock: "0.375rem",
						inlineSize: "4px",
						borderRadius: "2px",
						backgroundColor: "var(--ui-brand-bg-solid)",
					}),
				),
			]),
			focusVisible(outline({ color: "brand.ring", width: 2, offset: -2 })),
			when("&:has(input:focus-visible)", outline({ color: "brand.ring", width: 2, offset: -2 })),
		];
		let body = <FilterMenuRowBody item={item} />;

		if (mode === "navigate") {
			return (
				<a
					id={entry.controlId}
					href={item.href}
					data-slot={FILTER_MENU_ROW_SLOT}
					data-key={entry.key}
					data-active={active ? "" : undefined}
					aria-current={checked ? "true" : undefined}
					mix={rowMix}
				>
					<FilterMenuCheck shown={checked} />
					{body}
				</a>
			);
		}

		return (
			<label
				data-slot={FILTER_MENU_ROW_SLOT}
				data-key={entry.key}
				data-active={active ? "" : undefined}
				mix={rowMix}
			>
				{mode === "single" ? (
					<>
						<input
							type="radio"
							id={entry.controlId}
							name={name}
							value={item.value}
							checked={checked}
							mix={[visuallyHidden()]}
						/>
						<FilterMenuCheck shown={checked} />
					</>
				) : (
					<input
						type="checkbox"
						id={entry.controlId}
						name={name}
						value={item.value}
						checked={checked}
						mix={[m(0), is("1rem"), bs("1rem"), shrink(0), accent("brand"), cursor("pointer")]}
					/>
				)}
				{body}
			</label>
		);
	};
}

/** Props {@link FilterMenuCheck} reads. */
interface FilterMenuCheckProps {
	shown: boolean;
}

/**
 * The check a current link or picked radio shows, in a fixed 16px slot, so labels line up
 * down the list whether or not their row is the chosen one.
 *
 * @param handle Runtime handle carrying whether the check shows.
 * @returns The render function producing the slot.
 */
function FilterMenuCheck(handle: Handle<FilterMenuCheckProps>) {
	return () => (
		<span
			aria-hidden="true"
			data-slot="filter-menu-check"
			mix={[inlineFlex(), shrink(0), is("1rem"), bs("1rem"), fg("brand")]}
		>
			{handle.props.shown ? <CheckIcon size={16} /> : null}
		</span>
	);
}

/** Props {@link FilterMenuRowBody} reads. */
interface FilterMenuRowBodyProps {
	item: FilterMenu.Item;
}

/**
 * The row's text: the label (as a colour-dot `LabelChip` when the item has a colour) and its
 * badge on one line, and the description muted under it.
 *
 * @param handle Runtime handle carrying the item.
 * @returns The render function producing the text.
 */
function FilterMenuRowBody(handle: Handle<FilterMenuRowBodyProps>) {
	return () => {
		let { item } = handle.props;

		return (
			<span mix={[vstack({ gap: 0 }), grow(), minIs(0)]}>
				<span mix={[flex(), items("center"), justify("between"), gap(2), minIs(0)]}>
					{item.color ? (
						<LabelChip variant="dot" color={item.color} mix={[minIs(0)]}>
							{item.label}
						</LabelChip>
					) : (
						<span mix={[truncate(), leading("1.25rem")]}>{item.label}</span>
					)}
					{item.badge ? (
						<Badge variant="outline" mix={[shrink(0)]}>
							{item.badge}
						</Badge>
					) : null}
				</span>
				{item.description ? (
					<span mix={[text("xs"), fg("neutral.muted"), truncate()]}>{item.description}</span>
				) : null}
			</span>
		);
	};
}
