/**
 * Barrel module for the landing page section components, re-exporting the hero, FAQ,
 * features, final CTA, footer, header, how-it-works, and trust-indicators pieces. It
 * exists to give landing routes a single import point for composing marketing pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { LandingFAQ } from "./faq";
export { LandingFeatures } from "./features";
export { LandingFinalCTA } from "./final-cta";
export { LandingFooter } from "./footer";
export { LandingHeader } from "./header";
export { LandingHero } from "./hero";
export { LandingHowItWorks } from "./how-it-works";
export { LandingTrustIndicators } from "./trust-indicators";
