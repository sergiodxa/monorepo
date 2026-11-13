/**
 * The app's ⌘K command palette: a modal dialog the server fills with commands that act (links,
 * buttons that submit a form or invoke a command, pages of further commands, a fuzzy file finder)
 * and a small island that filters them, moves the active row, and remembers recent picks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon, ChevronRightIcon, FileIcon, SearchIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, borderEdge, fg, outlineStyle } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { grow, hstack, shrink } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, m, maxBs, maxIs, mbs, mis, p, pbe, pbs, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, textAlign, textDecoration, truncate, weight } from "@sdxc/u/typography";
import { generateUUID } from "@sdxc/uuid/v4";
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";
import { Command } from "../components/command.js";
import { Keyboard } from "../components/keyboard.js";
import { Modal } from "../components/modal.js";

import type { PaletteController } from "./mixins/command-palette.js";

import { shortcutGlyphs } from "./behaviors/shortcuts.js";
import {
	PALETTE_CONTROL_ATTRIBUTE,
	PALETTE_FINDER_ATTRIBUTE,
	PALETTE_FINDER_PATH_ATTRIBUTE,
	PALETTE_FINDER_RESULTS_ATTRIBUTE,
	PALETTE_FINDER_ROW_ATTRIBUTE,
	PALETTE_GOTO_ATTRIBUTE,
	PALETTE_HINT_ATTRIBUTE,
	PALETTE_ITEM_ATTRIBUTE,
	PALETTE_PAGE_ATTRIBUTE,
	PALETTE_PAGE_SHORTCUT_ATTRIBUTE,
	paletteController,
} from "./mixins/command-palette.js";

export type { FuzzyMatch, FuzzySegment } from "./utils/fuzzy-path.js";
export { fuzzyFilter, fuzzyScore, fuzzySegments } from "./utils/fuzzy-path.js";

/** The combo that opens the palette when none is given. */
const DEFAULT_SHORTCUT = "mod+k";

/** How many paths the finder lists at once when `limit` is omitted. */
const DEFAULT_FINDER_LIMIT = 50;

/**
 * Types for {@link CommandPalette} and its parts.
 */
export namespace CommandPalette {
	/** Every string the palette shows or announces. */
	export interface Labels {
		/** The dialog's accessible name, e.g. "Command menu". */
		title: string;
		/** The help-sheet label of the key that opens it, e.g. "Open command menu". */
		open: string;
		/** Names the scope being searched, e.g. "Search monitors or run a command…". */
		placeholder: string;
		/** Heading over the recent commands shown before typing. */
		recent: string;
		/** Leads the no-results message, which quotes the query after it. */
		noResults: string;
		/** A recovery step under the no-results message. */
		noResultsHint?: string;
		/** The announced result count, with `{count}` replaced, e.g. "{count} results". */
		results: string;
		/** Names the control that goes back from a nested page. */
		back: string;
		/** Names the Esc control that closes the palette. */
		close: string;
	}

	/** Props for {@link CommandPalette}. */
	export interface Props extends Omit<TagProps<"dialog">, "children"> {
		/** The dialog's `id`, which a trigger's `commandfor` names. */
		id: string;
		labels: Labels;
		/** The combo that toggles the palette from anywhere on the page. @default "mod+k" */
		shortcut?: string;
		/** Ids of commands to offer under Recent before anything is typed, most recent first. */
		recent?: string[];
		/** A `localStorage` key under which the palette remembers the commands run from it. */
		remember?: string;
		/** {@link CommandPalette.Group}s, loose {@link CommandPalette.Item}s and {@link CommandPalette.Page}s. */
		children: RemixNode;
	}

	/** Props for {@link CommandPalette.Group}. */
	export interface GroupProps extends TagProps<"div"> {
		/** Title Case heading, e.g. "Navigation". */
		heading: string;
		children: RemixNode;
	}

	/** Props for {@link CommandPalette.Item}. */
	export interface ItemProps {
		/** A document-unique id, which `recent` and the remembered list name. */
		id: string;
		/** Title Case verb and noun, e.g. "Create Monitor". */
		title: string;
		/** Other words that find it, e.g. aliases and the old name. */
		keywords?: string[];
		/** A short muted line after the title. */
		description?: string;
		/** A combo or sequence the item shows as a hint and binds on the page, e.g. `"g m"`. */
		shortcut?: string;
		icon?: RemixNode;
		/** Makes the item a link. */
		href?: string;
		/** The `id` of a form the item submits. */
		form?: string;
		formaction?: string;
		formmethod?: "get" | "post";
		/** The submitted button's name and value. */
		name?: string;
		value?: string;
		/** An Invoker Command the item sends, e.g. `"--copy-account-id"`, to {@link ItemProps.commandfor}. */
		command?: string;
		commandfor?: string;
		/** The {@link CommandPalette.Page} the item opens. */
		page?: string;
		mix?: TagProps<"div">["mix"];
	}

	/** Props for {@link CommandPalette.Page}. */
	export interface PageProps {
		/** The id items open it by. */
		id: string;
		/** Shown beside the search field while the page is open. */
		title: string;
		/** Replaces the root placeholder while the page is open. */
		placeholder?: string;
		/**
		 * A combo or sequence that opens the palette straight on this page, e.g. `"t"`, listed in
		 * the help sheet under `title`.
		 */
		shortcut?: string;
		children: RemixNode;
	}

	/** Props for {@link CommandPalette.Finder}. */
	export interface FinderProps {
		/** The page id, which an item's `page` opens it by. */
		id: string;
		/** Shown beside the search field while the finder is open, e.g. "Go to File". */
		title: string;
		/** Replaces the root placeholder while the finder is open. */
		placeholder?: string;
		/**
		 * A combo or sequence that opens the palette straight on the finder, e.g. `"t"`, listed in
		 * the help sheet under `title`.
		 */
		shortcut?: string;
		/** Every path to search, in the order shown before anything is typed. */
		paths: readonly string[];
		/** Where a path leads, with `{path}` replaced by its URI-encoded segments, e.g. `"/blob/main/{path}"`. */
		href: string;
		/** How many matches to list at once. @default 50 */
		limit?: number;
		/** The glyph before each path. @default a file icon */
		icon?: RemixNode;
	}

	/** Props for {@link CommandPalette.Trigger}. */
	export interface TriggerProps extends Omit<Button.Props, "commandfor" | "command"> {
		/** The palette's `id`. */
		for: string;
		/** The combo the trigger advertises. @default "mod+k" */
		shortcut?: string;
		children: RemixNode;
	}

	/** Props for {@link CommandPaletteController}; plain data, since they cross into the browser. */
	export type ControllerProps = PaletteController.Options;
}

/**
 * Renders a shortcut's caps, marked with its combo so the island reprints them for a keyboard
 * without the Apple glyphs.
 */
function Hint(handle: Handle<{ keys: string }>) {
	return () => (
		<span
			aria-hidden="true"
			{...{ [PALETTE_HINT_ATTRIBUTE]: handle.props.keys }}
			mix={[hstack({ gap: 1, align: "center" }), mis("auto"), shrink()]}
		>
			{shortcutGlyphs(handle.props.keys, true).map((glyph, index) => (
				<Keyboard key={`${index}-${glyph}`} mix={[m(0)]}>
					{glyph}
				</Keyboard>
			))}
		</span>
	);
}

/**
 * Renders the palette: a modal dialog 640px wide, 15% from the top, full width less a gutter on
 * a phone. Without JavaScript a trigger still opens it and every command stays a working link
 * or button; the island adds filtering, arrow keys, pages, the {@link CommandPalette.Finder} and ⌘K.
 *
 * @param handle Runtime handle carrying the palette's props.
 * @returns The render function producing the palette.
 * @example
 * <CommandPalette id="palette" labels={labels} recent={["go-monitors"]}>
 * 	<CommandPalette.Group heading="Navigation">
 * 		<CommandPalette.Item id="go-monitors" title="Go to Monitors" href="/monitors" shortcut="g m" />
 * 	</CommandPalette.Group>
 * </CommandPalette>
 * @example
 * <CommandPalette id="palette" labels={labels}>
 * 	<CommandPalette.Item id="go-file" title="Go to File" page="files" />
 * 	<CommandPalette.Finder id="files" title="Go to File" shortcut="t" paths={tree.paths} href="/blob/main/{path}" />
 * </CommandPalette>
 */
export function CommandPalette(handle: Handle<CommandPalette.Props>) {
	return () => {
		let { id, labels, shortcut, recent, remember, children, mix, ...rest } = handle.props;
		let listId = `${id}-list`;

		return (
			<Modal
				{...rest}
				id={id}
				aria-label={labels.title}
				closedby="any"
				data-slot="command-palette"
				mix={mergeMix(
					[
						is("min(var(--ui-app-palette-width, 40rem), 100% - 1rem)"),
						maxIs("none"),
						maxBs("min(32rem, 80vh)"),
						p(0),
						raw({ gap: "0", marginBlock: "var(--ui-app-palette-top, 15vh) auto" }),
						overflow("hidden"),
					],
					mix,
				)}
			>
				<div
					mix={[
						hstack({ gap: 2, align: "center" }),
						pi(3),
						shrink(),
						borderEdge("block-end", { color: "neutral", width: 1 }),
					]}
				>
					<button
						type="button"
						hidden
						data-palette-back
						aria-label={labels.back}
						mix={[shrink(), p(0), bg("transparent"), cursor("pointer")]}
					>
						<span
							mix={[
								hstack({ gap: 1, align: "center" }),
								pi(2),
								bs("1.5rem"),
								rounded("md"),
								bg("neutral.bg-tint"),
								fg("neutral"),
								text("xs"),
								weight("medium"),
							]}
						>
							<ChevronLeftIcon size={12} aria-hidden="true" />
							<span data-palette-crumb />
						</span>
					</button>
					<SearchIcon size={16} aria-hidden="true" mix={[fg("neutral.muted"), shrink()]} />
					<input
						type="text"
						role="combobox"
						aria-expanded="true"
						aria-controls={listId}
						aria-autocomplete="list"
						aria-label={labels.title}
						autocomplete="off"
						spellcheck={false}
						autofocus
						placeholder={labels.placeholder}
						data-command-input
						mix={[
							grow(),
							is("full"),
							bs("3.25rem"),
							bg("transparent"),
							fg("neutral.emphasis"),
							text("base"),
							outlineStyle("none"),
							when("&::placeholder", fg("neutral.muted")),
						]}
					/>
					<button
						type="button"
						commandfor={id}
						command="close"
						aria-label={labels.close}
						mix={[shrink(), bg("transparent"), cursor("pointer")]}
					>
						<Keyboard mix={[m(0)]}>Esc</Keyboard>
					</button>
				</div>

				<Command.List id={listId} aria-label={labels.title} mix={[grow(), maxBs("none"), pbs(2)]}>
					<div role="group" hidden data-palette-recent aria-label={labels.recent}>
						<GroupHeading>{labels.recent}</GroupHeading>
						<div data-palette-recent-items />
					</div>
					{children}
				</Command.List>

				<Command.Empty hidden>
					<p mix={[m(0), fg("neutral.emphasis")]}>
						{labels.noResults} “<span data-palette-query />”
					</p>
					{labels.noResultsHint ? <p mix={[m(0), mbs(1)]}>{labels.noResultsHint}</p> : null}
				</Command.Empty>

				<div role="status" data-palette-status mix={[visuallyHidden()]} />

				<CommandPaletteController
					shortcut={shortcut ?? DEFAULT_SHORTCUT}
					open={labels.open}
					results={labels.results}
					recent={recent ?? []}
					remember={remember}
				/>
			</Modal>
		);
	};
}

/** Renders a group's muted Title Case heading. */
function GroupHeading(handle: Handle<{ id?: string; children: RemixNode }>) {
	return () => (
		<div
			id={handle.props.id}
			aria-hidden={handle.props.id === undefined ? "true" : undefined}
			mix={[pi(2), pbs(2), pbe(1), text("xs"), weight("medium"), fg("neutral.muted")]}
		>
			{handle.props.children}
		</div>
	);
}

/**
 * Renders a titled group of commands, hidden by the island while none of its commands match.
 *
 * @param handle Runtime handle carrying the group's props.
 * @returns The render function producing the group.
 * @example <CommandPalette.Group heading="Monitors">…</CommandPalette.Group>
 */
CommandPalette.Group = function CommandPaletteGroup(handle: Handle<CommandPalette.GroupProps>) {
	let headingId = `palette-group-${generateUUID()}`;

	return () => {
		let { heading, children, ...rest } = handle.props;
		return (
			<div {...rest} role="group" aria-labelledby={headingId} data-palette-group>
				<GroupHeading id={headingId}>{heading}</GroupHeading>
				{children}
			</div>
		);
	};
};

/**
 * Renders one 36px command row whose control is a link, a form submitter, an Invoker Command
 * button, or a button opening a page. The control stays out of the Tab order: focus remains in
 * the search field and the row is reached as its active descendant.
 *
 * @param handle Runtime handle carrying the item's props.
 * @returns The render function producing the row.
 * @example <CommandPalette.Item id="create" title="Create Monitor" href="/monitors/new" shortcut="c" />
 * @example <CommandPalette.Item id="pause" title="Pause All Monitors" form="pause-all" />
 */
CommandPalette.Item = function CommandPaletteItem(handle: Handle<CommandPalette.ItemProps>) {
	return () => {
		let props = handle.props;
		let controlMix = [
			hstack({ gap: 2, align: "center" }),
			is("full"),
			bs("full"),
			pi(2),
			m(0),
			bg("transparent"),
			fg("inherit"),
			textAlign("start"),
			textDecoration("none"),
			text("sm"),
			cursor("default"),
			outlineStyle("none"),
		];
		let content = (
			<>
				{props.icon ? (
					<span aria-hidden="true" mix={[hstack({ align: "center" }), fg("neutral.muted")]}>
						{props.icon}
					</span>
				) : null}
				<span mix={[truncate(), shrink()]}>{props.title}</span>
				{props.description ? (
					<span mix={[truncate(), fg("neutral.muted"), grow()]}>{props.description}</span>
				) : null}
				{props.shortcut ? <Hint keys={props.shortcut} /> : null}
				{props.page ? (
					<ChevronRightIcon
						size={14}
						aria-hidden="true"
						mix={[props.shortcut ? mis(0) : mis("auto"), fg("neutral.muted")]}
					/>
				) : null}
			</>
		);

		return (
			<Command.Item
				id={props.id}
				value={props.title}
				data-keywords={props.keywords?.join(" ")}
				data-palette-shortcut={props.shortcut}
				{...{ [PALETTE_ITEM_ATTRIBUTE]: props.id }}
				mix={mergeMix([bs("2.25rem"), p(0), pi(0)], props.mix)}
			>
				<ItemControl item={props} mix={controlMix}>
					{content}
				</ItemControl>
			</Command.Item>
		);
	};
};

/**
 * Renders the control an item presses: a link, a page opener, or a button carrying the form
 * and Invoker Command the item names.
 */
function ItemControl(
	handle: Handle<{
		item: CommandPalette.ItemProps;
		mix: TagProps<"button">["mix"];
		children: RemixNode;
	}>,
) {
	return () => {
		let { item, mix, children } = handle.props;
		let marker = { [PALETTE_CONTROL_ATTRIBUTE]: "" };
		if (item.href !== undefined) {
			return (
				<a {...marker} href={item.href} tabindex={-1} mix={mix as TagProps<"a">["mix"]}>
					{children}
				</a>
			);
		}
		if (item.page !== undefined) {
			return (
				<button
					{...marker}
					{...{ [PALETTE_GOTO_ATTRIBUTE]: item.page }}
					type="button"
					tabindex={-1}
					mix={mix}
				>
					{children}
				</button>
			);
		}
		return (
			<button
				{...marker}
				type={item.form === undefined ? "button" : "submit"}
				form={item.form}
				formaction={item.formaction}
				formmethod={item.formmethod}
				name={item.name}
				value={item.value}
				command={item.command}
				commandfor={item.commandfor}
				tabindex={-1}
				mix={mix}
			>
				{children}
			</button>
		);
	};
}

/**
 * Renders a nested page of commands, shown in place of the root list when an item opens it.
 * Backspace in an empty search field, or the back control, returns to the page before it with
 * that page's query restored.
 *
 * @param handle Runtime handle carrying the page's props.
 * @returns The render function producing the page.
 * @example <CommandPalette.Page id="teams" title="Switch Team">…</CommandPalette.Page>
 */
CommandPalette.Page = function CommandPalettePage(handle: Handle<CommandPalette.PageProps>) {
	return () => {
		let { id, title, placeholder, shortcut, children } = handle.props;
		return (
			<div
				role="group"
				aria-label={title}
				hidden
				data-palette-title={title}
				data-palette-placeholder={placeholder}
				{...{ [PALETTE_PAGE_ATTRIBUTE]: id, [PALETTE_PAGE_SHORTCUT_ATTRIBUTE]: shortcut }}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders a "Go to file" page: the {@link CommandPaletteController} island ranks `paths` with
 * {@link fuzzyFilter} per keystroke and lists the best `limit` as links, matched characters bold.
 * Results appear once the island loads; a server's `/find?q=` page ranks the same way for no script.
 *
 * @param handle Runtime handle carrying the finder's props.
 * @returns The render function producing the finder's page.
 * @example
 * <CommandPalette.Finder id="files" title="Go to File" shortcut="t" paths={tree.paths} href="/blob/main/{path}" />
 * @example
 * <CommandPalette.Item id="go-file" title="Go to File" page="files" />
 */
CommandPalette.Finder = function CommandPaletteFinder(handle: Handle<CommandPalette.FinderProps>) {
	return () => {
		let { id, title, placeholder, shortcut, paths, href, limit, icon } = handle.props;
		return (
			<CommandPalette.Page id={id} title={title} placeholder={placeholder} shortcut={shortcut}>
				<div
					{...{
						[PALETTE_FINDER_ATTRIBUTE]: paths.join("\n"),
						"data-palette-finder-href": href,
						"data-palette-finder-limit": String(limit ?? DEFAULT_FINDER_LIMIT),
					}}
					mix={[when("& mark", [bg("transparent"), fg("neutral.emphasis"), weight("semibold")])]}
				>
					<template {...{ [PALETTE_FINDER_ROW_ATTRIBUTE]: "" }}>
						<FinderRow id={`${id}-row`} path="{path}" href="#" icon={icon} />
					</template>
					<div {...{ [PALETTE_FINDER_RESULTS_ATTRIBUTE]: "" }} />
				</div>
			</CommandPalette.Page>
		);
	};
};

/**
 * Renders one finder result: a 36px row whose link leads to the path, with the matched
 * characters as `<mark>`s the finder sets in bold. The island clones it per result.
 */
function FinderRow(handle: Handle<{ id: string; path: string; href: string; icon?: RemixNode }>) {
	return () => {
		let { id, path, href, icon } = handle.props;
		return (
			<Command.Item
				id={id}
				value={path}
				{...{ [PALETTE_ITEM_ATTRIBUTE]: id }}
				mix={[bs("2.25rem"), p(0), pi(0)]}
			>
				<a
					{...{ [PALETTE_CONTROL_ATTRIBUTE]: "" }}
					href={href}
					tabindex={-1}
					mix={[
						hstack({ gap: 2, align: "center" }),
						is("full"),
						bs("full"),
						pi(2),
						fg("inherit"),
						textDecoration("none"),
						text("sm"),
						cursor("default"),
						outlineStyle("none"),
					]}
				>
					<span aria-hidden="true" mix={[hstack({ align: "center" }), fg("neutral.muted")]}>
						{icon ?? <FileIcon size={14} />}
					</span>
					<span
						{...{ [PALETTE_FINDER_PATH_ATTRIBUTE]: "" }}
						mix={[truncate(), fg("neutral.muted")]}
					>
						{path}
					</span>
				</a>
			</Command.Item>
		);
	};
}

/**
 * Renders the button that opens the palette, styled as a quiet search field with the key that
 * opens it: one route for the pointer, and the place a reader learns the key.
 *
 * @param handle Runtime handle carrying the trigger's props.
 * @returns The render function producing the trigger.
 * @example <CommandPalette.Trigger for="palette">Search…</CommandPalette.Trigger>
 */
CommandPalette.Trigger = function CommandPaletteTrigger(
	handle: Handle<CommandPalette.TriggerProps>,
) {
	return () => {
		let { for: target, shortcut, children, mix, ...rest } = handle.props;
		return (
			<Button
				type="button"
				variant="outline"
				color="neutral"
				size="sm"
				{...rest}
				commandfor={target}
				command="show-modal"
				mix={mergeMix([is("full"), maxIs("16rem"), fg("neutral.muted")], mix)}
			>
				<SearchIcon size={14} aria-hidden="true" />
				<span mix={[truncate()]}>{children}</span>
				<Hint keys={shortcut ?? DEFAULT_SHORTCUT} />
			</Button>
		);
	};
};

/**
 * The palette's island: renders nothing visible, and wires the dialog it sits in once loaded.
 * `CommandPalette` places it; load `@sdxc/ui/app/command-palette` in the browser entry.
 */
export const CommandPaletteController: EntryComponent<CommandPalette.ControllerProps> = clientEntry(
	"@sdxc/ui/app/command-palette#CommandPaletteController",
	function CommandPaletteController(handle: Handle<CommandPalette.ControllerProps>) {
		return () => <div hidden mix={[paletteController(handle.props)]} />;
	},
);
