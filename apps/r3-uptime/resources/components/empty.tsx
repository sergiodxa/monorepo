/**
 * Compound empty-state box — centered dashed-border card. Compose `EmptyIcon`,
 * `EmptyTitle`, `EmptyDescription`, and `EmptyAction` inside it for a full "no X
 * yet" state with a call to action, or just `EmptyDescription` alone for a
 * lighter-weight inline placeholder (a loading fallback, an empty table).
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

/** Centered dashed-border container; place {@link EmptyIcon}/{@link EmptyTitle}/{@link EmptyDescription}/{@link EmptyAction} inside. */
export function Empty(handle: Handle<Empty.Props>) {
	return () => <div mix={[empty]}>{handle.props.children}</div>;
}

namespace EmptyIcon {
	export interface Props {
		children: RemixNode;
	}
}

const emptyIcon = css({
	display: "flex",
	width: 48,
	height: 48,
	alignItems: "center",
	justifyContent: "center",
	borderRadius: "9999px",
	border: `1px solid ${neutral[300]}`,
	background: neutral[100],
	color: "inherit",
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
		background: neutral[800],
	},
});

/** Circular badge around a resource icon; the icon itself picks up its color from here via `currentColor`. */
export function EmptyIcon(handle: Handle<EmptyIcon.Props>) {
	return () => (
		<div mix={[emptyIcon]} aria-hidden>
			{handle.props.children}
		</div>
	);
}

namespace EmptyTitle {
	export interface Props {
		children: RemixNode;
	}
}

const emptyTitle = css({
	margin: 0,
	fontSize: "1rem",
	fontWeight: 600,
	lineHeight: 1.375,
	letterSpacing: "-0.01em",
});

/** Bold, compact heading. */
export function EmptyTitle(handle: Handle<EmptyTitle.Props>) {
	return () => <h3 mix={[emptyTitle]}>{handle.props.children}</h3>;
}

namespace EmptyDescription {
	export interface Props {
		children: RemixNode;
	}
}

const emptyDescription = css({
	margin: 0,
	fontSize: "0.875rem",
	lineHeight: 1.625,
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** Muted supporting copy below the title. */
export function EmptyDescription(handle: Handle<EmptyDescription.Props>) {
	return () => <p mix={[emptyDescription]}>{handle.props.children}</p>;
}

namespace EmptyAction {
	export interface Props {
		children: RemixNode;
	}
}

const emptyAction = css({ marginTop: 4 });

/** Wraps the primary call-to-action (a `LinkButton`/`Button`) with a bit of extra top spacing. */
export function EmptyAction(handle: Handle<EmptyAction.Props>) {
	return () => <div mix={[emptyAction]}>{handle.props.children}</div>;
}

export default { Empty, EmptyIcon, EmptyTitle, EmptyDescription, EmptyAction };
