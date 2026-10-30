/**
 * Trust band placed immediately after a hero: a {@link LogoCloud}, a
 * {@link StatStrip}, or both stacked. Children are the proof content — the
 * library ships no figures or marks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { width } from "@sdxc/u/size";

import { MarketingSection } from "../components/marketing-section.js";

/** Band fill {@link ProofStrip} applies when `tone` is omitted. */
const DEFAULT_TONE: ProofStrip.Tone = "plain";

/**
 * Prop types for {@link ProofStrip}.
 */
export namespace ProofStrip {
	/**
	 * Band fill forwarded to {@link MarketingSection}.
	 */
	export type Tone = MarketingSection.Tone;

	/**
	 * Props accepted by {@link ProofStrip}.
	 */
	export interface Props extends Omit<MarketingSection.Props, "children" | "tone" | "spacing"> {
		/** Band fill. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/**
		 * Proof content — typically a {@link LogoCloud}, a {@link StatStrip},
		 * or both stacked.
		 */
		children: RemixNode;
	}
}

/**
 * Renders a compact ruled band for adopter marks and/or numeric proof.
 *
 * @param handle Runtime handle carrying the strip's props.
 * @returns The render function producing the strip's markup.
 * @example
 * <ProofStrip>
 * 	<LogoCloud muted>{marks}</LogoCloud>
 * </ProofStrip>
 * @example
 * <ProofStrip>
 * 	<StatStrip>
 * 		<StatStrip.Item label={t("stats.uptime")}>99.99%</StatStrip.Item>
 * 	</StatStrip>
 * </ProofStrip>
 */
export function ProofStrip(handle: Handle<ProofStrip.Props>) {
	return () => {
		let { children, mix, tone, ...rest } = handle.props;
		let resolvedTone = tone ?? DEFAULT_TONE;

		return (
			<MarketingSection
				{...rest}
				tone={resolvedTone}
				spacing="compact"
				ruled
				align="center"
				mix={mix}
			>
				<div mix={[vstack({ gap: 8, align: "center" }), width("full")]}>{children}</div>
			</MarketingSection>
		);
	};
}
