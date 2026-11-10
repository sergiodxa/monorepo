/**
 * Visual stages for the `/apps` showcase: fanned phone screenshots for the App Store apps,
 * and product windows for the web ones, each with a pausable float or pulse so the gallery
 * feels alive without competing with the copy beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ActivityIcon,
	BellIcon,
	BookmarkIcon,
	ClockIcon,
	GlobeIcon,
	InboxIcon,
	RssIcon,
	SearchIcon,
	SettingsIcon,
} from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { block, hidden, hstack, vstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { bs, is, p } from "@sdxc/u/size";
import { font, text, truncate, weight } from "@sdxc/u/typography";
import { MotionLoop, ProductFrame } from "@sdxc/ui/landing";

import { PhoneFrame, screenCorners } from "~/resources/views/app-pages/phone";

/** A hairline matching the product frames on the Uptime and Reader landings. */
const HAIRLINE = "1px solid var(--ui-landing-hairline, var(--ui-neutral-border))";

/** Capture folders under `/apps/{app}/screenshots/`. */
type CaptureLang = "en" | "es";

/** One light/dark phone capture under an app's screenshot tree. */
interface PhoneShot {
	base: string;
	alt: string;
	/** Loads with the first paint when this phone leads the fan. */
	eager?: boolean;
}

/**
 * A slow bob that keeps a phone or window feeling held rather than glued down. Delay
 * offsets neighbours so they never rise together; reduced-motion visitors see the rest pose.
 *
 * @param name Unique keyframe name for this bob.
 * @param delay Negative delay so the loop is mid-cycle on first paint.
 * @param rise How far the host lifts at the peak.
 * @param rotate Resting tilt kept through the motion so float does not flatten it.
 */
function bob(name: string, delay: string, rise: string, rotate: string) {
	return [
		keyframes(name, {
			"0%, 100%": { translate: "0 0", rotate },
			"50%": { translate: `0 ${rise}`, rotate },
		}),
		motionSafe(
			raw({
				animationName: name,
				animationDuration: "5.5s",
				animationTimingFunction: "ease-in-out",
				animationIterationCount: "infinite",
				animationDelay: delay,
			}),
		),
	];
}

/**
 * A soft breath on a status dot: scale and opacity dip mid-cycle so an up/down pulse reads
 * as live without flashing.
 *
 * @param name Unique keyframe name for this pulse.
 * @param delay Stagger so a row of dots never blink in unison.
 */
function pulse(name: string, delay: string) {
	return [
		keyframes(name, {
			"0%, 100%": { scale: "1", opacity: "1" },
			"50%": { scale: "0.72", opacity: "0.55" },
		}),
		motionSafe(
			raw({
				animationName: name,
				animationDuration: "2.4s",
				animationTimingFunction: "ease-in-out",
				animationIterationCount: "infinite",
				animationDelay: delay,
			}),
		),
	];
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
 * narrow column the front phone stands alone. The tilt is baked into its bob so the float
 * never erases it.
 *
 * @returns The render function producing the tilted phone.
 */
function FannedPhone(handle: Handle<FannedPhone.Props>) {
	return () => {
		let start = handle.props.side === "start";
		let rotate = start ? "-7deg" : "7deg";
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
							transformOrigin: start ? "100% 0%" : "0% 0%",
						}),
					),
					at(
						"md",
						"apps-phone-fan",
						bob(
							start ? "apps-fan-start" : "apps-fan-end",
							start ? "-1.2s" : "-3.4s",
							"-0.4rem",
							rotate,
						),
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
		pauseLabel: string;
		front: PhoneShot;
		start: PhoneShot;
		end: PhoneShot;
		bezel?: string;
	}
}

/**
 * Three phones on a stage: the front screen readable, two more fanned behind it, all
 * floating on staggered bobs inside a pauseable loop.
 *
 * @returns The render function producing the fan.
 */
function PhoneFan(handle: Handle<PhoneFan.Props>) {
	return () => {
		let { bezel, end, front, label, pauseLabel, start } = handle.props;
		return (
			<MotionLoop pauseLabel={pauseLabel}>
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
									transformOrigin: "50% 100%",
								}),
								bob("apps-fan-front", "-0.4s", "-0.55rem", "-1.5deg"),
							]}
						>
							<AppPhone shot={{ ...front, eager: true }} bezel={bezel} />
						</div>
						<FannedPhone side="end">
							<AppPhone shot={end} bezel={bezel} />
						</FannedPhone>
					</div>
				</div>
			</MotionLoop>
		);
	};
}

/** Maps the page locale to the capture folder name. */
function captureLang(locale: string): CaptureLang {
	return locale === "en" ? "en" : "es";
}

namespace AppsHeroStage {
	export interface Props {
		locale: string;
		label: string;
		pauseLabel: string;
	}
}

/**
 * The hero's media: three phones from the App Store apps fanned on a stage, so the page
 * opens on real product screens before the first band.
 *
 * @returns The render function producing the hero stage.
 */
export function AppsHeroStage(handle: Handle<AppsHeroStage.Props>) {
	return () => {
		let lang = captureLang(handle.props.locale);
		let wakaba = `/apps/wakaba/screenshots/${lang}`;
		let encore = `/apps/encore/screenshots/${lang}`;
		return (
			<MotionLoop pauseLabel={handle.props.pauseLabel}>
				<div
					role="img"
					aria-label={handle.props.label}
					mix={[
						raw({
							"--phone": "min(12.5rem, 42cqi)",
							position: "relative",
							isolation: "isolate",
							overflow: "visible",
							paddingBlock: "1rem 1.5rem",
							containerType: "inline-size",
							containerName: "apps-hero-stage",
						}),
					]}
				>
					<div mix={[hstack({ gap: 0, align: "start", justify: "center" })]}>
						<div
							mix={[
								raw({
									inlineSize: "var(--phone)",
									flexShrink: "0",
									marginBlockStart: "calc(var(--phone) * 0.12)",
									marginInlineEnd: "calc(var(--phone) * -0.14)",
									scale: "0.9",
									transformOrigin: "100% 0%",
									zIndex: "0",
								}),
								bob("apps-hero-start", "-1.1s", "-0.45rem", "-8deg"),
							]}
						>
							<AppPhone
								bezel="#161412"
								shot={{
									base: `${wakaba}/flashcards-fish`,
									alt: "",
								}}
							/>
						</div>
						<div
							mix={[
								raw({
									inlineSize: "var(--phone)",
									flexShrink: "0",
									zIndex: "1",
									transformOrigin: "50% 100%",
								}),
								bob("apps-hero-front", "-0.3s", "-0.55rem", "-1deg"),
							]}
						>
							<AppPhone
								bezel="#1a0830"
								shot={{
									base: `${encore}/challenge`,
									alt: "",
									eager: true,
								}}
							/>
						</div>
						<div
							mix={[
								raw({
									inlineSize: "var(--phone)",
									flexShrink: "0",
									marginBlockStart: "calc(var(--phone) * 0.12)",
									marginInlineStart: "calc(var(--phone) * -0.14)",
									scale: "0.9",
									transformOrigin: "0% 0%",
									zIndex: "0",
								}),
								bob("apps-hero-end", "-2.6s", "-0.4rem", "8deg"),
							]}
						>
							<AppPhone
								bezel="#161412"
								shot={{
									base: `${wakaba}/path-progress`,
									alt: "",
								}}
							/>
						</div>
					</div>
				</div>
			</MotionLoop>
		);
	};
}

namespace WakabaStage {
	export interface Props {
		locale: string;
		label: string;
		pauseLabel: string;
	}
}

/**
 * Wakaba's band media: the learning path up front, a flashcard and a practice screen
 * fanned behind it, floating together.
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
				pauseLabel={handle.props.pauseLabel}
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
		pauseLabel: string;
	}
}

/**
 * Encore's band media: a revealed challenge up front, the card back and a swipe screen
 * fanned behind it, floating in the app's plum bezel.
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
				pauseLabel={handle.props.pauseLabel}
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

/** Icon rail destinations on the Uptime dashboard mockup, in sidebar order. */
const UPTIME_RAIL = [ActivityIcon, GlobeIcon, BellIcon, ClockIcon, SettingsIcon] as const;

/** Example HTTP monitors drawn like the Uptime landing dashboard. */
const UPTIME_MONITORS = [
	{
		host: "api.example.com/health",
		latency: "184 ms",
		tone: "up" as const,
		bars: [0.55, 0.48, 0.62, 0.44, 0.7, 0.58, 0.5, 0.56, 0.48, 0.64, 0.52, 0.46],
	},
	{
		host: "example.com",
		latency: "101 ms",
		tone: "up" as const,
		bars: [0.35, 0.4, 0.38, 0.72, 0.5, 0.42, 0.36, 0.4, 0.34, 0.38, 0.41, 0.37],
	},
	{
		host: "app.example.com/login",
		latency: "642 ms",
		tone: "degraded" as const,
		bars: [0.38, 0.35, 0.36, 0.34, 0.42, 0.36, 0.35, 0.62, 0.88, 1, 0.94, 0.86],
	},
	{
		host: "cdn.example.com",
		latency: "38 ms",
		tone: "up" as const,
		bars: [0.22, 0.2, 0.18, 0.21, 0.19, 0.17, 0.18, 0.23, 0.2, 0.18, 0.19, 0.18],
	},
] as const;

/** Fill and label for each monitor status tone. */
const UPTIME_STATUS = {
	up: { label: "Up", fill: "var(--ui-success-bg-solid, #16a34a)" },
	degraded: { label: "Degraded", fill: "var(--ui-warning-bg-solid, #ca8a04)" },
} as const;

namespace UptimeStage {
	export interface Props {
		pauseLabel: string;
	}
}

/**
 * Uptime's band media: the landing's dashboard window — icon rail, uptime stats and the
 * HTTP monitors table — floating gently so the product reads as itself.
 *
 * @returns The render function producing the framed window.
 */
export function UptimeStage(handle: Handle<UptimeStage.Props>) {
	return () => (
		<MotionLoop pauseLabel={handle.props.pauseLabel}>
			<div mix={[bob("apps-uptime-window", "-0.8s", "-0.3rem", "0deg")]}>
				<ProductFrame
					lights
					title="Dashboard"
					designWidth="32rem"
					fit="scale"
					role="img"
					aria-label="Uptime dashboard with monitors"
				>
					<div
						aria-hidden="true"
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "2.75rem minmax(0, 1fr)",
								textAlign: "start",
								fontFamily: "var(--ui-font-sans)",
							}),
							text("sm"),
						]}
					>
						<div
							mix={[
								vstack({ gap: 1, align: "center" }),
								p(3, 0),
								raw({ borderInlineEnd: HAIRLINE }),
							]}
						>
							{UPTIME_RAIL.map((Icon, index) => (
								<span
									key={index}
									mix={[
										hstack({ gap: 0, align: "center", justify: "center" }),
										is("1.75rem"),
										bs("1.75rem"),
										raw({ borderRadius: "0.375rem" }),
										index === 0 ? [bg("brand.tint"), fg("brand")] : fg("neutral.muted"),
									]}
								>
									<Icon size={16} strokeWidth={1.5} />
								</span>
							))}
						</div>
						<div mix={[vstack({ gap: 3, align: "stretch" }), p(4), raw({ minInlineSize: "0" })]}>
							<div mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
								<span mix={[text("lg"), weight("semibold"), fg("neutral.emphasis")]}>
									Dashboard
								</span>
								<span
									mix={[
										p(1.5, 3),
										text("xs"),
										weight("medium"),
										raw({
											flexShrink: "0",
											borderRadius: "0.375rem",
											color: "var(--ui-brand-fg-on-solid, white)",
											backgroundColor: "var(--ui-brand-bg-solid)",
										}),
									]}
								>
									Add monitor
								</span>
							</div>
							<div mix={[hstack({ gap: 3, align: "stretch" })]}>
								<UptimeStat label="Uptime" value="99.97%" />
								<UptimeStat label="HTTP monitors" value="12" />
							</div>
							<div
								mix={[
									vstack({ gap: 0, align: "stretch" }),
									raw({
										borderRadius: "0.5rem",
										border: HAIRLINE,
										backgroundColor: "var(--ui-surface-raised, Canvas)",
										overflow: "hidden",
									}),
								]}
							>
								<span
									mix={[
										hstack({ gap: 3, align: "center", justify: "between" }),
										p(2.5, 3.5),
										raw({ borderBlockEnd: HAIRLINE }),
									]}
								>
									<span mix={[weight("medium"), fg("neutral.emphasis")]}>HTTP</span>
								</span>
								{UPTIME_MONITORS.map((monitor) => (
									<div
										key={monitor.host}
										mix={[
											raw({
												display: "grid",
												gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr) auto",
												gap: "0.75rem",
												alignItems: "center",
												padding: "0.625rem 0.875rem",
												borderBlockStart: HAIRLINE,
											}),
										]}
									>
										<span mix={[raw({ display: "grid", minInlineSize: "0", gap: "0.125rem" })]}>
											<span mix={[font("mono"), text("xs"), truncate(), fg("neutral.emphasis")]}>
												{monitor.host}
											</span>
											<span mix={[text("xs"), fg("neutral.muted")]}>{monitor.latency}</span>
										</span>
										<span
											mix={[
												hstack({ gap: 0.5, align: "end" }),
												raw({ blockSize: "1.5rem", minInlineSize: "0" }),
											]}
										>
											{monitor.bars.map((height, bar) => (
												<span
													key={bar}
													mix={[
														raw({
															flex: "1",
															blockSize: `${Math.max(18, height * 100)}%`,
															borderRadius: "1px",
															backgroundColor:
																monitor.tone === "degraded" && bar > 6
																	? "var(--ui-warning-bg-solid, #ca8a04)"
																	: "var(--ui-brand-bg-solid)",
															opacity: monitor.tone === "degraded" && bar > 6 ? "1" : "0.45",
														}),
													]}
												/>
											))}
										</span>
										<span
											mix={[
												p(0.5, 2),
												text("xs"),
												weight("medium"),
												raw({
													borderRadius: "999px",
													color: "white",
													backgroundColor: UPTIME_STATUS[monitor.tone].fill,
												}),
											]}
										>
											{UPTIME_STATUS[monitor.tone].label}
										</span>
									</div>
								))}
							</div>
						</div>
					</div>
				</ProductFrame>
			</div>
		</MotionLoop>
	);
}

/** One dashboard figure, matching the landing's stat cards. */
function UptimeStat(handle: Handle<{ label: string; value: string }>) {
	return () => (
		<span
			mix={[
				vstack({ gap: 1, align: "start" }),
				p(3),
				raw({
					flex: "1",
					minInlineSize: "0",
					borderRadius: "0.5rem",
					border: HAIRLINE,
					backgroundColor: "var(--ui-surface-raised, Canvas)",
				}),
			]}
		>
			<span mix={[text("xs"), fg("neutral.muted")]}>{handle.props.label}</span>
			<span mix={[text("xl"), weight("semibold"), fg("neutral.emphasis"), font("sans")]}>
				{handle.props.value}
			</span>
		</span>
	);
}

/** Unread posts in the Reader queue mockup, from the same sample account shape as its landing. */
const READER_POSTS = [
	{
		title: "Ferry timetable changes for the winter season",
		feed: "Harbor Daily",
		time: "6m",
	},
	{
		title: "Kettle 4.2: a streaming parser and a smaller install",
		feed: "Kettle releases",
		time: "41m",
	},
	{
		title: "Notes on walking the same route for a year",
		feed: "Field Notes",
		time: "2h",
	},
	{
		title: "Council approves the harbour footbridge",
		feed: "City Desk",
		time: "3h",
	},
] as const;

/** Sidebar feeds shown under the queue entries. */
const READER_FEEDS = [
	{ title: "Field Notes", count: 2 },
	{ title: "Harbor Daily", count: 9 },
	{ title: "City Desk", count: 4 },
] as const;

namespace ReaderStage {
	export interface Props {
		pauseLabel: string;
	}
}

/**
 * Reader's band media: the landing's reading window — sidebar, unread queue and waiting
 * strip — floating the other way from Uptime so the two web bands stay distinct.
 *
 * @returns The render function producing the framed window.
 */
export function ReaderStage(handle: Handle<ReaderStage.Props>) {
	return () => (
		<MotionLoop pauseLabel={handle.props.pauseLabel}>
			<div mix={[bob("apps-reader-window", "-2.1s", "-0.3rem", "0deg")]}>
				<ProductFrame
					lights
					title="Reading"
					url="reader.sergiodxa.com/reading"
					designWidth="32rem"
					fit="scale"
					role="img"
					aria-label="Reader unread queue"
				>
					<div
						aria-hidden="true"
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "11.5rem minmax(0, 1fr)",
								textAlign: "start",
								fontSize: "0.8125rem",
								lineHeight: "1.25rem",
								fontFamily: "var(--ui-font-sans)",
								minBlockSize: "18rem",
							}),
						]}
					>
						<div
							mix={[
								vstack({ gap: 0.5, align: "stretch" }),
								p(3),
								raw({ borderInlineEnd: HAIRLINE, backgroundColor: "var(--ui-neutral-bg-tint)" }),
							]}
						>
							<span
								mix={[
									hstack({ gap: 2, align: "center" }),
									p(1.5, 2),
									raw({
										borderRadius: "0.375rem",
										border: HAIRLINE,
										color: "var(--ui-neutral-fg-muted)",
										backgroundColor: "var(--ui-surface-raised, Canvas)",
									}),
								]}
							>
								<SearchIcon size={13} strokeWidth={1.5} />
								<span mix={[text("xs")]}>Search</span>
							</span>
							<ReaderRailEntry icon={<InboxIcon size={14} />} label="Reading" count={16} current />
							<ReaderRailEntry icon={<BookmarkIcon size={14} />} label="Saved" count={3} />
							<span
								mix={[
									raw({
										marginBlockStart: "0.75rem",
										paddingInline: "0.5rem",
										fontSize: "0.6875rem",
										fontWeight: "600",
										letterSpacing: "0.04em",
										textTransform: "uppercase",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								Feeds
							</span>
							{READER_FEEDS.map((feed) => (
								<ReaderRailEntry
									key={feed.title}
									icon={<RssIcon size={14} />}
									label={feed.title}
									count={feed.count}
								/>
							))}
						</div>
						<div mix={[vstack({ gap: 3, align: "stretch" }), p(4), raw({ minInlineSize: "0" })]}>
							<div mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
								<span mix={[text("lg"), weight("semibold"), fg("neutral.emphasis")]}>Reading</span>
								<span mix={[hstack({ gap: 1, align: "center" })]}>
									<span
										mix={[
											p(1, 2),
											text("xs"),
											raw({
												borderRadius: "0.375rem",
												color: "var(--ui-neutral-fg-muted)",
											}),
										]}
									>
										All
									</span>
									<span
										mix={[
											p(1, 2),
											text("xs"),
											weight("medium"),
											raw({
												borderRadius: "0.375rem",
												backgroundColor: "var(--ui-neutral-bg-tint-hover)",
												color: "var(--ui-neutral-fg-emphasis)",
											}),
										]}
									>
										Unread
									</span>
								</span>
							</div>
							<p
								mix={[
									raw({
										margin: "0",
										padding: "0.5rem 0.75rem",
										borderRadius: "0.375rem",
										fontSize: "0.75rem",
										color: "var(--ui-brand-fg-emphasis)",
										backgroundColor: "var(--ui-brand-bg-tint)",
									}),
									pulse("apps-reader-waiting", "-0.6s"),
								]}
							>
								2 feeds still arriving
							</p>
							<div mix={[vstack({ gap: 0, align: "stretch" })]}>
								{READER_POSTS.map((post) => (
									<div
										key={post.title}
										mix={[
											vstack({ gap: 1, align: "start" }),
											p(3, 0),
											raw({ borderBlockStart: HAIRLINE, minInlineSize: "0" }),
										]}
									>
										<span
											mix={[
												weight("medium"),
												fg("neutral.emphasis"),
												raw({
													overflow: "hidden",
													textOverflow: "ellipsis",
													display: "-webkit-box",
													WebkitLineClamp: "2",
													WebkitBoxOrient: "vertical",
												}),
											]}
										>
											{post.title}
										</span>
										<span
											mix={[
												hstack({ gap: 2, align: "center" }),
												text("xs"),
												fg("neutral.muted"),
												raw({ minInlineSize: "0" }),
											]}
										>
											<span mix={[truncate()]}>{post.feed}</span>
											<span aria-hidden="true">·</span>
											<span>{post.time}</span>
										</span>
									</div>
								))}
							</div>
						</div>
					</div>
				</ProductFrame>
			</div>
		</MotionLoop>
	);
}

namespace ReaderRailEntry {
	export interface Props {
		icon: RemixNode;
		label: string;
		count?: number;
		current?: boolean;
	}
}

/** One Reader sidebar row: icon, name and unread count. */
function ReaderRailEntry(handle: Handle<ReaderRailEntry.Props>) {
	return () => {
		let { count, current = false, icon, label } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						padding: "0.3125rem 0.5rem",
						borderRadius: "0.375rem",
						minInlineSize: "0",
						color: current ? "var(--ui-neutral-fg-emphasis)" : "var(--ui-neutral-fg)",
						backgroundColor: current ? "var(--ui-neutral-bg-tint-hover)" : "transparent",
						fontWeight: current ? "600" : "400",
					}),
				]}
			>
				<span mix={[raw({ display: "inline-flex", color: "var(--ui-neutral-fg-muted)" })]}>
					{icon}
				</span>
				<span
					mix={[
						raw({
							flex: "1",
							minInlineSize: "0",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}),
					]}
				>
					{label}
				</span>
				{count ? (
					<span
						mix={[
							raw({
								fontVariantNumeric: "tabular-nums",
								fontSize: "0.75rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{count}
					</span>
				) : null}
			</div>
		);
	};
}
