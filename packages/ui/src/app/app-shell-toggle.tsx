/**
 * Island holding an app shell's collapse toggle: a native checkbox in a button-shaped label,
 * whose checked state the shell's styles read to draw the icon rail. Hydrated, it writes the
 * collapse cookie, answers ⌘B, closes the phone sheet on navigation and follows Esc back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import { PanelLeftIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { items, justify, relative, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import { hitArea } from "../styles/hit-area.js";

import { appShellControls } from "./mixins/app-shell-controls.js";

/** Prop types for {@link AppShellToggle}. */
export namespace AppShellToggle {
	/** Plain data only, since the props cross into the browser with the island. */
	export type Props = {
		/** Whether the sidebar starts as the icon rail, read from the collapse cookie. */
		collapsed: boolean;
		/** The toggle's accessible name, such as "Collapse sidebar". */
		label: string;
		/** The cookie the state is written to. */
		cookieName: string;
		/** The sidebar's id, which the sheet opens and closes by. */
		sidebarId: string;
	};
}

/**
 * Renders the toggle the shell's top bar shows from 48rem. `AppShell` places it; load
 * `@sdxc/ui/app/app-shell-toggle` in the browser entry so the cookie, ⌘B and Esc work.
 */
export const AppShellToggle: EntryComponent<AppShellToggle.Props> = clientEntry(
	"@sdxc/ui/app/app-shell-toggle#AppShellToggle",
	function AppShellToggle(handle: Handle<AppShellToggle.Props>) {
		return () => {
			let { collapsed, label, cookieName, sidebarId } = handle.props;
			return (
				<label
					data-slot="app-shell-toggle"
					mix={[
						relative(),
						media("(min-width: 48rem)", raw({ display: "inline-flex" })),
						media("(max-width: 47.9375rem)", raw({ display: "none" })),
						items("center"),
						justify("center"),
						shrink(0),
						is("2rem"),
						bs("2rem"),
						hitArea(),
						rounded("md"),
						cursor("pointer"),
						fg("neutral.muted"),
						transition("color, background-color"),
						hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
						when("&:has(input:focus-visible)", outline({ color: "brand.ring", offset: 2 })),
						when("& > svg", [is("1rem"), bs("1rem")]),
					]}
				>
					<PanelLeftIcon aria-hidden="true" />
					<input
						type="checkbox"
						data-app-shell-collapse
						defaultChecked={collapsed}
						aria-label={label}
						aria-keyshortcuts="Meta+B Control+B"
						mix={[visuallyHidden(), appShellControls({ cookieName, sidebarId })]}
					/>
				</label>
			);
		};
	},
);
