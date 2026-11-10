/**
 * CSS miniatures for the `/apps` showcase cards: each card opens with a small drawn UI of
 * the product so every preview shares the same stage height — the same idea as the demos
 * gallery on sdxc.dev.
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
import { font, text, tracking, truncate, weight } from "@sdxc/u/typography";

namespace Stage {
	export interface Props {
		children: RemixNode;
		label: string;
	}
}

/** The stage every miniature shares, so cards in a row line up. */
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

/** Sessions on Wakaba's learning path, with the next one still open. */
const WAKABA_SESSIONS = [
	{ name: "Session 38", done: true },
	{ name: "Session 39", done: true },
	{ name: "Session 40", done: false },
	{ name: "Session 41", done: false },
] as const;

/**
 * Wakaba in miniature: a streak strip and a short path list, so the card reads as Japanese
 * practice before its name is read.
 *
 * @returns The render function producing the miniature.
 */
export function WakabaPreview() {
	return () => (
		<Stage label="Wakaba learning path">
			<div mix={[vstack({ gap: 2, align: "stretch" }), p(3), is("100%"), bs("100%")]}>
				<div
					mix={[
						hstack({ gap: 2, align: "center", justify: "between" }),
						p(2),
						rounded("md"),
						bg("brand.tint"),
					]}
				>
					<span mix={[text("xs"), weight("semibold"), fg("brand.emphasis")]}>23-day streak</span>
					<span mix={[text("xs"), fg("brand")]}>Level 3</span>
				</div>
				<ul mix={[m(0), p(0), vstack({ gap: 1.5 }), raw({ listStyle: "none" })]}>
					{WAKABA_SESSIONS.map((session) => (
						<li
							key={session.name}
							mix={[hstack({ gap: 2, align: "center" }), p(2), rounded("md"), bg("neutral.bg")]}
						>
							<span
								aria-hidden="true"
								mix={[
									is(2),
									bs(2),
									rounded("full"),
									session.done ? bg("success.solid") : bg("neutral.border"),
									raw({ flexShrink: "0" }),
								]}
							/>
							<span mix={[truncate(), text("xs"), weight(session.done ? "normal" : "medium")]}>
								{session.name}
							</span>
						</li>
					))}
				</ul>
			</div>
		</Stage>
	);
}

/** Challenge cards Encore would deal next. */
const ENCORE_CARDS = [
	{ title: "EARWORM", prompt: "A song stuck in your head" },
	{ title: "GUILTY PLEASURE", prompt: "One you're embarrassed to love" },
	{ title: "ONE-HIT WONDER", prompt: "Their only charting single" },
] as const;

/**
 * Encore in miniature: a short stack of challenge cards, so the card reads as a music party
 * game before its name is read.
 *
 * @returns The render function producing the miniature.
 */
export function EncorePreview() {
	return () => (
		<Stage label="Encore challenge cards">
			<div mix={[vstack({ gap: 1.5, align: "stretch" }), p(3), is("100%"), bs("100%")]}>
				<div mix={[hstack({ gap: 2, align: "center", justify: "between" }), pi(1)]}>
					<span mix={[weight("semibold"), text("xs")]}>Next up</span>
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
						108
					</span>
				</div>
				<ul mix={[m(0), p(0), vstack({ gap: 1 }), raw({ listStyle: "none" })]}>
					{ENCORE_CARDS.map((card) => (
						<li
							key={card.title}
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
								<span
									mix={[text("xs"), weight("semibold"), tracking("wide"), truncate(), is("100%")]}
								>
									{card.title}
								</span>
								<span mix={[text("xs"), fg("neutral.muted"), truncate(), is("100%")]}>
									{card.prompt}
								</span>
							</span>
						</li>
					))}
				</ul>
			</div>
		</Stage>
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
