import type { GameDataSource } from "~/game/data/game-data";

/**
 * Browser entrypoint: compose content, create the engine, and start the client.
 *
 * This module is the boundary between the document and the game. It assembles the
 * authored content registries into the engine's data source, builds a fresh
 * new-game world, constructs the canvas `GameClient`, and starts it on the boot
 * scene. Everything past this point runs through the presentation layer; the old
 * DOM demo it replaces is gone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";
import { Engine } from "~/game/engine";
import { GameClient } from "~/presentation/core/game-client";
import { createNewGameWorld } from "~/presentation/core/new-game";
import { BootScene } from "~/presentation/scenes/boot";

let content: GameDataSource = {
	species: SPECIES,
	moves: MOVES,
	items: ITEMS,
	natures: NATURES,
	typeChart: TYPE_MATCHUPS,
};

let root = globalThis.document.getElementById("app");
if (root === null) throw new ReferenceError("Missing #app root element.");

let engine = Engine.create({ content, world: createNewGameWorld(content) });
let game = new GameClient(root, engine, content);
game.start(new BootScene());
