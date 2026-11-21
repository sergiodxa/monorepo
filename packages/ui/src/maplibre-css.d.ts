/**
 * Declares MapLibre's stylesheet as a module, so the map engine's dynamic import of it compiles
 * under the publish build as well as the type-aware lint; a bundler turns the import into the
 * stylesheet, and without one the import rejects and the engine carries on unstyled.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

declare module "maplibre-gl/dist/maplibre-gl.css";
