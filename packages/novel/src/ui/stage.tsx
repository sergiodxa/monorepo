/**
 * The stage: a 16:9 surface scaled with container query units and letterboxed in whatever box
 * holds it, with the background, the full-screen image and the characters drawn as `<img>`
 * layers. Scenery changes animate as View Transitions and characters through CSS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { Letterbox } from "@sdxc/ui";
import { createMixin, css, on } from "remix/component";

import type { FrameCharacter, FrameStage, StageScenery } from "../stage.js";

import { INTERACTIVE } from "./controls.js";
import { columnOf } from "./layout.js";
import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { resolveSource } from "./source.js";
import { themeVar } from "./theme.js";
import { BUILT_IN_TRANSITIONS, prefersReducedMotion } from "./transitions.js";

/** The stage before the play's first frame: no scenery and nobody on it. */
const EMPTY_STAGE: FrameStage = { background: null, image: null, characters: [] };

/** How long a replaced sprite takes to fade out while its character crossfades expressions. */
const SPRITE_OUT_MS = 250;

/**
 * Fades a replaced sprite out before it leaves the DOM while its character crossfades with
 * `fade`. Skip mode and reduced motion remove it at once.
 */
const fadeOnRemove = createMixin<HTMLElement>(
	(handle) => {
		let node: HTMLElement | undefined;
		handle.addEventListener("insert", (event) => {
			node = event.node;
		});
		handle.addEventListener("beforeRemove", (event) => {
			let element = node;
			if (element === undefined) return;
			if (element.closest('[data-instant="true"]') !== null || prefersReducedMotion()) return;
			if (element.closest('[data-transition="fade"]:not([data-exiting="true"])') === null) return;
			event.persistNode(async (signal) => {
				if (signal.aborted) return;
				let animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
					duration: SPRITE_OUT_MS,
					fill: "forwards",
				});
				signal.addEventListener("abort", () => animation.cancel(), { once: true });
				await animation.finished.catch(() => undefined);
			});
		});
		return () => handle.element;
	},
	{ ssr: false },
);

export namespace Stage {
	/** Props {@link Stage} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/**
		 * A stage to draw still, such as a save's thumbnail or a title screen's backdrop. Without
		 * it the stage draws the player's frame, and a click or tap on it advances the play.
		 */
		stage?: FrameStage;
		/** The locale that picks a localized image's file; the reader's locale by default. */
		locale?: string;
		/**
		 * Enlarges and raises the speaker and dims everyone else while two or more characters stand
		 * on stage and one of them speaks.
		 *
		 * @default true
		 */
		focus?: boolean;
		/**
		 * Names the scenery layers for View Transitions; a thumbnail turns it off so its layers never
		 * share a name with the play's.
		 *
		 * @default true
		 */
		transitions?: boolean;
		/** Ends every transition at once; inside a player it follows skip mode and rollback. */
		instant?: boolean;
		/** Drawn on the surface above the characters: the textbox, a menu, an interaction. */
		children?: RemixNode;
	}

	/** Props {@link Scenery} accepts. */
	export interface SceneryProps {
		layer: "background" | "image";
		scenery: StageScenery | null;
		locale: string;
		/** The layer's unique View Transition name, or `undefined` for a thumbnail. */
		name: string | undefined;
	}

	/** Props {@link CharacterSprite} accepts. */
	export interface CharacterProps {
		character: FrameCharacter;
		locale: string;
		/**
		 * Draws the character leaving with `character.transition` as its exit: `fade` fades out,
		 * `slide` slides toward the nearer edge, and a custom name is a class the app animates.
		 *
		 * @default false
		 */
		exiting?: boolean;
	}
}

/**
 * Draws a stage on a 16:9 `Letterbox` surface that keeps its ratio inside any box, so the same
 * component draws a full-screen play and a save slot's thumbnail, and text on it can size in
 * `cqh` to scale with the stage. Drawing the play, it also shows the ending and any error.
 *
 * @example <NovelPlayer.Stage><NovelPlayer.Textbox /></NovelPlayer.Stage>
 * @example <Stage stage={stillStage(save.stage)} transitions={false} />
 */
export function Stage(handle: Handle<Stage.Props>) {
	let prefix = `novel-${handle.id.replace(/[^\w-]/g, "-")}`;
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	return () => {
		let {
			stage: still,
			locale = intl(handle).locale,
			focus = true,
			transitions = true,
			instant: instantProp,
			children,
			mix,
			...rest
		} = handle.props;
		let playing = still === undefined ? player : undefined;
		let stage = still ?? playing?.stage ?? EMPTY_STAGE;
		let instant = instantProp ?? playing?.instant ?? false;
		let focused =
			focus &&
			stage.characters.length >= 2 &&
			stage.characters.some((character) => character.speaking);
		return (
			<Letterbox
				{...rest}
				ratio={16 / 9}
				data-novel-stage=""
				data-instant={String(instant)}
				mix={[
					css({
						"--ui-letterbox-bars": themeVar("--novel-letterbox"),
						"@keyframes novel-in": { from: { opacity: 0 }, to: { opacity: 1 } },
						"@keyframes novel-out": { from: { opacity: 1 }, to: { opacity: 0 } },
						"@keyframes novel-in-late": { "0%, 50%": { opacity: 0 }, "100%": { opacity: 1 } },
						"@keyframes novel-out-early": { "0%": { opacity: 1 }, "50%, 100%": { opacity: 0 } },
						"@keyframes novel-hold": { from: { opacity: 1 }, to: { opacity: 1 } },
						"@keyframes novel-gone": { from: { opacity: 0 }, to: { opacity: 0 } },
						"@keyframes novel-character-out": { to: { opacity: 0 } },
						"@keyframes novel-character-slide-out": {
							to: { opacity: 0, translate: "var(--novel-slide-from) 0" },
						},
						"@keyframes novel-from-right": { from: { translate: "100% 0" } },
						"@keyframes novel-from-left": { from: { translate: "-100% 0" } },
						"@keyframes novel-from-below": { from: { translate: "0 100%" } },
						"@keyframes novel-from-above": { from: { translate: "0 -100%" } },
						"@keyframes novel-to-left": { to: { translate: "-100% 0" } },
						"@keyframes novel-to-right": { to: { translate: "100% 0" } },
						"@keyframes novel-to-top": { to: { translate: "0 -100%" } },
						"@keyframes novel-to-bottom": { to: { translate: "0 100%" } },
						"@keyframes novel-wipe": {
							from: { clipPath: "inset(0 100% 0 0)" },
							to: { clipPath: "inset(0 0 0 0)" },
						},
						"@keyframes novel-zoom": {
							from: { opacity: 0, scale: "1.15" },
							to: { opacity: 1, scale: "1" },
						},
						"@keyframes novel-flash-out": {
							"0%": { filter: "brightness(1)", opacity: 1 },
							"50%": { filter: "brightness(6)", opacity: 1 },
							"51%, 100%": { opacity: 0 },
						},
						"@keyframes novel-flash-in": {
							"0%, 49%": { opacity: 0 },
							"50%": { filter: "brightness(6)", opacity: 1 },
							"100%": { filter: "brightness(1)", opacity: 1 },
						},
						"@keyframes novel-shake": {
							"0%, 100%": { translate: "0 0" },
							"20%": { translate: "-2% 0" },
							"40%": { translate: "2% 0" },
							"60%": { translate: "-1.5% 0" },
							"80%": { translate: "1.5% 0" },
						},
						":root:has(&):active-view-transition-type(novel-stage)::view-transition-old(root), :root:has(&):active-view-transition-type(novel-stage)::view-transition-new(root)":
							{ animation: "none" },
						":root:has(&)::view-transition-image-pair(*.novel-scenery)": { overflow: "clip" },
						":root:has(&)::view-transition-old(*.novel-scenery), :root:has(&)::view-transition-new(*.novel-scenery)":
							{
								animationDuration: themeVar("--novel-transition-duration"),
								animationTimingFunction: themeVar("--novel-transition-easing"),
								animationFillMode: "both",
								mixBlendMode: "normal",
							},
						":root:has(&):active-view-transition-type(novel-fade)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-out-early" },
						":root:has(&):active-view-transition-type(novel-fade)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-in-late" },
						":root:has(&):active-view-transition-type(novel-dissolve)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-out" },
						":root:has(&):active-view-transition-type(novel-dissolve)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-in" },
						":root:has(&):active-view-transition-type(novel-slide-left)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-to-left" },
						":root:has(&):active-view-transition-type(novel-slide-left)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-from-right" },
						":root:has(&):active-view-transition-type(novel-slide-right)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-to-right" },
						":root:has(&):active-view-transition-type(novel-slide-right)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-from-left" },
						":root:has(&):active-view-transition-type(novel-slide-up)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-to-top" },
						":root:has(&):active-view-transition-type(novel-slide-up)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-from-below" },
						":root:has(&):active-view-transition-type(novel-slide-down)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-to-bottom" },
						":root:has(&):active-view-transition-type(novel-slide-down)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-from-above" },
						":root:has(&):active-view-transition-type(novel-wipe)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-hold" },
						":root:has(&):active-view-transition-type(novel-wipe)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-wipe" },
						":root:has(&):active-view-transition-type(novel-zoom)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-out" },
						":root:has(&):active-view-transition-type(novel-zoom)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-zoom" },
						":root:has(&):active-view-transition-type(novel-flash)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-flash-out" },
						":root:has(&):active-view-transition-type(novel-flash)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-flash-in" },
						":root:has(&):active-view-transition-type(novel-shake)::view-transition-old(*.novel-scenery)":
							{ animationName: "novel-gone" },
						":root:has(&):active-view-transition-type(novel-shake)::view-transition-new(*.novel-scenery)":
							{ animationName: "novel-shake" },
					}),
					playing === undefined ? undefined : playerStage(playing),
					mix,
				]}
			>
				<Letterbox.Surface
					data-novel-surface=""
					data-focus={focused ? "on" : "off"}
					mix={css({
						containerName: "novel-stage",
						background: themeVar("--novel-stage-background"),
					})}
				>
					<Scenery
						layer="background"
						scenery={stage.background}
						locale={locale}
						name={transitions ? `${prefix}-background` : undefined}
					/>
					{stage.characters.map((character) => (
						<CharacterSprite key={character.id} character={character} locale={locale} />
					))}
					{(stage.exits ?? []).map((character) => (
						<CharacterSprite
							key={character.id}
							character={{ ...character, speaking: false }}
							locale={locale}
							exiting
						/>
					))}
					<Scenery
						layer="image"
						scenery={stage.image}
						locale={locale}
						name={transitions ? `${prefix}-image` : undefined}
					/>
					{children}
					{playing === undefined ? null : <Outcome player={playing} />}
				</Letterbox.Surface>
			</Letterbox>
		);
	};
}

/**
 * What the stage adds while it draws a play: a click or tap advances, or brings a hidden
 * interface back, except on the interface's own controls.
 */
function playerStage(player: NovelPlayer.Context) {
	return [
		css({ cursor: "pointer", userSelect: "none" }),
		on<HTMLElement, "click">("click", (event) => {
			if ((event.target as Element).closest(INTERACTIVE) !== null) return;
			if (player.hidden) player.hide(false);
			else player.advance();
		}),
	];
}

/** Props {@link Outcome} accepts. */
interface OutcomeProps {
	player: NovelPlayer.Context;
}

/**
 * Once the play finishes, the ending's name (when it has one) over a dimmed stage with a button
 * that plays again from the start; and an alert with the play's error, offering a retry when
 * the error stopped the play before its first stop.
 */
function Outcome(handle: Handle<OutcomeProps>) {
	return () => {
		let { player } = handle.props;
		let ending = player.ending;
		let error = player.error;
		return (
			<>
				{ending === undefined || player.replaying ? null : (
					<div
						data-novel-ui=""
						data-novel-outcome=""
						mix={css({
							position: "absolute",
							inset: 0,
							display: "grid",
							placeContent: "center",
							justifyItems: "center",
							gap: "4cqh",
							background: themeVar("--novel-ending-background"),
							zIndex: 6,
						})}
					>
						{ending.key === null ? null : (
							<p
								data-novel-ending=""
								mix={css({ margin: 0, fontSize: themeVar("--novel-ending-size") })}
							>
								<Message i18nKey={ending.key} />
							</p>
						)}
						<button
							type="button"
							data-novel-play-again=""
							mix={[
								css({
									padding: "1cqh 3cqw",
									font: "inherit",
									fontSize: "2.6cqh",
									color: themeVar("--novel-ending-button-color"),
									background: themeVar("--novel-ending-button-background"),
									border: themeVar("--novel-ending-button-border"),
									borderRadius: "0.6cqh",
									cursor: "pointer",
								}),
								on("click", () => void player.restart()),
							]}
						>
							{player.labels.playAgain}
						</button>
					</div>
				)}
				{error === undefined ? null : (
					<div
						role="alert"
						data-novel-ui=""
						data-novel-error={error.code}
						mix={css({
							position: "absolute",
							insetBlockStart: "3cqh",
							insetInline: "20cqw",
							padding: "1.5cqh 2cqw",
							borderRadius: "1cqh",
							background: themeVar("--novel-error-background"),
							fontSize: "2.4cqh",
							zIndex: 7,
						})}
					>
						<p mix={css({ margin: 0 })}>{error.message}</p>
						{player.stalled ? (
							<button type="button" mix={on("click", () => player.retry())}>
								{player.labels.retry}
							</button>
						) : null}
					</div>
				)}
			</>
		);
	};
}

/**
 * A background or full-screen image layer. It stays mounted while empty so a View Transition
 * can animate the scenery in and out; a custom transition's name is the image's class. A Blob
 * file renders without `src` on a server, and hydration sets its object URL.
 */
export function Scenery(handle: Handle<Stage.SceneryProps>) {
	return () => {
		let { layer, scenery, locale, name } = handle.props;
		let custom =
			scenery?.transition !== undefined && !BUILT_IN_TRANSITIONS.has(scenery.transition)
				? scenery.transition
				: undefined;
		return (
			<div
				data-novel-layer={layer}
				style={
					name === undefined
						? undefined
						: { viewTransitionName: name, viewTransitionClass: "novel-scenery" }
				}
				mix={css({
					position: "absolute",
					inset: 0,
					pointerEvents: "none",
					zIndex: layer === "image" ? 2 : 0,
				})}
			>
				{scenery === null ? null : (
					<img
						key={scenery.id}
						alt=""
						src={resolveSource(scenery.src, locale) || undefined}
						class={custom}
						data-id={scenery.id}
						data-transition={scenery.transition}
						mix={css({
							inlineSize: "100%",
							blockSize: "100%",
							objectFit: "cover",
							display: "block",
						})}
					/>
				)}
			</div>
		);
	};
}

/**
 * A character standing in its column: sprites or layers stacked as `<img>` elements, bottom
 * aligned and never wider than the column. `data-speaking` carries speaker focus, a leaving
 * character carries `data-exiting`, and a custom transition's name is the element's class.
 */
export function CharacterSprite(handle: Handle<Stage.CharacterProps>) {
	return () => {
		let { character, locale, exiting = false } = handle.props;
		let column = columnOf(character.at);
		let custom =
			character.transition !== undefined &&
			character.transition !== "fade" &&
			character.transition !== "slide"
				? character.transition
				: undefined;
		return (
			<div
				data-novel-character=""
				data-id={character.id}
				data-speaking={String(character.speaking)}
				data-transition={character.transition}
				data-exiting={exiting ? "true" : undefined}
				aria-hidden={exiting ? "true" : undefined}
				class={custom}
				style={{
					left: column.left,
					width: column.width,
					"--novel-slide-from": column.leftSide ? "-30%" : "30%",
				}}
				mix={[
					css({
						position: "absolute",
						bottom: 0,
						blockSize: themeVar("--novel-character-height"),
						zIndex: 1,
						transformOrigin: "50% 100%",
						pointerEvents: "none",
						"--novel-focus-transition": `transform ${themeVar("--novel-focus-duration")} ease, filter ${themeVar("--novel-focus-duration")} ease`,
						"--novel-move": `${themeVar("--novel-character-duration")} ${themeVar("--novel-character-easing")}`,
						transition: "var(--novel-focus-transition)",
						'[data-focus="on"] &[data-speaking="true"]': {
							transform: `translateY(calc(-1 * ${themeVar("--novel-focus-lift")})) scale(${themeVar("--novel-focus-scale")})`,
							filter: themeVar("--novel-focus-filter"),
							zIndex: 2,
						},
						'[data-focus="on"] &[data-speaking="false"]': {
							filter: themeVar("--novel-dim-filter"),
						},
						'&[data-transition="fade"]': {
							transition: "var(--novel-focus-transition), opacity var(--novel-move)",
							"@starting-style": { opacity: 0 },
						},
						'&[data-transition="slide"]': {
							transition:
								"var(--novel-focus-transition), left var(--novel-move), translate var(--novel-move), opacity var(--novel-move)",
							"@starting-style": { opacity: 0, translate: "var(--novel-slide-from) 0" },
						},
						'&[data-exiting="true"]': { zIndex: 0 },
						'&[data-exiting="true"]:not([data-transition])': { visibility: "hidden" },
						'&[data-exiting="true"][data-transition="fade"]': {
							animation: "novel-character-out var(--novel-move) forwards",
						},
						'&[data-exiting="true"][data-transition="slide"]': {
							animation: "novel-character-slide-out var(--novel-move) forwards",
						},
						'[data-instant="true"] &': { transition: "none" },
						'[data-instant="true"] &[data-exiting="true"]': {
							animation: "none",
							visibility: "hidden",
						},
						"@media (prefers-reduced-motion: reduce)": {
							transition: "none",
							'&[data-exiting="true"]': { animation: "none", visibility: "hidden" },
						},
					}),
				]}
			>
				{character.images.map((source, index) => {
					let url = resolveSource(source, locale);
					return (
						<img
							key={url || `file-${index}`}
							alt=""
							src={url || undefined}
							mix={[
								fadeOnRemove(),
								css({
									position: "absolute",
									inset: 0,
									inlineSize: "100%",
									blockSize: "100%",
									objectFit: "contain",
									objectPosition: "50% 100%",
									'[data-transition="fade"] &': {
										transition: "opacity 400ms ease",
										"@starting-style": { opacity: 0 },
									},
									'[data-instant="true"] &': { transition: "none" },
									"@media (prefers-reduced-motion: reduce)": { transition: "none" },
								}),
							]}
						/>
					);
				})}
			</div>
		);
	};
}
