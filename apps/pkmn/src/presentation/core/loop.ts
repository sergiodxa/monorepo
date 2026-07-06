/**
 * Fixed-timestep timing constants shared by the game loop and input layer.
 *
 * The presentation advances its simulation at a constant rate that is decoupled
 * from the render cadence: `GameClient` accumulates real elapsed time and steps
 * the active scene in whole `FIXED_STEP_MS` slices, capping catch-up work at
 * `MAX_FRAME_MS` so a backgrounded tab cannot trigger a spiral of death. These
 * constants live in their own module so the client loop and input edge
 * detection can agree on the step size without importing one another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Duration of one fixed simulation step, in milliseconds (60 Hz). */
export const FIXED_STEP_MS = 1000 / 60;

/** Maximum real time a single animation frame may consume before catch-up is capped. */
export const MAX_FRAME_MS = 250;

/** Internal render resolution in pixels (Game Boy Advance native). */
export const SCREEN_WIDTH = 240;

/** Internal render resolution in pixels (Game Boy Advance native). */
export const SCREEN_HEIGHT = 160;

/** Edge length of one overworld tile, in internal pixels. */
export const TILE_SIZE = 16;
