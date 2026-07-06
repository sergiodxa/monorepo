/**
 * ActionLink component for the gallery, a reusable pill-shaped anchor with default and
 * compact size variants and the shared orange focus-visible treatment. It centralizes
 * the app's navigation-link styling so routes render consistent, accessible links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

/**
 * Props for pill-shaped navigation links used across gallery routes.
 */
export interface ActionLinkProps {
	href: string;
	children: RemixNode;
	variant?: "default" | "compact";
}

/**
 * Renders a shared pill-shaped anchor with the gallery focus treatment.
 *
 * @param handle Component handle carrying link target, label, and visual variant.
 * @returns A styled navigation link.
 */
export function ActionLink(handle: Handle<ActionLinkProps>) {
	return () => (
		<a
			href={handle.props.href}
			mix={css({
				display: "inline-flex",
				minHeight: "2.75rem",
				alignItems: "center",
				justifyContent: "center",
				padding: handle.props.variant === "compact" ? "0.7rem 1rem" : "0.8rem 1.1rem",
				border: "1px solid rgb(154 52 18 / 0.18)",
				borderRadius: "999rem",
				background: "rgb(255 255 255 / 0.74)",
				color: "#7c2d12",
				font: "inherit",
				fontWeight: 800,
				textDecoration: "none",
				cursor: "pointer",
				WebkitTapHighlightColor: "transparent",
				"&:focus-visible": {
					outline: "3px solid #f97316",
					outlineOffset: "4px",
				},
			})}
		>
			{handle.props.children}
		</a>
	);
}
