/**
 * Compound empty-state box — centered dashed-border card. Compose `Empty.Icon`,
 * `Empty.Title`, `Empty.Description`, and `Empty.Action` inside it for a full
 * "no X yet" state with a call to action, or just `Empty.Description` alone for
 * a lighter-weight inline placeholder (a loading fallback, an empty table). Only
 * `Empty` itself needs importing — the rest hang off it as static properties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import { neutral } from "~/resources/theme";

namespace Empty {
	export interface Props {
		children: RemixNode;
	}
}

const empty = css({
	display: "flex",
	width: "100%",
	flexDirection: "column",
	alignItems: "center",
	gap: 12,
	borderRadius: 12,
	border: `1px dashed ${neutral[300]}`,
	padding: 32,
	textAlign: "center",
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
		color: neutral[50],
	},
});

/** Centered dashed-border container; place `Empty.Icon`/`Empty.Title`/`Empty.Description`/`Empty.Action` inside. */
export default function Empty(handle: Handle<Empty.Props>) {
	return () => <div mix={[empty]}>{handle.props.children}</div>;
}

interface EmptyIconProps {
	children: RemixNode;
}

const emptyIcon = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: 12,
	aspectRatio: "1 / 1",
	borderRadius: "9999px",
	border: `1px solid ${neutral[300]}`,
	background: neutral[100],
	color: "inherit",
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
		background: neutral[800],
	},
});

/** Circular badge that sizes itself to its icon plus padding (kept square via `aspect-ratio`); the icon picks up its color from here via `currentColor`. */
function EmptyIcon(handle: Handle<EmptyIconProps>) {
	return () => (
		<div mix={[emptyIcon]} aria-hidden>
			{handle.props.children}
		</div>
	);
}

interface EmptyTitleProps {
	children: RemixNode;
}

const emptyTitle = css({
	margin: 0,
	fontSize: "1rem",
	fontWeight: 600,
	lineHeight: 1.375,
	letterSpacing: "-0.01em",
});

/** Bold, compact heading. */
function EmptyTitle(handle: Handle<EmptyTitleProps>) {
	return () => <h3 mix={[emptyTitle]}>{handle.props.children}</h3>;
}

interface EmptyDescriptionProps {
	children: RemixNode;
}

const emptyDescription = css({
	margin: 0,
	fontSize: "0.875rem",
	lineHeight: 1.625,
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** Muted supporting copy below the title. */
function EmptyDescription(handle: Handle<EmptyDescriptionProps>) {
	return () => <p mix={[emptyDescription]}>{handle.props.children}</p>;
}

interface EmptyActionProps {
	children: RemixNode;
}

const emptyAction = css({ marginTop: 4 });

/** Wraps the primary call-to-action (a `LinkButton`/`Button`) with a bit of extra top spacing. */
function EmptyAction(handle: Handle<EmptyActionProps>) {
	return () => <div mix={[emptyAction]}>{handle.props.children}</div>;
}

Empty.Icon = EmptyIcon;
Empty.Title = EmptyTitle;
Empty.Description = EmptyDescription;
Empty.Action = EmptyAction;
