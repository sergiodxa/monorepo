/**
 * Browser entrypoint and the boundary between the document and the game: it
 * assembles the authored content registries into the engine's data source,
 * builds a fresh new-game world, and starts the canvas client on the boot scene.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameDataSource } from "~/game/data/game-data";

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
