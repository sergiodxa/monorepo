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
import { createBattleId } from "~/game/world/ids";

import type { Direction } from "../core/direction";
import type { PresentationSave } from "../core/save";
import type { Scene } from "../core/scene";

import { BattleScene } from "../battle/battle-scene";
import { GameClient } from "../core/game-client";
import { Button } from "../core/input";
import { TILE_SIZE } from "../core/loop";
import { HERO_ID, WILD_ID } from "../core/new-game";
import { Camera } from "../render/camera";
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

	/** Monotonic counter making each battle id unique. */
	private battleCount = 0;

	/** @param spawn - Where to place the player when the scene enters. */
	constructor(private readonly spawn: Spawn = SAMPLE_SPAWN) {}

	enter(game: GameClient) {
		let data = game.assets.map(this.spawn.mapId) ?? createSampleMap();
		this.map = new GameMap(data);
		this.renderer = new TileMapRenderer(data, game.assets.image(data.tileset));
		this.player = new PlayerController(this.spawn.x, this.spawn.y, this.spawn.facing);
		// The trainer fields a mid-pool species so it differs from the starter it fights.
		let speciesIds = Object.keys(game.content.species);
		let trainerSpeciesId = speciesIds[Math.min(3, speciesIds.length - 1)] ?? speciesIds[0] ?? "";
		this.npcs = createSampleNpcs(trainerSpeciesId);
		game.audio.playBgm(data.bgm);
	}

	exit() {}

	resume() {
		// Returning from a battle: nothing to restore, the engine kept the world.
	}

	update(game: GameClient, dt: number) {
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
	 * Starts a rebattlable trainer fight against the NPC's freshly spawned creature.
	 *
	 * Each fight spawns a new creature under a unique encounter id and stakes money
	 * through the battle scene's reward config, so the player can walk back and
	 * challenge the trainer again as often as they like.
	 */
	private startTrainerBattle(game: GameClient, npc: Npc) {
		let trainer = npc.trainer;
		if (!trainer) return;
		let playerParty = game.engine.selectParty(HERO_ID).creatures.map((creature) => creature.id);
		if (playerParty.length === 0) return;

		let encounterId = `trainer-${this.battleCount}`;
		let spawned = game.dispatch({
			type: "spawn-encounter",
			encounterId,
			speciesId: trainer.speciesId,
			level: trainer.level,
		});
		let creature = spawned.find((event) => event.type === "encounter-spawned");
		if (creature?.type !== "encounter-spawned") return;

		let battleId = createBattleId(`trainer-${this.battleCount++}`);
		game.dispatch({
			type: "start-battle",
			battleId,
			playerId: HERO_ID,
			enemyId: WILD_ID,
			playerParty,
			enemyParty: [creature.creatureId],
			slots: 1,
		});
		game.scenes.push(
			new BattleScene(battleId, {
				canCapture: false,
				reward: { playerId: HERO_ID, winReward: 500, lossPenalty: 250 },
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

	/** Draws the player as a procedural character sprite facing its direction. */
	private drawPlayer(ctx: CanvasRenderingContext2D) {
		let x = Math.round(this.player.pixelX - this.camera.x);
		let y = Math.round(this.player.pixelY - this.camera.y);

		ctx.fillStyle = theme.PLAYER.body;
		ctx.fillRect(x + 3, y - 6, 10, 20);
		ctx.fillStyle = theme.PLAYER.skin;
		ctx.fillRect(x + 4, y - 8, 8, 6);

		// A small nub indicating facing.
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

	/** Draws one NPC as a procedural sprite, colored by role, offset by the camera. */
	private drawNpc(ctx: CanvasRenderingContext2D, npc: Npc) {
		let x = Math.round(npc.x * TILE_SIZE - this.camera.x);
		let y = Math.round(npc.y * TILE_SIZE - this.camera.y);

		ctx.fillStyle = theme.NPC_COLOR[npc.role];
		ctx.fillRect(x + 3, y - 6, 10, 20);
		ctx.fillStyle = theme.PLAYER.skin;
		ctx.fillRect(x + 4, y - 8, 8, 6);

		// The role glyph over the head keeps the three NPCs distinguishable.
		drawText(ctx, npc.label, x + 8, y - 8, { align: "center", color: theme.TEXT.inverseWhite });
	}
}
