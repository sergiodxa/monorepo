/**
 * The overworld scene: walking the map, running events, and wild battles.
 *
 * Authored map events become live entities whose active page decides their
 * graphic, movement, trigger, and script. Party, battle state, and flags stay
 * behind the engine's commands and selectors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CreatureId } from "~/game/world/ids";

import { createBattleId } from "~/game/world/ids";

import type { PresentationSave } from "../core/save";
import type { Scene } from "../core/scene";
import type { EventPage, PageOptions, SpriteRef, TrainerParty } from "../render/map-schema";

import { BattleScene } from "../battle/battle-scene";
import { type Direction, directionDelta, oppositeDirection } from "../core/direction";
import { GameClient } from "../core/game-client";
import { Button } from "../core/input";
import { SCREEN_WIDTH, TILE_SIZE } from "../core/loop";
import { HERO_ID, WILD_ID } from "../core/new-game";
import { type Atlas, drawSprite } from "../render/atlas";
import { Camera } from "../render/camera";
import { GLYPH_ADVANCE } from "../render/font";
import { buildPlaceholderAtlas } from "../render/placeholder-atlas";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { TileMapRenderer } from "../render/tilemap";
import { ChoiceScene } from "../scenes/choice";
import { DialogueScene } from "../scenes/dialogue";
import { MenuScene } from "../scenes/menu";
import { ShopScene } from "../scenes/shop";

import { chooseEncounter, rollEncounter } from "./encounters";
import { createMovementState, type MovementState, tickEventMovement } from "./event-movement";
import {
	type EventEntity,
	eventAt,
	refreshActivePages,
	selfSwitchFlag,
	spawnEvents,
} from "./event-runtime";
import { EventCommandRunner, type EventCommandHost } from "./event-script";
import { createSampleMap, createSampleNpcs, GameMap, SAMPLE_SPAWN } from "./map-loader";
import { facingNpc, type Npc, npcAt } from "./npc";
import { PlayerController } from "./player-controller";

/** Money staked on a trainer fight when the trainer defines no explicit reward. */
const DEFAULT_TRAINER_REWARD = 500;

/** Left inset (px) the HUD hint is drawn at, reserved on both sides for symmetry. */
const HUD_HINT_MARGIN = 4;

/** Milliseconds one `wait` frame stands for when a script pauses. */
const WAIT_FRAME_MS = 1000 / 60;

/**
 * The essential HUD hint, kept short enough to fit any sane screen width.
 *
 * `overworldHint` falls back to this when no fuller variant fits, so it teaches
 * only the two actions a hint is needed for: talk and menu.
 */
const HUD_HINT_ESSENTIAL = "A: talk   Start: menu";

/** The HUD hint variants from fullest to the essential fallback. */
const HUD_HINT_VARIANTS = [
	"Grass: wild battles   A: talk   Start: menu",
	"Grass: battles  A: talk  Start: menu",
	HUD_HINT_ESSENTIAL,
] as const;

/** The rendered pixel width of a string at the fixed bitmap font metrics. */
function hintWidth(text: string): number {
	return text.length * GLYPH_ADVANCE;
}

/**
 * Picks the fullest overworld HUD hint that fits within `maxWidth` pixels.
 *
 * Falls back to the shortest essential hint so an oversized hint is never
 * clipped off-screen at the fixed internal resolution.
 */
export function overworldHint(maxWidth: number): string {
	return HUD_HINT_VARIANTS.find((variant) => hintWidth(variant) <= maxWidth) ?? HUD_HINT_ESSENTIAL;
}

/** The usable width for the HUD hint given the internal screen width and margins. */
export function hudHintMaxWidth(): number {
	return SCREEN_WIDTH - HUD_HINT_MARGIN * 2;
}

/** Where the player enters an overworld map. */
export interface Spawn {
	mapId: string;
	x: number;
	y: number;
	facing: Direction;
}

/** Renders and drives the walkable overworld. */
export class OverworldScene implements Scene {
	/** The loaded map wrapper (created on enter). */
	private map!: GameMap;

	/** The map's tile renderer. */
	private renderer!: TileMapRenderer;

	/** The follow camera. */
	private readonly camera = new Camera();

	/** The player actor. */
	private player!: PlayerController;

	/** The interactable NPCs on this map (created on enter). */
	private npcs: Npc[] = [];

	/** The live entities spawned from the map's authored events (created on enter). */
	private events: EventEntity[] = [];

	/** Per-event autonomous-movement bookkeeping, keyed by event id. */
	private readonly movement = new Map<string, MovementState>();

	/** The interaction currently running, or null when the player is free to move. */
	private interaction: {
		/** The event whose active page is running. */
		entity: EventEntity;
		/** The command runner sequencing that page's commands. */
		runner: EventCommandRunner;
	} | null = null;

	/** Frames left on a `wait` command before its runner resumes. */
	private waitFramesLeft = 0;

	/**
	 * The index a `show-choices` picker recorded, consumed when its scene pops.
	 *
	 * `resume()` fires on every scene pop and applies this value to the runner,
	 * keeping one resume path in charge of continuing a parked script.
	 */
	private pendingChoiceIndex: number | null = null;

	/** A warp requested by a running script, applied once the frame settles. */
	private pendingWarp: { mapId: string; x: number; y: number; facing: Direction } | null = null;

	/**
	 * The atlas the world draws actors from, or null to draw procedurally.
	 *
	 * Falls back to a generated atlas when no manifest atlas or DOM is available,
	 * so the scene always has something to draw actors from.
	 */
	private atlas: Atlas | null = null;

	/** Milliseconds since enter, driving the character walk-cycle frame. */
	private elapsed = 0;

	/** Monotonic counter making each battle id unique. */
	private battleCount = 0;

	/** @param spawn - Where to place the player when the scene enters. */
	constructor(private readonly spawn: Spawn = SAMPLE_SPAWN) {}

	/**
	 * Loads the map, spawns its events and sample NPCs, and starts any autorun event.
	 *
	 * The sample trainer NPC fields mid-pool species so its party differs from the
	 * starter the player begins with.
	 */
	enter(game: GameClient) {
		let data = game.assets.map(this.spawn.mapId) ?? createSampleMap();
		this.map = new GameMap(data);
		this.atlas = game.assets.atlas("overworld") ?? buildPlaceholderAtlas();
		this.renderer = new TileMapRenderer(data, (imageId) => game.assets.image(imageId), this.atlas);
		this.player = new PlayerController(this.spawn.x, this.spawn.y, this.spawn.facing);
		let speciesIds = Object.keys(game.content.species);
		let first = speciesIds[Math.min(3, speciesIds.length - 1)] ?? speciesIds[0] ?? "";
		let second = speciesIds[Math.min(4, speciesIds.length - 1)] ?? first;
		this.npcs = createSampleNpcs([first, second]);

		this.events = spawnEvents(this.spawn.mapId, this.map.events, (flag) =>
			game.engine.selectFlag(flag),
		);
		this.movement.clear();
		for (let entity of this.events) this.movement.set(entity.id, createMovementState());

		game.audio.playBgm(data.bgm);
		this.runEntryEvents(game);
	}

	exit() {}

	/**
	 * Continues a script parked on a pushed scene once that scene pops back here.
	 *
	 * Only a `show-choices` picker reads the resumed argument, so forwarding a
	 * null pick as undefined is a no-op for every other blocking command.
	 */
	resume() {
		if (this.interaction?.runner.blocked && this.waitFramesLeft <= 0) {
			let index = this.pendingChoiceIndex;
			this.pendingChoiceIndex = null;
			this.interaction.runner.resume(index ?? undefined);
		}
	}

	/**
	 * Advances the overworld one frame: movement, interactions, and encounters.
	 *
	 * A running interaction freezes the overworld while its pushed scenes drive
	 * it, so this only counts down a `wait` and settles once the script finishes.
	 */
	update(game: GameClient, dt: number) {
		this.elapsed += dt;

		if (this.interaction) {
			this.tickWait(dt);
			this.settleInteraction(game);
			return;
		}

		if (!this.player.moving && game.input.isPressed(Button.Start)) {
			game.scenes.push(new MenuScene(this.snapshotState()));
			return;
		}

		if (!this.player.moving && game.input.isPressed(Button.A)) {
			let delta = directionDelta(this.player.facing);
			let event = eventAt(
				this.events,
				this.player.tile.x + delta.dx,
				this.player.tile.y + delta.dy,
			);
			if (event && this.triggerOf(event) === "action") {
				this.startInteraction(game, event);
				return;
			}
			let target = facingNpc(this.npcs, {
				x: this.player.tile.x,
				y: this.player.tile.y,
				facing: this.player.facing,
			});
			if (target) {
				this.interact(game, target);
				return;
			}
		}

		for (let entity of this.events) {
			let page = entity.page;
			let state = this.movement.get(entity.id);
			if (!page || !state) continue;
			tickEventMovement(
				entity,
				state,
				page.autonomousMovement,
				page.options as PageOptions,
				dt,
				(x, y) => this.actorBlocked(entity, x, y),
				Math.random,
			);
		}

		let { arrived } = this.player.update(game.input, this.map, dt, (x, y) =>
			this.playerBlocked(x, y),
		);
		this.camera.centerOn(
			this.player.pixelX + TILE_SIZE / 2,
			this.player.pixelY + TILE_SIZE / 2,
			this.map.widthPx,
			this.map.heightPx,
		);

		if (arrived) this.checkTouchAndEncounter(game);

		if (!this.interaction) this.runParallelEvents(game);
	}

	/** Counts down an active `wait` and resumes the runner once its frames elapse. */
	private tickWait(dt: number) {
		if (this.waitFramesLeft <= 0) return;
		this.waitFramesLeft -= dt / WAIT_FRAME_MS;
		if (this.waitFramesLeft <= 0) {
			this.waitFramesLeft = 0;
			this.interaction?.runner.resume();
		}
	}

	/**
	 * Fires any touch event the player just reached, else rolls a wild encounter.
	 *
	 * A touch event's script always fires before an encounter can roll, so
	 * stepping onto a trigger tile never also starts a wild battle on arrival.
	 */
	private checkTouchAndEncounter(game: GameClient) {
		let onTile = eventAt(this.events, this.player.tile.x, this.player.tile.y);
		if (onTile && this.triggerOf(onTile) === "player-touch") {
			this.startInteraction(game, onTile);
			return;
		}
		let delta = directionDelta(this.player.facing);
		let ahead = eventAt(this.events, this.player.tile.x + delta.dx, this.player.tile.y + delta.dy);
		if (ahead && this.triggerOf(ahead) === "event-touch") {
			this.startInteraction(game, ahead);
			return;
		}
		this.checkEncounter(game);
	}

	/** The active page's trigger for an entity, or null when the entity is inert. */
	private triggerOf(entity: EventEntity): EventPage["trigger"] | null {
		return entity.page?.trigger ?? null;
	}

	/** True when a sample NPC or a solid event holds the tile, blocking the player. */
	private playerBlocked(x: number, y: number): boolean {
		if (npcAt(this.npcs, x, y) !== null) return true;
		let event = eventAt(this.events, x, y);
		return event !== null && isSolidEvent(event);
	}

	/**
	 * True when a tile is impassable for an autonomous event actor moving off `self`.
	 *
	 * An inert or invisible event lets movement through, same as it does for the
	 * player, so a patrolling NPC can cross a trigger tile.
	 */
	private actorBlocked(self: EventEntity, x: number, y: number): boolean {
		if (this.map.isBlocked(x, y)) return true;
		if (this.player.tile.x === x && this.player.tile.y === y) return true;
		if (npcAt(this.npcs, x, y) !== null) return true;
		let other = eventAt(this.events, x, y);
		return other !== null && other !== self && isSolidEvent(other);
	}

	/** Runs an NPC's behavior when the player interacts with it. */
	private interact(game: GameClient, npc: Npc) {
		switch (npc.role) {
			case "healer":
				game.dispatch({ type: "heal-party", playerId: HERO_ID });
				game.scenes.push(new DialogueScene(["Your team is fully healed!"]));
				break;
			case "shop":
				game.scenes.push(new ShopScene());
				break;
			case "trainer":
				this.startTrainerBattle(game, npc);
				break;
		}
	}

	/** Starts a rebattlable trainer fight against the NPC's freshly spawned party. */
	private startTrainerBattle(game: GameClient, npc: Npc) {
		if (npc.trainer) this.startTrainerFight(game, npc.id, npc.trainer);
	}

	/**
	 * Starts a non-capturable trainer fight against a freshly spawned party.
	 *
	 * The whole party rides on one enemy team, so a faint forces out the next
	 * bench creature until the entire party is down; the fight is inescapable.
	 *
	 * @param idPrefix - Stable prefix making each spawned creature's trainer id unique.
	 * @param trainer - The party, optional name, and optional reward to field.
	 * @returns Whether a battle was actually pushed.
	 */
	private startTrainerFight(game: GameClient, idPrefix: string, trainer: TrainerParty): boolean {
		if (trainer.party.length === 0) return false;
		let playerParty = game.engine.selectParty(HERO_ID).creatures.map((creature) => creature.id);
		if (playerParty.length === 0) return false;

		let battleNumber = this.battleCount++;
		let enemyParty: CreatureId[] = [];
		for (let [index, member] of trainer.party.entries()) {
			let spawned = game.dispatch({
				type: "spawn-trainer-creature",
				trainerId: `${idPrefix}-${battleNumber}-${index}`,
				speciesId: member.speciesId,
				level: member.level,
			});
			let creature = spawned.find((event) => event.type === "trainer-creature-spawned");
			if (creature?.type !== "trainer-creature-spawned") return false;
			enemyParty.push(creature.creatureId);
		}

		let reward = trainer.reward ?? DEFAULT_TRAINER_REWARD;
		let battleId = createBattleId(`trainer-${battleNumber}`);
		game.dispatch({
			type: "start-battle",
			battleId,
			playerId: HERO_ID,
			enemyId: WILD_ID,
			playerParty,
			enemyParty,
			slots: 1,
			canLeaveBattle: false,
		});
		game.scenes.push(
			new BattleScene(battleId, {
				canCapture: false,
				reward: { playerId: HERO_ID, winReward: reward, lossPenalty: Math.floor(reward / 2) },
				...(trainer.name ? { trainerName: trainer.name } : {}),
			}),
		);
		return true;
	}

	/**
	 * Starts a fixed (often legendary) wild battle from a `wild-encounter` command.
	 *
	 * Spawns one wild creature from the command's authored species and level, and
	 * pushes a normal capturable battle so the player can catch it.
	 *
	 * @returns Whether the battle was pushed, so the caller can settle the event.
	 */
	private startWildEncounter(
		game: GameClient,
		idPrefix: string,
		speciesId: string,
		level: number,
	): boolean {
		let playerParty = game.engine.selectParty(HERO_ID).creatures.map((creature) => creature.id);
		if (playerParty.length === 0) return false;

		let encounterId = `${idPrefix}-${this.battleCount}`;
		let spawned = game.dispatch({ type: "spawn-encounter", encounterId, speciesId, level });
		let creature = spawned.find((event) => event.type === "encounter-spawned");
		if (creature?.type !== "encounter-spawned") return false;

		game.audio.playSynthSfx("encounter");
		let battleId = createBattleId(`wild-${this.battleCount++}`);
		game.dispatch({
			type: "start-battle",
			battleId,
			playerId: HERO_ID,
			enemyId: WILD_ID,
			playerParty,
			enemyParty: [creature.creatureId],
			slots: 1,
		});
		game.scenes.push(new BattleScene(battleId));
		return true;
	}

	/**
	 * Runs the first eligible `autorun` event on map enter.
	 *
	 * A script blocks the overworld and drives its own scenes, so starting more
	 * than one at once would interleave dialogues; the rest wait for a later frame.
	 */
	private runEntryEvents(game: GameClient) {
		if (this.interaction) return;
		for (let entity of this.events) {
			if (this.triggerOf(entity) !== "autorun") continue;
			this.startInteraction(game, entity);
			return;
		}
	}

	/**
	 * Starts the first eligible `parallel` event when the player is free.
	 *
	 * The scene has a single interaction slot, so only one parallel script runs
	 * at a time; authors flip a self-switch inside it to avoid re-firing forever.
	 */
	private runParallelEvents(game: GameClient) {
		for (let entity of this.events) {
			if (this.triggerOf(entity) !== "parallel") continue;
			this.startInteraction(game, entity);
			return;
		}
	}

	/**
	 * Begins an event's interaction: builds a command runner and advances it once.
	 *
	 * The runner parks on the first blocking command and only one interaction runs
	 * at a time, since the overworld stays frozen until it settles.
	 */
	private startInteraction(game: GameClient, entity: EventEntity) {
		if (this.interaction || !entity.page) return;
		let runner = new EventCommandRunner(entity.page.commands, this.buildCommandHost(game, entity), {
			isFlagOn: (flag) => game.engine.selectFlag(flag),
			selfSwitchFlag: (name) => selfSwitchFlag(entity.mapId, entity.id, name),
		});
		this.interaction = { entity, runner };
		runner.advance();
		this.settleInteraction(game);
	}

	/**
	 * Finalizes a running interaction once its script is done.
	 *
	 * Re-selects active pages against current flags once the script finishes, since a
	 * `control-switch` or self-switch inside it may have moved events to new pages.
	 */
	private settleInteraction(game: GameClient) {
		let active = this.interaction;
		if (!active || active.runner.blocked) return;
		if (!active.runner.done) return;

		this.interaction = null;
		this.waitFramesLeft = 0;

		if (this.pendingWarp) {
			let warp = this.pendingWarp;
			this.pendingWarp = null;
			this.warpTo(game, warp);
			return;
		}

		refreshActivePages(this.events, (flag) => game.engine.selectFlag(flag));
	}

	/**
	 * Builds the side-effect surface one event page's commands drive.
	 *
	 * Blocking hooks push the scene the runner parks on and resume it on completion;
	 * every hook forwards the command's authored data through untouched.
	 */
	private buildCommandHost(game: GameClient, entity: EventEntity): EventCommandHost {
		return {
			showText: (text) => game.scenes.push(new DialogueScene([text])),
			showChoices: (prompt, labels) => {
				game.scenes.push(
					new ChoiceScene({
						...(prompt ? { prompt } : {}),
						labels,
						onChoose: (index) => {
							this.pendingChoiceIndex = index;
						},
					}),
				);
			},
			controlSwitch: (flag, value) => game.dispatch({ type: "set-flag", flag, value }),
			controlSelfSwitch: (flag, value) => game.dispatch({ type: "set-flag", flag, value }),
			giveItem: (itemId, count) =>
				game.dispatch({ type: "add-inventory-item", playerId: HERO_ID, itemId, count }),
			healParty: () => game.dispatch({ type: "heal-party", playerId: HERO_ID }),
			facePlayer: () => {
				entity.facing = oppositeDirection(this.player.facing);
			},
			move: (steps) => this.stepEventRoute(entity, steps),
			startTrainerBattle: (trainer) => {
				let started = this.startTrainerFight(game, `${entity.id}-trainer`, trainer);
				if (!started) this.interaction?.runner.resume();
			},
			startWildBattle: (speciesId, level) => {
				let started = this.startWildEncounter(game, entity.id, speciesId, level);
				if (!started) this.interaction?.runner.resume();
			},
			wait: (frames) => {
				this.waitFramesLeft = Math.max(0, frames);
			},
			warp: (map, x, y) => {
				this.pendingWarp = { mapId: map, x, y, facing: this.player.facing };
			},
		};
	}

	/**
	 * Steps an event through an authored route immediately, skipping blocked tiles.
	 *
	 * Each step turns the entity toward its direction and only advances onto a free
	 * tile, so an NPC can walk aside or approach as part of a cutscene.
	 */
	private stepEventRoute(entity: EventEntity, route: readonly Direction[]) {
		for (let direction of route) {
			entity.facing = direction;
			let delta = directionDelta(direction);
			let nextX = entity.x + delta.dx;
			let nextY = entity.y + delta.dy;
			if (!this.actorBlocked(entity, nextX, nextY)) {
				entity.x = nextX;
				entity.y = nextY;
			}
		}
	}

	/**
	 * Reloads the target map at a new position, replacing this scene.
	 *
	 * Re-enters the overworld fresh at the destination tile, and replacing keeps
	 * the scene stack flat as the player travels between maps.
	 */
	private warpTo(
		game: GameClient,
		spawn: { mapId: string; x: number; y: number; facing: Direction },
	) {
		game.scenes.replace(new OverworldScene({ ...spawn }));
	}

	/** Captures the presentation state to persist if the player saves. */
	private snapshotState(): PresentationSave {
		return {
			mapId: this.spawn.mapId,
			x: this.player.tile.x,
			y: this.player.tile.y,
			facing: this.player.facing,
			flags: {},
			variables: {},
			options: { textSpeed: 2, volume: { bgm: 0.7, sfx: 0.8, cries: 0.8 } },
		};
	}

	/**
	 * Draws one frame: ground, actors, the overhead layer, then always-on-top events.
	 *
	 * Draws in this order so the overhead layer sits above every ground actor and
	 * an always-on-top event (a bridge rail, a treetop) still draws above that.
	 */
	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		this.renderer.drawGround(ctx, this.camera);
		for (let npc of this.npcs) this.drawNpc(ctx, npc);
		for (let entity of this.events)
			if (!this.isAlwaysOnTop(entity)) this.drawEvent(game, ctx, entity);
		this.drawPlayer(ctx);
		this.renderer.drawOverhead(ctx, this.camera);
		for (let entity of this.events)
			if (this.isAlwaysOnTop(entity)) this.drawEvent(game, ctx, entity);
		drawText(ctx, overworldHint(hudHintMaxWidth()), HUD_HINT_MARGIN, HUD_HINT_MARGIN, {
			color: theme.TEXT.inverseWhite,
		});
	}

	/** Whether an event's active page asks to draw above the overhead layer. */
	private isAlwaysOnTop(entity: EventEntity): boolean {
		return (entity.page?.options as PageOptions | undefined)?.alwaysOnTop === true;
	}

	/**
	 * Draws one event entity from its active page's graphic, or a placeholder.
	 *
	 * Falls back to a small procedural marker when the art is missing, so an event
	 * stays visible before its real sprite exists.
	 */
	private drawEvent(game: GameClient, ctx: CanvasRenderingContext2D, entity: EventEntity) {
		let graphic = entity.page?.graphic ?? null;
		if (!entity.page || graphic === null) return;
		let x = Math.round(entity.x * TILE_SIZE - this.camera.x);
		let y = Math.round(entity.y * TILE_SIZE - this.camera.y);

		if (this.drawEventSprite(game, ctx, graphic, entity.facing, x, y)) return;

		this.drawProceduralActor(ctx, x, y, theme.NPC_COLOR.trainer);
	}

	/**
	 * Blits an event's graphic ref from the atlas or a raw image, returning success.
	 *
	 * Tries a facing-specific atlas region before the authored region, offsetting
	 * the draw 8px up so the 16px character cell's feet land on the tile.
	 *
	 * @returns False when nothing could be drawn, so the caller can fall back procedurally.
	 */
	private drawEventSprite(
		game: GameClient,
		ctx: CanvasRenderingContext2D,
		sprite: SpriteRef,
		facing: Direction,
		x: number,
		y: number,
	): boolean {
		if (sprite === null) return false;
		if ("atlas" in sprite) {
			let atlas = game.assets.atlas(sprite.atlas) ?? this.atlas;
			if (drawSprite(ctx, atlas, `${sprite.region}.${facing}.0`, x, y - 8)) return true;
			return drawSprite(ctx, atlas, sprite.region, x, y - 8);
		}
		let image = game.assets.image(sprite.image);
		if (!image) return false;
		ctx.drawImage(image, sprite.x, sprite.y, sprite.w, sprite.h, x, y - 8, sprite.w, sprite.h);
		return true;
	}

	/**
	 * Rolls a wild encounter for the tile the player just reached and starts the battle.
	 *
	 * Plays the encounter jingle only once the battle is certain to start, and the
	 * call is a safe no-op when audio is unavailable.
	 */
	private checkEncounter(game: GameClient) {
		let { x, y } = this.player.tile;
		if (!rollEncounter(this.map, x, y, Math.random)) return;

		let playerParty = game.engine.selectParty(HERO_ID).creatures.map((creature) => creature.id);
		if (playerParty.length === 0) return;

		let choice = chooseEncounter(
			this.map.encounterTableAt(x, y),
			Object.keys(game.content.species),
			Math.random,
		);
		if (!choice) return;

		let encounterId = `enc-${this.battleCount}`;
		let spawned = game.dispatch({
			type: "spawn-encounter",
			encounterId,
			speciesId: choice.speciesId,
			level: choice.level,
		});
		let wild = spawned.find((event) => event.type === "encounter-spawned");
		if (wild?.type !== "encounter-spawned") return;

		game.audio.playSynthSfx("encounter");

		let battleId = createBattleId(`wild-${this.battleCount++}`);
		game.dispatch({
			type: "start-battle",
			battleId,
			playerId: HERO_ID,
			enemyId: WILD_ID,
			playerParty,
			enemyParty: [wild.creatureId],
			slots: 1,
		});
		game.scenes.push(new BattleScene(battleId));
	}

	/**
	 * Draws the player from the atlas character region, or procedurally.
	 *
	 * Offsets the draw 8px up so the 16px character cell's feet meet the tile,
	 * falling back to the procedural sprite when the atlas region is missing.
	 */
	private drawPlayer(ctx: CanvasRenderingContext2D) {
		let x = Math.round(this.player.pixelX - this.camera.x);
		let y = Math.round(this.player.pixelY - this.camera.y);

		let frame = this.player.moving && Math.floor(this.elapsed / 180) % 2 === 1 ? 1 : 0;
		if (drawSprite(ctx, this.atlas, `hero.${this.player.facing}.${frame}`, x, y - 8)) return;

		this.drawProceduralActor(ctx, x, y, theme.PLAYER.body);

		ctx.fillStyle = theme.PLAYER.facingNub;
		let cx = x + 8;
		let cy = y + 2;
		let nub: Record<Direction, [number, number]> = {
			up: [cx - 1, y - 9],
			down: [cx - 1, y + 13],
			left: [x + 1, cy],
			right: [x + 13, cy],
		};
		let [nx, ny] = nub[this.player.facing];
		ctx.fillRect(nx, ny, 2, 2);
	}

	/**
	 * Draws one NPC from the atlas character region, or procedurally.
	 *
	 * Keeps the role label over the head so the three NPCs read apart even when
	 * they share the same character art.
	 */
	private drawNpc(ctx: CanvasRenderingContext2D, npc: Npc) {
		let x = Math.round(npc.x * TILE_SIZE - this.camera.x);
		let y = Math.round(npc.y * TILE_SIZE - this.camera.y);

		if (!drawSprite(ctx, this.atlas, "hero.down.0", x, y - 8)) {
			this.drawProceduralActor(ctx, x, y, theme.NPC_COLOR[npc.role]);
		}

		drawText(ctx, npc.label, x + 8, y - 8, { align: "center", color: theme.TEXT.inverseWhite });
	}

	/** Draws the shared procedural actor body+head used when no atlas art exists. */
	private drawProceduralActor(ctx: CanvasRenderingContext2D, x: number, y: number, body: string) {
		ctx.fillStyle = body;
		ctx.fillRect(x + 3, y - 6, 10, 20);
		ctx.fillStyle = theme.PLAYER.skin;
		ctx.fillRect(x + 4, y - 8, 8, 6);
	}
}

/**
 * Whether an event blocks movement onto its tile.
 *
 * An inert or invisible event stays walkable so the player can step onto it to
 * fire its touch trigger, while a visible page blocks the tile like a wall.
 */
function isSolidEvent(event: EventEntity): boolean {
	return event.page !== null && event.page.graphic !== null;
}
