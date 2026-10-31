/**
 * The upgrade page: the pitch for moving from the single book to the package with
 * everything, the email field that resolves the reader's purchase, and the package's
 * contents set as a ruled sheet beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, text, tracking } from "@sdxc/u/typography";
import { CheckList, CheckRow, FeatureBand } from "@sdxc/ui/patterns";
import { marketingSurface } from "@sdxc/ui/styles";

import type { BookCopy } from "~/resources/content/books";

import EmailForm from "~/resources/views/site/email-form";

export namespace UpgradeView {
	export interface Props {
		/** What the reader upgrades from and to, as the pricing band names them. */
		from: BookCopy.Package;
		to: BookCopy.Package;
		/** Where the form posts. */
		action: string;
		/** A server-rendered validation error. */
		error?: string;
	}
}

/** The package the reader moves to, as a ruled sheet listing what it holds. */
function PackageSheet(handle: Handle<{ pkg: BookCopy.Package }>) {
	return () => {
		let { pkg } = handle.props;
		return (
			<div
				role="img"
				aria-label={`What the ${pkg.name} includes`}
				mix={[
					marketingSurface(),
					p(8),
					vstack({ gap: 5, align: "stretch" }),
					raw({ maxInlineSize: "28rem", marginInline: "auto", inlineSize: "100%" }),
				]}
			>
				<div aria-hidden="true" mix={[vstack({ gap: 5, align: "stretch" })]}>
					<span
						mix={[text("xs"), tracking("widest"), fg("brand"), raw({ textTransform: "uppercase" })]}
					>
						Upgrade
					</span>
					<p mix={[m(0), font("display"), raw({ fontSize: "1.75rem" }), fg("neutral.emphasis")]}>
						{pkg.name}
					</p>
					<p mix={[m(0), fg("neutral")]}>{pkg.description}</p>
					<CheckList>
						{pkg.features.map((feature) => (
							<CheckRow>{feature}</CheckRow>
						))}
					</CheckList>
				</div>
			</div>
		);
	};
}

/**
 * Renders the page's `<main>` as one split band whose title is the page's `h1`. The form
 * carries no promise of mail: the reader is a customer giving the address they bought with.
 *
 * @param handle Runtime handle carrying the packages, endpoint and error.
 * @returns The render function producing the page's main content.
 */
export default function UpgradeView(handle: Handle<UpgradeView.Props>) {
	return () => {
		let { action, error, from, to } = handle.props;

		return (
			<main>
				<FeatureBand
					id="upgrade"
					layout="split"
					level={1}
					spacing="hero"
					eyebrow={`Already have ${from.name}?`}
					title={`Upgrade to the ${to.name}`}
					description={
						<>
							Enter the address you bought {from.name} with and{" "}
							<strong>pay only the difference</strong>. Anyone else goes straight to the full
							checkout.
						</>
					}
					media={<PackageSheet pkg={to} />}
				>
					<EmailForm action={action} error={error} submitLabel="Get my upgrade link" />
				</FeatureBand>
			</main>
		);
	};
}
