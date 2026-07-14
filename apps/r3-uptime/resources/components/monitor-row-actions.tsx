/**
 * Client island: a row's view/edit/delete actions menu, opened from a kebab-icon
 * trigger. Built on `remix/ui/menu`'s `Menu`/`MenuItem` rather than a hand-rolled
 * `commandfor`/`[popover]` pair, because `Menu`'s trigger positions its panel via
 * `remix/ui/anchor`'s `anchor()` — which computes explicit pixel `top`/`left` from
 * the trigger's own `getBoundingClientRect()` and writes them onto the panel's
 * inline style — rather than relying on the panel's CSS containing block. That
 * sidesteps the exact problem a plain `position: absolute` panel has once a
 * `[popover]` is promoted to the top layer: at that point its containing block is
 * the viewport, not any DOM ancestor, so per-row panels positioned via CSS alone
 * all resolve to the same spot regardless of which row's trigger opened them.
 *
 * `Menu`'s open/close and its `anchor()` positioning both run entirely in JS (its
 * trigger sets no `commandfor`/`popovertarget`, only a click listener that calls
 * `showPopover()`/`hidePopover()` on the panel) — with no JS, clicking the trigger
 * does nothing at all. So each row needs its own hydrated instance of this
 * component, the same way `~/resources/components/logo.tsx` already hydrates one
 * instance per team in the sidebar's team-picker list — multiple instances of one
 * client island already work on this page's own layout.
 *
 * View/edit navigate via `location.href` (there's no native fallback without JS,
 * since `MenuItem`'s underlying element is a `<div role="menuitem">`, not an `<a>`).
 * Delete opens this row's own SSR-rendered confirmation `<dialog>` (rendered by the
 * caller, matching `~/resources/views/monitors/edit.tsx`'s dialog markup) via
 * `showModal()` — the dialog itself needs no hydration, `showModal()` is a plain
 * `HTMLDialogElement` method.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { EllipsisVerticalIcon, EyeIcon, PencilIcon, TrashIcon } from "@pkg/lucide-remix";
import { clientEntry, css, on } from "remix/ui";
import { Menu, MenuItem } from "remix/ui/menu";

import { danger } from "~/resources/theme";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type MonitorRowActionsProps = {
	monitorName: string;
	viewHref: string;
	editHref: string;
	deleteDialogId: string;
};

/** Square, icon-only trigger — overrides `Menu`'s default text-button layout (label + trailing chevron). */
const triggerStyle = css({
	width: 32,
	height: 32,
	padding: 0,
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	/**
	 * `!important` because `Menu`'s own built-in trigger-indicator style (the
	 * trailing chevron every `Menu` renders, regardless of `label` content) has
	 * equal-or-higher specificity than a plain `& > svg:last-child` override —
	 * a two-icon trigger like this one has no use for that indicator at all.
	 */
	"& > svg:last-child": { display: "none !important" },
});

const menuItem = css({ display: "flex", alignItems: "center", gap: 8 });

/** Applied on top of {@link menuItem} for the destructive "Delete" entry. */
const menuItemDanger = css({ color: danger[600] });

/** Renders a row's kebab-icon menu (view/edit/delete), positioned next to its own trigger via `Menu`'s JS-driven `anchor()`. */
export const MonitorRowActions = clientEntry(
	"/resources/components/monitor-row-actions.tsx#MonitorRowActions",
	function MonitorRowActions(handle: Handle<MonitorRowActionsProps>) {
		return () => {
			let { monitorName, viewHref, editHref, deleteDialogId } = handle.props;

			return (
				<Menu
					label={<EllipsisVerticalIcon size={16} strokeWidth={1.5} />}
					aria-label={`Actions for ${monitorName}`}
					mix={[triggerStyle]}
				>
					<MenuItem
						name="view"
						mix={[
							menuItem,
							on("click", () => {
								location.href = viewHref;
							}),
						]}
					>
						<EyeIcon size={16} strokeWidth={1.5} />
						<span>View</span>
					</MenuItem>
					<MenuItem
						name="edit"
						mix={[
							menuItem,
							on("click", () => {
								location.href = editHref;
							}),
						]}
					>
						<PencilIcon size={16} strokeWidth={1.5} />
						<span>Edit</span>
					</MenuItem>
					<MenuItem
						name="delete"
						mix={[
							menuItem,
							menuItemDanger,
							on("click", () => {
								let dialog = document.getElementById(deleteDialogId);
								if (dialog instanceof HTMLDialogElement) dialog.showModal();
							}),
						]}
					>
						<TrashIcon size={16} strokeWidth={1.5} />
						<span>Delete</span>
					</MenuItem>
				</Menu>
			);
		};
	},
);

export default MonitorRowActions;
