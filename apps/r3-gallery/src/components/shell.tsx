/**
 * Shell layout component for the gallery. It renders the shared page frame with a
 * gradient background, an eyebrow/title/intro header block, and a centered main area
 * for route children, so every route presents the same consistent chrome and styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { fg } from "@pkg/u/color";
import { raw } from "@pkg/u/general";
import { block, boxSizing, gap, grid } from "@pkg/u/layout";
import { m, maxWidth, minHeight, minWidth, p } from "@pkg/u/size";
import { fontSize, leading, tracking, weight } from "@pkg/u/typography";
import { Header, Heading, HeadingScope, Text } from "@pkg/ui";

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
			mix={[
				boxSizing("border-box"),
				minWidth("320px"),
				minHeight("100vh"),
				raw({
					color: "#241b16",
					background:
						"radial-gradient(circle at top left, rgb(252 211 77 / 0.42), transparent 34rem), linear-gradient(135deg, #fff7ed 0%, #fbf3ea 48%, #fef2f2 100%)",
					fontFamily:
						'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
					fontSynthesis: "none",
					textRendering: "optimizeLegibility",
					WebkitFontSmoothing: "antialiased",
				}),
				leading(1.5),
			]}
		>
			<header
				mix={[
					grid(),
					gap("1rem"),
					m(0, "auto"),
					boxSizing("border-box"),
					maxWidth("72rem"),
					raw({
						padding: "clamp(2rem, 7vw, 5rem) clamp(1rem, 4vw, 4rem) clamp(1.5rem, 4vw, 3rem)",
					}),
				]}
			>
				<Header mix={[p(0), fg("brand.emphasis"), fontSize("0.78rem"), tracking("0.18em")]}>
					{handle.props.eyebrow}
				</Header>
				<Heading
					level={1}
					mix={[
						weight(500),
						leading(0.84),
						fg("inherit"),
						maxWidth("14ch"),
						tracking("-0.08em"),
						raw({
							fontFamily: 'Georgia, "Times New Roman", serif',
							fontSize: "clamp(3rem, 10vw, 8.5rem)",
						}),
					]}
				>
					{handle.props.title}
				</Heading>
				<Text
					mix={[
						block(),
						maxWidth("42rem"),
						raw({
							color: "#6b4f43",
							fontSize: "clamp(1rem, 2vw, 1.2rem)",
						}),
					]}
				>
					{handle.props.intro}
				</Text>
			</header>
			<main
				mix={[
					m(0, "auto"),
					boxSizing("border-box"),
					maxWidth("72rem"),
					raw({
						padding: "0 clamp(1rem, 4vw, 4rem) 5rem",
					}),
				]}
			>
				<HeadingScope level={2}>{handle.props.children}</HeadingScope>
			</main>
		</div>
	);
}
