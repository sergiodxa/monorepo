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
import type { Scene } from "../core/scene";

import { BattleScene } from "../battle/battle-scene";
import { GameClient } from "../core/game-client";
import { TILE_SIZE } from "../core/loop";
import { HERO_ID, WILD_ID } from "../core/new-game";
import { Camera } from "../render/camera";
import { drawText } from "../render/text";
import { TileMapRenderer } from "../render/tilemap";

import { rollEncounter, pickWildCreature } from "./encounters";
import { createSampleMap, GameMap, SAMPLE_SPAWN } from "./map-loader";
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

	/** Monotonic counter making each battle id unique. */
	private battleCount = 0;

	/** @param spawn - Where to place the player when the scene enters. */
	constructor(private readonly spawn: Spawn = SAMPLE_SPAWN) {}

	enter(game: GameClient) {
		let data = game.assets.map(this.spawn.mapId) ?? createSampleMap();
		this.map = new GameMap(data);
		this.renderer = new TileMapRenderer(data, game.assets.image(data.tileset));
		this.player = new PlayerController(this.spawn.x, this.spawn.y, this.spawn.facing);
		game.audio.playBgm(data.bgm);
	}

	exit() {}

	resume() {
		// Returning from a battle: nothing to restore, the engine kept the world.
	}

	update(game: GameClient, dt: number) {
		let { arrived } = this.player.update(game.input, this.map, dt);
		this.camera.centerOn(
			this.player.pixelX + TILE_SIZE / 2,
			this.player.pixelY + TILE_SIZE / 2,
			this.map.widthPx,
			this.map.heightPx,
		);

		if (arrived) this.checkEncounter(game);
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		this.renderer.drawGround(ctx, this.camera);
		this.drawPlayer(ctx);
		this.renderer.drawOverhead(ctx, this.camera);
		drawText(ctx, "Grass = wild battles", 4, 4, { color: "#ffffff" });
		void game;
	}

	/** Rolls a wild encounter for the tile the player just reached. */
	private checkEncounter(game: GameClient) {
		let { x, y } = this.player.tile;
		if (!rollEncounter(this.map, x, y, Math.random)) return;

		let playerParty = game.engine.selectParty(HERO_ID).creatures.map((creature) => creature.id);
		let pool = game.engine.selectParty(WILD_ID).creatures.map((creature) => creature.id);
		let wild = pickWildCreature(pool, Math.random);
		if (playerParty.length === 0 || wild === null) return;

		let battleId = createBattleId(`wild-${this.battleCount++}`);
		game.dispatch({
			type: "start-battle",
			battleId,
			playerId: HERO_ID,
			enemyId: WILD_ID,
			playerParty,
			enemyParty: [wild],
			slots: 1,
		});
		game.scenes.push(new BattleScene(battleId));
	}

	/** Draws the player as a procedural character sprite facing its direction. */
	private drawPlayer(ctx: CanvasRenderingContext2D) {
		let x = Math.round(this.player.pixelX - this.camera.x);
		let y = Math.round(this.player.pixelY - this.camera.y);

		ctx.fillStyle = "#d03030";
		ctx.fillRect(x + 3, y - 6, 10, 20);
		ctx.fillStyle = "#f0c090";
		ctx.fillRect(x + 4, y - 8, 8, 6);

		// A small nub indicating facing.
		ctx.fillStyle = "#202020";
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
}
