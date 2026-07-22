/**
 * Shell layout component for the gallery. It renders the shared page frame with a
 * gradient background, an eyebrow/title/intro header block, and a centered main area
 * for route children, so every route presents the same consistent chrome and styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Header, Heading, HeadingScope, Text } from "@pkg/r3-ui";
import { css } from "remix/ui";

/**
 * Props for the shared document shell.
 */
export interface ShellProps {
	eyebrow: string;
	title: string;
	intro: string;
	children: RemixNode;
}

/**
 * Creates the page frame used by all routes.
 *
 * @param handle Component handle carrying shell copy and route children.
 * @returns The shared gallery page frame.
 */
export function Shell(handle: Handle<ShellProps>) {
	return () => (
		<div
			mix={css({
				boxSizing: "border-box",
				minWidth: "320px",
				minHeight: "100vh",
				color: "#241b16",
				background:
					"radial-gradient(circle at top left, rgb(252 211 77 / 0.42), transparent 34rem), linear-gradient(135deg, #fff7ed 0%, #fbf3ea 48%, #fef2f2 100%)",
				fontFamily:
					'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
				fontSynthesis: "none",
				lineHeight: 1.5,
				textRendering: "optimizeLegibility",
				WebkitFontSmoothing: "antialiased",
			})}
		>
			<header
				mix={css({
					display: "grid",
					boxSizing: "border-box",
					gap: "1rem",
					maxWidth: "72rem",
					margin: "0 auto",
					padding: "clamp(2rem, 7vw, 5rem) clamp(1rem, 4vw, 4rem) clamp(1.5rem, 4vw, 3rem)",
				})}
			>
				<Header
					mix={css({
						padding: 0,
						color: "var(--ui-primary-fg-emphasis)",
						fontSize: "0.78rem",
						letterSpacing: "0.18em",
					})}
				>
					{handle.props.eyebrow}
				</Header>
				<Heading
					level={1}
					mix={css({
						maxWidth: "14ch",
						fontFamily: 'Georgia, "Times New Roman", serif',
						fontSize: "clamp(3rem, 10vw, 8.5rem)",
						fontWeight: 500,
						letterSpacing: "-0.08em",
						lineHeight: 0.84,
						color: "inherit",
					})}
				>
					{handle.props.title}
				</Heading>
				<Text
					mix={css({
						display: "block",
						maxWidth: "42rem",
						color: "#6b4f43",
						fontSize: "clamp(1rem, 2vw, 1.2rem)",
					})}
				>
					{handle.props.intro}
				</Text>
			</header>
			<main
				mix={css({
					boxSizing: "border-box",
					maxWidth: "72rem",
					margin: "0 auto",
					padding: "0 clamp(1rem, 4vw, 4rem) 5rem",
				})}
			>
				<HeadingScope level={2}>{handle.props.children}</HeadingScope>
			</main>
		</div>
	);
}
