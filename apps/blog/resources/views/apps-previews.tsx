/**
 * Visual stages for the `/apps` showcase: fanned phone screenshots for the App Store apps,
 * and product windows for the web ones, so each band shows the product rather than a
 * miniature card illustration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { block, gap, grid, gridTemplate, hidden, hstack, vstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { bs, is, m, maxIs, p, pi } from "@sdxc/u/size";
import { font, text, truncate, weight } from "@sdxc/u/typography";
import { ProductFrame } from "@sdxc/ui/landing";

import { PhoneFrame, screenCorners } from "~/resources/views/app-pages/phone";

/** Capture folders under `/apps/{app}/screenshots/`. */
type CaptureLang = "en" | "es";

/** One light/dark phone capture under an app's screenshot tree. */
interface PhoneShot {
	base: string;
	alt: string;
	/** Loads with the first paint when this phone leads the fan. */
	eager?: boolean;
}

namespace AppPhone {
	export interface Props {
		shot: PhoneShot;
		/** Overrides the default ink bezel when the band sits on the blog shell. */
		bezel?: string;
	}
}

/**
 * A framed App Store capture: light and dark sources, clipped to the phone screen, at the
 * width the fan gives it.
 *
 * @returns The render function producing the framed shot.
 */
function AppPhone(handle: Handle<AppPhone.Props>) {
	return () => {
		let { bezel = "#161412", shot } = handle.props;
		return (
			<div mix={[raw({ "--app-bezel": bezel })]}>
				<PhoneFrame>
					<picture mix={[block(), screenCorners()]}>
						<source
							media="(prefers-color-scheme: dark)"
							srcSet={`${shot.base}-dark.webp`}
							width={560}
							height={1218}
						/>
						<img
							src={`${shot.base}-light.webp`}
							alt={shot.alt}
							width={560}
							height={1218}
							loading={shot.eager ? "eager" : "lazy"}
							decoding="async"
							fetchpriority={shot.eager ? "high" : undefined}
							mix={[block(), is("full"), raw({ blockSize: "auto" })]}
						/>
					</picture>
				</PhoneFrame>
			</div>
		);
	};
}

namespace FannedPhone {
	export interface Props {
		side: "start" | "end";
		children: RemixNode;
	}
}

/**
 * A phone tilted out from behind the front screen once the stage is wide enough; on a
 * narrow column the front phone stands alone.
 *
 * @returns The render function producing the tilted phone.
 */
function FannedPhone(handle: Handle<FannedPhone.Props>) {
	return () => {
		let start = handle.props.side === "start";
		return (
			<div
				mix={[
					hidden(),
					at(
						"md",
						"apps-phone-fan",
						raw({
							display: "block",
							flexShrink: "0",
							inlineSize: "var(--phone)",
							marginBlockStart: "calc(var(--phone) * 0.18)",
							marginInline: start ? "0 calc(var(--phone) * -0.12)" : "calc(var(--phone) * -0.12) 0",
							scale: "0.86",
							rotate: start ? "-7deg" : "7deg",
							transformOrigin: start ? "100% 0%" : "0% 0%",
						}),
					),
				]}
			>
				{handle.props.children}
			</div>
		);
	};
}

namespace PhoneFan {
	export interface Props {
		label: string;
		front: PhoneShot;
		start: PhoneShot;
		end: PhoneShot;
		bezel?: string;
	}
}

/**
 * Three phones on a stage: the front screen readable, two more fanned behind it with a
 * light tilt, matching how the App Store landings introduce their product.
 *
 * @returns The render function producing the fan.
 */
function PhoneFan(handle: Handle<PhoneFan.Props>) {
	return () => {
		let { bezel, end, front, label, start } = handle.props;
		return (
			<div
				mix={[
					raw({
						"--phone": "min(14rem, 58cqi)",
						position: "relative",
						isolation: "isolate",
						overflow: "visible",
						paddingBlock: "0.75rem 1.25rem",
					}),
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
					{label}
				</span>
				<div
					data-slot="apps-phone-fan"
					mix={[
						hstack({ gap: 0, align: "start", justify: "center" }),
						raw({ containerType: "inline-size", containerName: "apps-phone-fan" }),
					]}
				>
					<FannedPhone side="start">
						<AppPhone shot={start} bezel={bezel} />
					</FannedPhone>
					<div
						mix={[
							raw({
								inlineSize: "var(--phone)",
								flexShrink: "0",
								zIndex: "1",
							}),
							motionSafe(
								raw({
									rotate: "-1.5deg",
									transformOrigin: "50% 100%",
								}),
							),
						]}
					>
						<AppPhone shot={{ ...front, eager: true }} bezel={bezel} />
					</div>
					<FannedPhone side="end">
						<AppPhone shot={end} bezel={bezel} />
					</FannedPhone>
				</div>
			</div>
		);
	};
}

/** Maps the page locale to the capture folder name. */
function captureLang(locale: string): CaptureLang {
	return locale === "en" ? "en" : "es";
}

namespace WakabaStage {
	export interface Props {
		locale: string;
		label: string;
	}
}

/**
 * Wakaba's band media: the learning path up front, a flashcard and a practice screen
 * fanned behind it.
 *
 * @returns The render function producing the stage.
 */
export function WakabaStage(handle: Handle<WakabaStage.Props>) {
	return () => {
		let lang = captureLang(handle.props.locale);
		let root = `/apps/wakaba/screenshots/${lang}`;
		return (
			<PhoneFan
				label={handle.props.label}
				bezel="#161412"
				front={{
					base: `${root}/path-progress`,
					alt: "Wakaba learning path at Level 3",
				}}
				start={{
					base: `${root}/flashcards-fish`,
					alt: "Wakaba flashcard for 魚",
				}}
				end={{
					base: `${root}/practice`,
					alt: "Wakaba practice question",
				}}
			/>
		);
	};
}

namespace EncoreStage {
	export interface Props {
		locale: string;
		label: string;
	}
}

/**
 * Encore's band media: a revealed challenge up front, the card back and a swipe screen
 * fanned behind it, in the app's plum bezel.
 *
 * @returns The render function producing the stage.
 */
export function EncoreStage(handle: Handle<EncoreStage.Props>) {
	return () => {
		let lang = captureLang(handle.props.locale);
		let root = `/apps/encore/screenshots/${lang}`;
		return (
			<PhoneFan
				label={handle.props.label}
				bezel="#1a0830"
				front={{
					base: `${root}/challenge`,
					alt: "Encore EARWORM challenge card",
				}}
				start={{
					base: `${root}/card-back`,
					alt: "Encore face-down card",
				}}
				end={{
					base: `${root}/swipe`,
					alt: "Encore swipe for the next challenge",
				}}
			/>
		);
	};
}

/** A grey bar standing in for a line of text inside a web-app window. */
function Line(handle: Handle<{ width: string; strong?: boolean }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "block",
					blockSize: "0.4rem",
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

/** Monitors drawn inside the Uptime window. */
const MONITORS = [
	{ name: "api.example.com", up: true },
	{ name: "www.example.com", up: true },
	{ name: "cron.nightly", up: false },
	{ name: "dns.example.com", up: true },
] as const;

/**
 * Uptime's band media: a product window with a status strip and monitor list, so the web
 * app reads as itself without a phone capture.
 *
 * @returns The render function producing the framed window.
 */
export function UptimeStage() {
	return () => (
		<ProductFrame
			lights
			title="Uptime"
			url="uptime.sergiodxa.com"
			shadow="tinted"
			mix={[maxIs("28rem"), raw({ marginInline: "auto", rotate: "1.5deg" })]}
		>
			<div
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					p(3),
					bg("neutral.bg-tint"),
					fg("neutral.emphasis"),
					font("sans"),
					text("xs"),
					raw({ minBlockSize: "14rem" }),
				]}
			>
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
		</ProductFrame>
	);
}

/** Unread posts drawn inside the Reader window. */
const POSTS = [
	{ feed: "Rachel Andrew", title: "Container queries, one year on" },
	{ feed: "Chris Coyier", title: "What is a feed reader for?" },
	{ feed: "Jeremy Keith", title: "Progressive enhancement still" },
	{ feed: "Maya Posch", title: "Reading offline on a train" },
] as const;

/**
 * Reader's band media: a product window with an unread stack, tilted the other way from
 * Uptime so the two web bands don't mirror each other.
 *
 * @returns The render function producing the framed window.
 */
export function ReaderStage() {
	return () => (
		<ProductFrame
			lights
			title="Reader"
			url="reader.sergiodxa.com"
			shadow="tinted"
			mix={[maxIs("28rem"), raw({ marginInline: "auto", rotate: "-1.5deg" })]}
		>
			<div
				mix={[
					vstack({ gap: 1.5, align: "stretch" }),
					p(3),
					bg("neutral.bg-tint"),
					fg("neutral.emphasis"),
					font("sans"),
					text("xs"),
					raw({ minBlockSize: "14rem" }),
				]}
			>
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
		</ProductFrame>
	);
}
