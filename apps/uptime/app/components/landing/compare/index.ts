/**
 * Barrel module for the competitor comparison page sections, re-exporting the hero,
 * feature table, honest take, perfect-for, pricing, why-switch, and CTA components,
 * plus the shared landing FAQ aliased as CompareFAQ. It exists so versus pages can
 * import all comparison building blocks from one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { CompareCTA } from "./compare-cta";
export { CompareFeatureTable } from "./compare-feature-table";
export { CompareHero } from "./compare-hero";
export { CompareHonestTake } from "./compare-honest-take";
export { ComparePerfectFor } from "./compare-perfect-for";
export { ComparePricing } from "./compare-pricing";
export { CompareWhySwitch } from "./compare-why-switch";

// Re-export LandingFAQ for use in comparison pages
export { LandingFAQ as CompareFAQ } from "../faq";
