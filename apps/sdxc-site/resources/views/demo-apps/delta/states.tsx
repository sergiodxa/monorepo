/**
 * How Delta draws where an issue or pull request stands: a toned icon whose shape carries the
 * state as well as its colour (open, done, not planned, draft, merged, closed), the pill a
 * detail page's header wears, and a person's avatar by handle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CircleCheckIcon,
	CircleDotIcon,
	CircleSlashIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";

import { InitialsTile } from "./glyphs";
import { findPerson } from "./seed/people";

/** Where an issue or pull request stands, as its icon and pill draw it. */
export type RecordState =
	| "open"
	| "completed"
	| "not_planned"
	| "draft"
	| "pr-open"
	| "merged"
	| "pr-closed";

/** Each state's colour: open green, done and merged purple, closed red, the rest muted. */
const TONES: Record<RecordState, string> = {
	open: "light-dark(oklch(0.52 0.14 150), oklch(0.72 0.15 150))",
	"pr-open": "light-dark(oklch(0.52 0.14 150), oklch(0.72 0.15 150))",
	completed: "light-dark(oklch(0.5 0.17 300), oklch(0.72 0.14 300))",
	merged: "light-dark(oklch(0.5 0.17 300), oklch(0.72 0.14 300))",
	"pr-closed": "light-dark(oklch(0.53 0.18 25), oklch(0.7 0.15 25))",
	not_planned: "var(--ui-neutral-fg-muted)",
	draft: "var(--ui-neutral-fg-muted)",
};

/** Each state's pill fill, dark enough for white text in both themes. */
const PILLS: Record<RecordState, string> = {
	open: "light-dark(oklch(0.55 0.15 150), oklch(0.5 0.13 150))",
	"pr-open": "light-dark(oklch(0.55 0.15 150), oklch(0.5 0.13 150))",
	completed: "light-dark(oklch(0.52 0.18 300), oklch(0.5 0.16 300))",
	merged: "light-dark(oklch(0.52 0.18 300), oklch(0.5 0.16 300))",
	"pr-closed": "light-dark(oklch(0.55 0.19 25), oklch(0.52 0.17 25))",
	not_planned: "light-dark(oklch(0.52 0.01 75), oklch(0.45 0.01 75))",
	draft: "light-dark(oklch(0.52 0.01 75), oklch(0.45 0.01 75))",
};

/** Each state's glyph, so states read apart without their colour. */
function glyph(state: RecordState, size: number): RemixNode {
	let props = { size, "aria-hidden": "true" as const };
	if (state === "open") return <CircleDotIcon {...props} />;
	if (state === "completed") return <CircleCheckIcon {...props} />;
	if (state === "not_planned") return <CircleSlashIcon {...props} />;
	if (state === "draft") return <GitPullRequestDraftIcon {...props} />;
	if (state === "merged") return <GitMergeIcon {...props} />;
	if (state === "pr-closed") return <GitPullRequestClosedIcon {...props} />;
	return <GitPullRequestIcon {...props} />;
}

namespace StateIcon {
	export interface Props {
		state: RecordState;
		/** Read in place of the glyph, such as "Open issue". */
		label: string;
		/** @default 16 */
		size?: number;
	}
}

/** Renders a state's toned glyph with its name for assistive technology. */
export function StateIcon(handle: Handle<StateIcon.Props>) {
	return () => {
		let { label, size = 16, state } = handle.props;
		return (
			<span
				data-state={state}
				mix={[raw({ display: "inline-flex", flexShrink: 0, color: TONES[state] })]}
			>
				{glyph(state, size)}
				<span mix={[visuallyHidden()]}>{label}</span>
			</span>
		);
	};
}

namespace StatePill {
	export interface Props {
		state: RecordState;
		children: RemixNode;
	}
}

/** Renders the solid pill a detail page's header names its state with: icon and word. */
export function StatePill(handle: Handle<StatePill.Props>) {
	return () => {
		let { children, state } = handle.props;
		return (
			<span
				data-slot="delta-state-pill"
				data-state={state}
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.375rem",
						flexShrink: 0,
						minBlockSize: "2rem",
						paddingInline: "0.75rem",
						borderRadius: "999px",
						fontSize: "0.875rem",
						fontWeight: 500,
						color: "white",
						backgroundColor: PILLS[state],
					}),
				]}
			>
				{glyph(state, 16)}
				{children}
			</span>
		);
	};
}

namespace Avatar {
	export interface Props {
		handle: string;
		/** @default 20 */
		size?: number;
	}
}

/** Renders a person's avatar from their handle, by their name's initials. */
export function Avatar(handle: Handle<Avatar.Props>) {
	return () => {
		let { size = 20 } = handle.props;
		let person = findPerson(handle.props.handle);
		return <InitialsTile name={person?.name ?? handle.props.handle} size={size} />;
	};
}

/** A person's name by handle, or the handle when the org has no such member. */
export function nameOf(handle: string): string {
	return findPerson(handle)?.name ?? handle;
}
