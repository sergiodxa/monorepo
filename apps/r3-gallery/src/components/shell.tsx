import type { Handle, RemixNode } from "remix/ui";

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
					boxSizing: "border-box",
					padding: "clamp(2rem, 7vw, 5rem) clamp(1rem, 4vw, 4rem) clamp(1.5rem, 4vw, 3rem)",
				})}
			>
				<div
					mix={css({
						display: "grid",
						boxSizing: "border-box",
						gap: "1rem",
						maxWidth: "72rem",
						margin: "0 auto",
					})}
				>
					<p
						mix={css({
							margin: 0,
							color: "#9a3412",
							fontSize: "0.78rem",
							fontWeight: 800,
							letterSpacing: "0.18em",
							textTransform: "uppercase",
						})}
					>
						{handle.props.eyebrow}
					</p>
					<h1
						mix={css({
							maxWidth: "14ch",
							margin: 0,
							fontFamily: 'Georgia, "Times New Roman", serif',
							fontSize: "clamp(3rem, 10vw, 8.5rem)",
							fontWeight: 500,
							letterSpacing: "-0.08em",
							lineHeight: 0.84,
						})}
					>
						{handle.props.title}
					</h1>
					<p
						mix={css({
							maxWidth: "42rem",
							margin: 0,
							color: "#6b4f43",
							fontSize: "clamp(1rem, 2vw, 1.2rem)",
						})}
					>
						{handle.props.intro}
					</p>
				</div>
			</header>
			<main
				mix={css({
					boxSizing: "border-box",
					maxWidth: "72rem",
					margin: "0 auto",
					padding: "0 clamp(1rem, 4vw, 4rem) 5rem",
				})}
			>
				{handle.props.children}
			</main>
		</div>
	);
}
