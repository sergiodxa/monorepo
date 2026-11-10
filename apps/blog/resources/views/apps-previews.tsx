/**
 * Visual previews for the `/apps` showcase cards: real screenshots for the App Store apps,
 * and CSS miniatures for the web apps, so every card shows what the product looks like
 * before its name is read — the same idea as the demos gallery on sdxc.dev.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { bs, is, m, p, pi } from "@sdxc/u/size";
import { font, text, truncate, weight } from "@sdxc/u/typography";

/** One light/dark pair of a product screenshot under `/apps/…`. */
interface Shot {
	light: string;
	dark: string;
	alt: string;
}

/** The capture each App Store card opens with. */
const SHOTS: Record<"wakaba" | "encore", Shot> = {
	wakaba: {
		light: "/apps/wakaba/screenshots/en/path-progress-light.webp",
		dark: "/apps/wakaba/screenshots/en/path-progress-dark.webp",
		alt: "Wakaba's learning path on iPhone",
	},
	encore: {
		light: "/apps/encore/screenshots/en/challenge-light.webp",
		dark: "/apps/encore/screenshots/en/challenge-dark.webp",
		alt: "Encore's challenge card on iPhone",
	},
};

/**
 * A light/dark product screenshot cropped into the same stage height as the web-app
 * miniatures, so every card in the gallery lines up.
 *
 * @returns The render function producing the miniature.
 */
export function AppShot(handle: Handle<{ app: "wakaba" | "encore" }>) {
	return () => {
		let shot = SHOTS[handle.props.app];
		return (
			<Stage label={shot.alt}>
				<picture
					mix={[
						raw({
							display: "block",
							inlineSize: "100%",
							blockSize: "100%",
						}),
					]}
				>
					<source media="(prefers-color-scheme: dark)" srcset={shot.dark} />
					<img
						src={shot.light}
						alt=""
						width={780}
						height={1688}
						mix={[
							raw({
								display: "block",
								inlineSize: "100%",
								blockSize: "100%",
								objectFit: "cover",
								objectPosition: "center top",
							}),
						]}
					/>
				</picture>
			</Stage>
		);
	};
}

namespace Stage {
	export interface Props {
		children: RemixNode;
		label: string;
	}
}

/** The stage every CSS miniature shares, so cards in a row line up. */
function Stage(handle: Handle<Stage.Props>) {
	return () => (
		<div
			aria-hidden="true"
			mix={[
				raw({
					position: "relative",
					overflow: "hidden",
					blockSize: "11rem",
					borderRadius: "0.75rem",
					boxShadow:
						"inset 0 0 0 1px var(--ui-landing-hairline, color-mix(in oklch, CanvasText 8%, transparent))",
				}),
				bg("neutral.bg-tint"),
				fg("neutral.emphasis"),
				font("sans"),
				text("xs"),
			]}
		>
			<span
				mix={[
					raw({
						position: "absolute",
						width: "1px",
						height: "1px",
						overflow: "hidden",
						clip: "rect(0 0 0 0)",
					}),
				]}
			>
				{handle.props.label}
			</span>
			{handle.props.children}
		</div>
	);
}

/** A grey bar standing in for a line of text. */
function Line(handle: Handle<{ width: string; strong?: boolean }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "block",
					blockSize: "0.35rem",
					inlineSize: handle.props.width,
					borderRadius: "999px",
					background: handle.props.strong
						? "var(--ui-neutral-fg-muted)"
						: "var(--ui-neutral-border)",
				}),
			]}
		/>
	);
}

/** The monitors the Uptime miniature lists, with an up/down pulse. */
const MONITORS = [
	{ name: "api.example.com", up: true },
	{ name: "www.example.com", up: true },
	{ name: "cron.nightly", up: false },
	{ name: "dns.example.com", up: true },
] as const;

/**
 * Uptime in miniature: a status strip and a short monitor list, so the card reads as
 * monitoring before its name is read.
 *
 * @returns The render function producing the miniature.
 */
export function UptimePreview() {
	return () => (
		<Stage label="Uptime monitor list">
			<div mix={[vstack({ gap: 2, align: "stretch" }), p(3), is("100%"), bs("100%")]}>
				<div
					mix={[
						hstack({ gap: 2, align: "center", justify: "between" }),
						p(2),
						rounded("md"),
						bg("success.tint"),
					]}
				>
					<span mix={[text("xs"), weight("semibold"), fg("success.emphasis")]}>All systems up</span>
					<span mix={[text("xs"), fg("success")]}>99.98%</span>
				</div>
				<ul mix={[m(0), p(0), vstack({ gap: 1.5 }), raw({ listStyle: "none" })]}>
					{MONITORS.map((monitor) => (
						<li
							key={monitor.name}
							mix={[hstack({ gap: 2, align: "center" }), p(2), rounded("md"), bg("neutral.bg")]}
						>
							<span
								aria-hidden="true"
								mix={[
									is(2),
									bs(2),
									rounded("full"),
									monitor.up ? bg("success.solid") : bg("danger.solid"),
									raw({ flexShrink: "0" }),
								]}
							/>
							<span mix={[truncate(), font("mono"), text("xs")]}>{monitor.name}</span>
						</li>
					))}
				</ul>
			</div>
		</Stage>
	);
}

/** The unread posts the Reader miniature stacks. */
const POSTS = [
	{ feed: "Rachel Andrew", title: "Container queries, one year on" },
	{ feed: "Chris Coyier", title: "What is a feed reader for?" },
	{ feed: "Jeremy Keith", title: "Progressive enhancement still" },
	{ feed: "Maya Posch", title: "Reading offline on a train" },
] as const;

/**
 * Reader in miniature: a stack of unread posts with feed names, so the card reads as a
 * feed reader before its name is read.
 *
 * @returns The render function producing the miniature.
 */
export function ReaderPreview() {
	return () => (
		<Stage label="Reader unread list">
			<div mix={[vstack({ gap: 1.5, align: "stretch" }), p(3), is("100%"), bs("100%")]}>
				<div mix={[hstack({ gap: 2, align: "center", justify: "between" }), pi(1)]}>
					<span mix={[weight("semibold"), text("xs")]}>Unread</span>
					<span
						mix={[
							pi(2),
							rounded("full"),
							bg("brand.tint"),
							fg("brand.emphasis"),
							text("xs"),
							weight("medium"),
						]}
					>
						24
					</span>
				</div>
				<ul mix={[m(0), p(0), vstack({ gap: 1 }), raw({ listStyle: "none" })]}>
					{POSTS.map((post) => (
						<li
							key={post.title}
							mix={[
								grid(),
								gap(1),
								gridTemplate({ columns: "0.4rem 1fr" }),
								p(2),
								rounded("md"),
								bg("neutral.bg"),
							]}
						>
							<span
								aria-hidden="true"
								mix={[
									is(1.5),
									bs(1.5),
									rounded("full"),
									bg("brand.solid"),
									raw({ alignSelf: "start", marginBlockStart: "0.35rem" }),
								]}
							/>
							<span mix={[vstack({ gap: 1, align: "start" }), raw({ minInlineSize: 0 })]}>
								<span mix={[text("xs"), fg("neutral.muted"), truncate(), is("100%")]}>
									{post.feed}
								</span>
								<Line width="92%" strong />
								<Line width="64%" />
							</span>
						</li>
					))}
				</ul>
			</div>
		</Stage>
	);
}
