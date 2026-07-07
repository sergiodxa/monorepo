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

import type { Direction } from "../core/direction";
import type { PresentationSave } from "../core/save";
import type { Scene } from "../core/scene";

import { BattleScene } from "../battle/battle-scene";
import { GameClient } from "../core/game-client";
import { Button } from "../core/input";
import { TILE_SIZE } from "../core/loop";
import { HERO_ID, WILD_ID } from "../core/new-game";
import { type Atlas, drawSprite } from "../render/atlas";
import { Camera } from "../render/camera";
import { buildPlaceholderAtlas } from "../render/placeholder-atlas";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { TileMapRenderer } from "../render/tilemap";
import { DialogueScene } from "../scenes/dialogue";
import { MenuScene } from "../scenes/menu";
import { ShopScene } from "../scenes/shop";

import { chooseEncounter, rollEncounter } from "./encounters";
import { createSampleMap, createSampleNpcs, GameMap, SAMPLE_SPAWN } from "./map-loader";
import { facingNpc, type Npc, npcAt } from "./npc";
import { PlayerController } from "./player-controller";

/** Money staked on a trainer fight when the trainer defines no explicit reward. */
const DEFAULT_TRAINER_REWARD = 500;

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
		this.renderer = new TileMapRenderer(data, game.assets.image(data.tileset), this.atlas);
		this.player = new PlayerController(this.spawn.x, this.spawn.y, this.spawn.facing);
		// The trainer fields mid-pool species so its party differs from the starter it fights.
		let speciesIds = Object.keys(game.content.species);
		let first = speciesIds[Math.min(3, speciesIds.length - 1)] ?? speciesIds[0] ?? "";
		let second = speciesIds[Math.min(4, speciesIds.length - 1)] ?? first;
		this.npcs = createSampleNpcs([first, second]);
		game.audio.playBgm(data.bgm);
	}

	exit() {}

	resume() {
		// Returning from a battle: nothing to restore, the engine kept the world.
	}

	update(game: GameClient, dt: number) {
		this.elapsed += dt;
		if (!this.player.moving && game.input.isPressed(Button.Start)) {
			game.scenes.push(new MenuScene(this.snapshotState()));
			return;
		}

		if (!this.player.moving && game.input.isPressed(Button.A)) {
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

		let { arrived } = this.player.update(
			game.input,
			this.map,
			dt,
			(x, y) => npcAt(this.npcs, x, y) !== null,
		);
		this.camera.centerOn(
			this.player.pixelX + TILE_SIZE / 2,
			this.player.pixelY + TILE_SIZE / 2,
			this.map.widthPx,
			this.map.heightPx,
		);

		if (arrived) this.checkEncounter(game);
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

	/**
	 * Starts a rebattlable trainer fight against the NPC's freshly spawned party.
	 *
	 * Each fight spawns the trainer's whole party as real, non-capturable creatures
	 * (transient, excluded from saves, and despawned when the battle ends) and stakes
	 * money through the battle scene's reward config. The fight is inescapable, capture
	 * is disabled, and the enemy sends out its next creature as each active one faints,
	 * so the player wins only when the entire party is down and can rechallenge freely.
	 */
	private startTrainerBattle(game: GameClient, npc: Npc) {
		let trainer = npc.trainer;
		if (!trainer || trainer.party.length === 0) return;
		let playerParty = game.engine.selectParty(HERO_ID).creatures.map((creature) => creature.id);
		if (playerParty.length === 0) return;

		let battleNumber = this.battleCount++;
		let enemyParty: CreatureId[] = [];
		for (let [index, member] of trainer.party.entries()) {
			let spawned = game.dispatch({
				type: "spawn-trainer-creature",
				trainerId: `${npc.id}-${battleNumber}-${index}`,
				speciesId: member.speciesId,
				level: member.level,
			});
			let creature = spawned.find((event) => event.type === "trainer-creature-spawned");
			if (creature?.type !== "trainer-creature-spawned") return;
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
		this.drawPlayer(ctx);
		this.renderer.drawOverhead(ctx, this.camera);
		drawText(ctx, "Grass: wild battles   A: talk   Start: menu", 4, 4, {
			color: theme.TEXT.inverseWhite,
		});
		let money = game.engine.selectPlayer(HERO_ID).money;
		drawText(ctx, `₽${money}`, 4, 16, { color: theme.TEXT.inverseWhite });
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
