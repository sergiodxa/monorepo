/**
 * The overworld scene: walking the map and triggering wild battles.
 *
 * It loads a map (from the asset store, or the built-in sample map), follows the
 * player with a clamped camera, and moves the player one tile at a time. When the
 * player finishes a step onto tall grass it rolls an encounter and, on a hit,
 * dispatches `start-battle` against a wild creature from the seeded pool and
 * pushes the battle scene on top of itself. Everything the engine owns (party,
 * battle state) is reached through commands and selectors; the scene only decides
 * where the player is and when a battle begins.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CreatureId } from "~/game/world/ids";

import { createBattleId } from "~/game/world/ids";

import type { PresentationSave } from "../core/save";
import type { Scene } from "../core/scene";
import type { SpriteRef } from "../render/map-schema";

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
import { DialogueScene } from "../scenes/dialogue";
import { MenuScene } from "../scenes/menu";
import { ShopScene } from "../scenes/shop";

import { chooseEncounter, rollEncounter } from "./encounters";
import { createMovementState, type MovementState, tickEventMovement } from "./event-movement";
import { type EventEntity, eventAt, spawnEvents } from "./event-runtime";
import {
	ScriptRunner,
	type ScriptHost,
	type TrainerBattleData,
	type WildBattleData,
} from "./event-script";
import { createSampleMap, createSampleNpcs, GameMap, SAMPLE_SPAWN } from "./map-loader";
import { facingNpc, type Npc, npcAt } from "./npc";
import { PlayerController } from "./player-controller";

/** Money staked on a trainer fight when the trainer defines no explicit reward. */
const DEFAULT_TRAINER_REWARD = 500;

/** Left inset (px) the HUD hint is drawn at, reserved on both sides for symmetry. */
const HUD_HINT_MARGIN = 4;

/**
 * The essential HUD hint, kept short enough to fit any sane screen width.
 *
 * `overworldHint` falls back to this when no fuller variant fits, so it lists
 * only the two actions the player cannot discover by walking (talk and menu).
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
 * The overworld renders at a fixed internal resolution, so the hint must never
 * exceed the usable width or it is clipped off-screen. This chooses the most
 * informative variant that still measures within the budget, falling back to the
 * shortest essential hint when even that is tight.
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

	/** Per-event idle-movement bookkeeping, keyed by event id. */
	private readonly movement = new Map<string, MovementState>();

	/** The interaction currently running, or null when the player is free to move. */
	private interaction: {
		/** The event whose interaction is running. */
		entity: EventEntity;
		/** The script runner sequencing that interaction's commands. */
		runner: ScriptRunner;
	} | null = null;

	/** A warp requested by a running script, applied once the frame settles. */
	private pendingWarp: { mapId: string; x: number; y: number; facing: Direction } | null = null;

	/**
	 * The atlas the world draws actors from, or null to draw procedurally.
	 *
	 * Prefers a manifest atlas ("overworld") and falls back to the generated demo
	 * atlas; when neither is available (e.g. no DOM), it is null and the scene
	 * draws the procedural player/NPC sprites exactly as before.
	 */
	private atlas: Atlas | null = null;

	/** Milliseconds since enter, driving the character walk-cycle frame. */
	private elapsed = 0;

	/** Monotonic counter making each battle id unique. */
	private battleCount = 0;

	/** @param spawn - Where to place the player when the scene enters. */
	constructor(private readonly spawn: Spawn = SAMPLE_SPAWN) {}

	enter(game: GameClient) {
		let data = game.assets.map(this.spawn.mapId) ?? createSampleMap();
		this.map = new GameMap(data);
		this.atlas = game.assets.atlas("overworld") ?? buildPlaceholderAtlas();
		this.renderer = new TileMapRenderer(data, (imageId) => game.assets.image(imageId), this.atlas);
		this.player = new PlayerController(this.spawn.x, this.spawn.y, this.spawn.facing);
		// The trainer fields mid-pool species so its party differs from the starter it fights.
		let speciesIds = Object.keys(game.content.species);
		let first = speciesIds[Math.min(3, speciesIds.length - 1)] ?? speciesIds[0] ?? "";
		let second = speciesIds[Math.min(4, speciesIds.length - 1)] ?? first;
		this.npcs = createSampleNpcs([first, second]);

		// Spawn the map's authored events, skipping any whose completion flag is set,
		// and give each a fresh movement state. The existing sample NPCs above stay
		// alongside these map events (unifying the two is a later follow-up).
		this.events = spawnEvents(this.map.events, (flag) => game.engine.selectFlag(flag));
		this.movement.clear();
		for (let entity of this.events) this.movement.set(entity.id, createMovementState());

		game.audio.playBgm(data.bgm);
		this.runAutorunEvents(game);
	}

	exit() {}

	resume() {
		// Returning from a scene a running script pushed (a dialogue it was waiting
		// on, or a battle it started): continue the script from where it parked. The
		// blocked guard means returning from the menu or a non-script scene does
		// nothing. `advance` inside `resume` runs the next synchronous steps and may
		// park again on the next blocking command.
		if (this.interaction?.runner.blocked) this.interaction.runner.resume();
	}

	update(game: GameClient, dt: number) {
		this.elapsed += dt;

		// A running interaction freezes the overworld: the script drives scenes it
		// pushed (dialogue/battles) and resumes on their pop, so all this loop does is
		// notice when the script finishes and settle its results.
		if (this.interaction) {
			this.settleInteraction(game);
			return;
		}

		if (!this.player.moving && game.input.isPressed(Button.Start)) {
			game.scenes.push(new MenuScene(this.snapshotState()));
			return;
		}

		if (!this.player.moving && game.input.isPressed(Button.A)) {
			let facing = {
				x: this.player.tile.x,
				y: this.player.tile.y,
				facing: this.player.facing,
			};
			let delta = directionDelta(this.player.facing);
			let event = eventAt(this.events, facing.x + delta.dx, facing.y + delta.dy);
			if (event && event.interactionMode === "action") {
				this.startInteraction(game, event);
				return;
			}
			let target = facingNpc(this.npcs, facing);
			if (target) {
				this.interact(game, target);
				return;
			}
		}

		// Idle-move every event against collision, the player, other events, and NPCs.
		for (let entity of this.events) {
			let state = this.movement.get(entity.id);
			if (state) {
				tickEventMovement(
					entity,
					state,
					dt,
					(x, y) => this.actorBlocked(entity, x, y),
					Math.random,
				);
			}
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
	}

	/**
	 * Fires any touch event the player just reached, else rolls a wild encounter.
	 *
	 * Two touch shapes are handled: an invisible walkable trigger the player steps
	 * *onto* (its tile equals the player's), and a solid touch NPC/creature the player
	 * walks *into* (its tile is one step ahead in the facing direction). Either fires
	 * its interaction before an encounter can roll, so stepping onto a trigger tile
	 * never also starts a wild battle on the same arrival.
	 */
	private checkTouchAndEncounter(game: GameClient) {
		let onTile = eventAt(this.events, this.player.tile.x, this.player.tile.y);
		if (onTile && onTile.interactionMode === "touch") {
			this.startInteraction(game, onTile);
			return;
		}
		let delta = directionDelta(this.player.facing);
		let ahead = eventAt(this.events, this.player.tile.x + delta.dx, this.player.tile.y + delta.dy);
		if (ahead && ahead.interactionMode === "touch") {
			this.startInteraction(game, ahead);
			return;
		}
		this.checkEncounter(game);
	}

	/** True when the player cannot step onto a tile (a sample NPC or a solid event holds it). */
	private playerBlocked(x: number, y: number): boolean {
		if (npcAt(this.npcs, x, y) !== null) return true;
		let event = eventAt(this.events, x, y);
		return event !== null && isSolidEvent(event);
	}

	/**
	 * True when a tile is impassable for an idle event actor moving off `self`.
	 *
	 * Events avoid walls, the player, sample NPCs, and other events. An invisible
	 * walkable trigger does not block a moving event, matching how it does not block
	 * the player, so a patrolling NPC can cross a trigger tile.
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
	 * Shared by the sample trainer NPC and by event-driven `start-trainer-battle`
	 * scripts. Each fight spawns the whole party as real, transient (save-excluded,
	 * despawned when the battle ends) creatures and stakes money through the battle
	 * scene's reward config. The fight is inescapable, capture is disabled, and the
	 * enemy sends out its next creature as each active one faints, so the player wins
	 * only when the entire party is down. Returns whether a battle was actually
	 * pushed, so an event script can tell if it should park on the battle.
	 *
	 * @param idPrefix - Stable prefix making each spawned creature's trainer id unique.
	 * @param trainer - The party, optional name, and optional reward to field.
	 */
	private startTrainerFight(
		game: GameClient,
		idPrefix: string,
		trainer: TrainerBattleData,
	): boolean {
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
			// The whole party rides on one enemy team, so a faint forces the next
			// bench creature out through the engine's standard replacement flow.
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
	 * Starts a fixed (often legendary) wild battle from a `wild` event.
	 *
	 * Spawns one wild creature from the event's authored species/level and pushes a
	 * normal capturable wild battle, so the player can catch the legendary. Returns
	 * whether the battle was pushed so the caller can settle the event afterward.
	 */
	private startWildEncounter(game: GameClient, idPrefix: string, wild: WildBattleData): boolean {
		let playerParty = game.engine.selectParty(HERO_ID).creatures.map((creature) => creature.id);
		if (playerParty.length === 0) return false;

		let encounterId = `${idPrefix}-${this.battleCount}`;
		let spawned = game.dispatch({
			type: "spawn-encounter",
			encounterId,
			speciesId: wild.speciesId,
			level: wild.level,
		});
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
	 * Runs every `autorun` event whose gate allows it, once on map enter.
	 *
	 * Only the first eligible autorun event runs its script this enter; a script
	 * blocks the overworld and drives its own scenes, so starting more than one at a
	 * time would interleave dialogues. The rest wait until the interaction settles
	 * and the player triggers them (or a later enter re-checks them).
	 */
	private runAutorunEvents(game: GameClient) {
		for (let entity of this.events) {
			if (entity.interactionMode !== "autorun" || entity.done) continue;
			this.startInteraction(game, entity);
			return;
		}
	}

	/**
	 * Begins an event's interaction: builds a script runner and advances it once.
	 *
	 * The runner runs synchronous commands immediately and parks on the first
	 * blocking command (a message or trainer battle), whose host hook has pushed the
	 * scene it waits on. If the script finishes without blocking (or was empty), the
	 * interaction settles immediately. A second interaction cannot start while one is
	 * running because the overworld is frozen until it settles.
	 */
	private startInteraction(game: GameClient, entity: EventEntity) {
		if (this.interaction || entity.done) return;
		let runner = new ScriptRunner(
			entity.interaction.script,
			this.buildScriptHost(game, entity),
			entity.interaction.trainer,
			entity.interaction.wild,
		);
		this.interaction = { entity, runner };
		runner.advance();
		this.settleInteraction(game);
	}

	/**
	 * Advances a running interaction and finalizes it once its script is done.
	 *
	 * While the runner is blocked, this does nothing (a pushed scene is driving it,
	 * and `resume` continues it on pop). When the script finishes, a `wild` event
	 * starts its battle (once), then the event is marked done, its completion flag is
	 * set so it does not respawn, and control returns to the player — unless a warp
	 * is pending, which reloads the map instead.
	 */
	private settleInteraction(game: GameClient) {
		let active = this.interaction;
		if (!active || active.runner.blocked) return;
		if (!active.runner.done) return;

		let entity = active.entity;

		// A `wild` event battles after its script's lead-in finishes. Starting the
		// battle re-parks us on the battle scene by re-opening the interaction as
		// blocked-equivalent: we keep the interaction set and wait for the next
		// settle (post-battle) with the wild data already consumed.
		if (entity.kind === "wild" && entity.interaction.wild && !entity.done) {
			entity.done = true; // consume so the battle is not restarted on the next settle
			let started = this.startWildEncounter(game, entity.id, entity.interaction.wild);
			if (started) {
				// The battle scene is on top now; the interaction lingers so `resume`
				// finalizes the flag when the battle pops.
				return;
			}
		}

		this.finishInteraction(game, entity);
	}

	/** Marks an event spent, persists its completion flag, and applies any warp. */
	private finishInteraction(game: GameClient, entity: EventEntity) {
		entity.done = true;
		if (entity.flag) game.dispatch({ type: "set-flag", flag: entity.flag });
		this.interaction = null;

		if (this.pendingWarp) {
			let warp = this.pendingWarp;
			this.pendingWarp = null;
			this.warpTo(game, warp);
			return;
		}

		// A completed event with a set flag should disappear from the map right away.
		if (entity.flag && game.engine.selectFlag(entity.flag)) {
			this.events = this.events.filter((candidate) => candidate.id !== entity.id);
			this.movement.delete(entity.id);
		}
	}

	/**
	 * Builds the side-effect surface one event's script drives.
	 *
	 * Synchronous hooks map to engine dispatches (give-item, heal-party, set-flag) or
	 * mutate the interacting entity (face-player, move). Blocking hooks push the
	 * scenes the runner parks on: `showMessage` pushes a dialogue, `startTrainerBattle`
	 * a battle, and `warp` records the destination and lets the run end so the map
	 * reloads. Every hook forwards authored data; no franchise meaning is added here.
	 */
	private buildScriptHost(game: GameClient, entity: EventEntity): ScriptHost {
		return {
			showMessage: (text) => game.scenes.push(new DialogueScene([text])),
			giveItem: (itemId, count) =>
				game.dispatch({ type: "add-inventory-item", playerId: HERO_ID, itemId, count }),
			healParty: () => game.dispatch({ type: "heal-party", playerId: HERO_ID }),
			setFlag: (flag) => game.dispatch({ type: "set-flag", flag }),
			facePlayer: () => {
				entity.facing = oppositeDirection(this.player.facing);
			},
			move: (route) => this.stepEventRoute(entity, route),
			startTrainerBattle: (trainerId, data) => {
				// The map author's trainer id is a label; the fight uses the event's own
				// party data (which the runner passed as `data`). If a battle cannot start
				// the runner is unparked so the rest of the script still runs.
				let started = data
					? this.startTrainerFight(game, `${entity.id}-${trainerId}`, data)
					: false;
				if (!started) this.interaction?.runner.resume();
			},
			warp: (toMap, toX, toY) => {
				this.pendingWarp = { mapId: toMap, x: toX, y: toY, facing: this.player.facing };
			},
		};
	}

	/**
	 * Steps an event through an authored route immediately, skipping blocked tiles.
	 *
	 * A best-effort overworld nicety for the `move` script command: each step turns
	 * the entity and moves it onto the target tile when free, so an NPC can walk aside
	 * or approach as part of a cutscene. Blocked steps only turn the entity.
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
	 * A warp changes which map is loaded, so the overworld is re-entered fresh (new
	 * events, movement, camera) at the destination tile. Replacing rather than
	 * pushing keeps the scene stack flat as the player travels between maps.
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

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		this.renderer.drawGround(ctx, this.camera);
		for (let npc of this.npcs) this.drawNpc(ctx, npc);
		for (let entity of this.events) this.drawEvent(game, ctx, entity);
		this.drawPlayer(ctx);
		// The overhead layer draws above every actor, including event NPCs.
		this.renderer.drawOverhead(ctx, this.camera);
		// Money now lives in the Trainer menu; the HUD only shows the fitting hint.
		drawText(ctx, overworldHint(hudHintMaxWidth()), HUD_HINT_MARGIN, HUD_HINT_MARGIN, {
			color: theme.TEXT.inverseWhite,
		});
	}

	/**
	 * Draws one event entity from its authored sprite, or a placeholder.
	 *
	 * A `trigger` with no sprite is invisible by design and draws nothing. An event
	 * with a sprite blits it from the atlas (an atlas region) or the raw tileset
	 * image (an image rect) at the entity's tile, respecting its facing where the
	 * region is directional; when the art is missing it falls back to a small
	 * procedural marker so the entity is still visible before real sprites exist.
	 */
	private drawEvent(game: GameClient, ctx: CanvasRenderingContext2D, entity: EventEntity) {
		if (entity.kind === "trigger" && entity.sprite === null) return;
		let x = Math.round(entity.x * TILE_SIZE - this.camera.x);
		let y = Math.round(entity.y * TILE_SIZE - this.camera.y);

		if (this.drawEventSprite(game, ctx, entity.sprite, entity.facing, x, y)) return;

		// No sprite art: a facing-tinted procedural body so the entity is visible.
		this.drawProceduralActor(ctx, x, y, theme.NPC_COLOR.trainer);
	}

	/**
	 * Blits an event's sprite ref from the atlas or a raw image, returning success.
	 *
	 * An atlas ref first tries a facing-specific region (`"<region>.<facing>.0"`) so
	 * a directional character sheet turns with the entity, then the region as
	 * authored; an image ref blits the raw source rect from the named image. Returns
	 * false when nothing could be drawn so the caller can fall back procedurally.
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
			// The 16px character cell sits 8px above the tile so its feet meet the tile.
			if (drawSprite(ctx, atlas, `${sprite.region}.${facing}.0`, x, y - 8)) return true;
			return drawSprite(ctx, atlas, sprite.region, x, y - 8);
		}
		let image = game.assets.image(sprite.image);
		if (!image) return false;
		ctx.drawImage(image, sprite.x, sprite.y, sprite.w, sprite.h, x, y - 8, sprite.w, sprite.h);
		return true;
	}

	/** Rolls a wild encounter for the tile the player just reached and starts the battle. */
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

		// A wild battle is now certain to start: sound the encounter jingle as the
		// battle scene is pushed. Safe no-op when audio is unavailable.
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
	 * The walk frame alternates only while the player is stepping; standing still
	 * holds frame 0. When the atlas (or the region) is missing, `drawSprite`
	 * returns false and the original procedural sprite is drawn instead.
	 */
	private drawPlayer(ctx: CanvasRenderingContext2D) {
		let x = Math.round(this.player.pixelX - this.camera.x);
		let y = Math.round(this.player.pixelY - this.camera.y);

		let frame = this.player.moving && Math.floor(this.elapsed / 180) % 2 === 1 ? 1 : 0;
		// The 16px character cell sits 8px above the tile so its feet meet the tile.
		if (drawSprite(ctx, this.atlas, `hero.${this.player.facing}.${frame}`, x, y - 8)) return;

		this.drawProceduralActor(ctx, x, y, theme.PLAYER.body);

		// A small nub indicating facing (procedural fallback only).
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
	 * NPCs share the character art but keep their role label so the three read
	 * apart; when the atlas is missing they fall back to the role-colored
	 * procedural sprite, unchanged.
	 */
	private drawNpc(ctx: CanvasRenderingContext2D, npc: Npc) {
		let x = Math.round(npc.x * TILE_SIZE - this.camera.x);
		let y = Math.round(npc.y * TILE_SIZE - this.camera.y);

		if (!drawSprite(ctx, this.atlas, "hero.down.0", x, y - 8)) {
			this.drawProceduralActor(ctx, x, y, theme.NPC_COLOR[npc.role]);
		}

		// The role glyph over the head keeps the three NPCs distinguishable.
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
 * Visible actors (an NPC, a fixed wild creature, or any sprited event) are solid
 * so the player and other events cannot walk through them. An invisible trigger
 * (a `trigger` with no sprite) is walkable so the player can step onto it to fire
 * its touch/action interaction.
 */
function isSolidEvent(event: EventEntity): boolean {
	if (event.kind === "trigger") return event.sprite !== null;
	return true;
}
