/**
 * The stage: a 16:9 surface scaled with container query units and letterboxed in whatever box
 * holds it, with the background, the full-screen image and the characters drawn as `<img>`
 * layers. Scenery changes animate as View Transitions and characters through CSS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { createMixin, css } from "remix/component";

import type { FrameCharacter, FrameStage, StageScenery } from "../stage.js";

import { columnOf } from "./layout.js";
import { resolveSource } from "./source.js";
import { BUILT_IN_TRANSITIONS, prefersReducedMotion } from "./transitions.js";

/** How long a removed character or replaced sprite takes to fade out. */
const EXIT_MS = 250;

/**
 * Fades an element out before it leaves the DOM: a character always, and a sprite only while its
 * character crossfades expressions. Skip mode and reduced motion remove it at once.
 */
const fadeOnRemove = createMixin<HTMLElement, [scope: "character" | "sprite"]>(
	(handle) => {
		let node: HTMLElement | undefined;
		let scope: "character" | "sprite" = "character";
		handle.addEventListener("insert", (event) => {
			node = event.node;
		});
		handle.addEventListener("beforeRemove", (event) => {
			let element = node;
			if (element === undefined) return;
			if (element.closest('[data-instant="true"]') !== null || prefersReducedMotion()) return;
			if (scope === "sprite" && element.closest('[data-transition="fade"]') === null) return;
			event.persistNode(async (signal) => {
				if (signal.aborted) return;
				let animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
					duration: EXIT_MS,
					fill: "forwards",
				});
				signal.addEventListener("abort", () => animation.cancel(), { once: true });
				await animation.finished.catch(() => undefined);
			});
		});
		return (next) => {
			scope = next;
			return handle.element;
		};
	},
	{ ssr: false },
);

export namespace Stage {
	/** Props {@link Stage} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		stage: FrameStage;
		/** The reader's locale, which picks a localized image's file. */
		locale: string;
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
		/** Ends every transition at once, for skip mode. */
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
	}
}

/**
 * Draws a stage. The surface keeps 16:9 inside any box by sizing itself in container query
 * units, so the same component draws a full-screen play and a save slot's thumbnail, and text on
 * it can size in `cqh` to scale with the stage.
 *
 * @example <Stage stage={frame.stage} locale={locale}><Textbox frame={frame} … /></Stage>
 */
export function Stage(handle: Handle<Stage.Props>) {
	let prefix = `novel-${handle.id.replace(/[^\w-]/g, "-")}`;
	return () => {
		let {
			stage,
			locale,
			focus = true,
			transitions = true,
			instant = false,
			children,
			mix,
			...rest
		} = handle.props;
		let focused =
			focus &&
			stage.characters.length >= 2 &&
			stage.characters.some((character) => character.speaking);
		return (
			<div
				{...rest}
				data-novel-stage=""
				data-instant={String(instant)}
				mix={[
					css({
						position: "relative",
						inlineSize: "100%",
						blockSize: "100%",
						aspectRatio: "16 / 9",
						containerType: "size",
						overflow: "hidden",
						background: "var(--novel-letterbox, #000)",
						"--novel-transition-duration": "600ms",
						"@keyframes novel-in": { from: { opacity: 0 }, to: { opacity: 1 } },
						"@keyframes novel-out": { from: { opacity: 1 }, to: { opacity: 0 } },
						"@keyframes novel-in-late": { "0%, 50%": { opacity: 0 }, "100%": { opacity: 1 } },
						"@keyframes novel-out-early": { "0%": { opacity: 1 }, "50%, 100%": { opacity: 0 } },
						"@keyframes novel-hold": { from: { opacity: 1 }, to: { opacity: 1 } },
						"@keyframes novel-gone": { from: { opacity: 0 }, to: { opacity: 0 } },
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
								animationDuration: "var(--novel-transition-duration, 600ms)",
								animationTimingFunction: "ease",
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
					mix,
				]}
			>
				<div
					data-novel-surface=""
					data-focus={focused ? "on" : "off"}
					mix={css({
						position: "absolute",
						inset: 0,
						margin: "auto",
						inlineSize: "min(100cqw, calc(100cqh * 16 / 9))",
						blockSize: "min(100cqh, calc(100cqw * 9 / 16))",
						containerType: "size",
						containerName: "novel-stage",
						overflow: "clip",
						background: "var(--novel-stage-background, #000)",
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
					<Scenery
						layer="image"
						scenery={stage.image}
						locale={locale}
						name={transitions ? `${prefix}-image` : undefined}
					/>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * A background or full-screen image layer. It stays mounted while empty so a View Transition
 * can animate the scenery in and out; a custom transition's name is the image's class.
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
						src={resolveSource(scenery.src, locale)}
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
 * aligned and never wider than the column. `data-speaking` carries speaker focus, and a custom
 * transition's name is the element's class.
 */
export function CharacterSprite(handle: Handle<Stage.CharacterProps>) {
	return () => {
		let { character, locale } = handle.props;
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
				class={custom}
				style={{
					left: column.left,
					width: column.width,
					"--novel-slide-from": column.leftSide ? "-30%" : "30%",
				}}
				mix={[
					fadeOnRemove("character"),
					css({
						position: "absolute",
						bottom: 0,
						blockSize: "var(--novel-character-height, 95%)",
						zIndex: 1,
						transformOrigin: "50% 100%",
						pointerEvents: "none",
						transition: "transform 200ms ease, filter 200ms ease",
						'[data-focus="on"] &[data-speaking="true"]': { transform: "scale(1.05)", zIndex: 2 },
						'[data-focus="on"] &[data-speaking="false"]': { filter: "brightness(0.6)" },
						'&[data-transition="fade"]': {
							transition: "transform 200ms ease, filter 200ms ease, opacity 400ms ease",
							"@starting-style": { opacity: 0 },
						},
						'&[data-transition="slide"]': {
							transition:
								"transform 200ms ease, filter 200ms ease, left 400ms ease, translate 400ms ease, opacity 400ms ease",
							"@starting-style": { opacity: 0, translate: "var(--novel-slide-from) 0" },
						},
						'[data-instant="true"] &': { transition: "none" },
						"@media (prefers-reduced-motion: reduce)": { transition: "none" },
					}),
				]}
			>
				{character.images.map((source) => {
					let url = resolveSource(source, locale);
					return (
						<img
							key={url}
							alt=""
							src={url}
							mix={[
								fadeOnRemove("sprite"),
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
