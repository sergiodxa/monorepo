/**
 * The stats page's adoption section: how many projects outside this repository depend on each
 * package, and the repositories whose manifests install the collection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";
import { Table } from "@sdxc/ui/app";
import { StatStrip } from "@sdxc/ui/landing";

import type { AdoptionSnapshot, PackageAdoption } from "~/app/services/adoption";

import routes from "~/routes/web";

/** How counts read in the section. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

namespace AdoptionSection {
	export interface Props {
		/** The stored snapshot, or `null` while nothing has been read. */
		snapshot: AdoptionSnapshot | null;
	}
}

/**
 * The packages with any outside dependents, most first and ties by name, which is the order
 * a reader scans for the packages people actually use.
 */
export function adoptedPackages(snapshot: AdoptionSnapshot): PackageAdoption[] {
	return snapshot.packages
		.filter((entry) => entry.outsideDependents > 0)
		.sort(
			(a, b) => b.outsideDependents - a.outsideDependents || a.directory.localeCompare(b.directory),
		);
}

/** Renders the section, or a one-line note while the first read is still pending. */
export default function AdoptionSection(handle: Handle<AdoptionSection.Props>) {
	return () => {
		let { snapshot } = handle.props;
		let heading = <h2 mix={[text("lg"), weight("semibold"), fg("neutral.emphasis")]}>Adoption</h2>;

		if (snapshot === null) {
			return (
				<section mix={vstack({ gap: 4, align: "stretch" })}>
					{heading}
					<p mix={[text("sm"), fg("neutral.muted")]}>
						Reading deps.dev and GitHub; this fills in after the next visit.
					</p>
				</section>
			);
		}

		let adopted = adoptedPackages(snapshot);
		let outside = adopted.reduce((sum, entry) => sum + entry.outsideDependents, 0);

		return (
			<section mix={vstack({ gap: 4, align: "stretch" })}>
				{heading}
				<p mix={[text("sm"), fg("neutral.muted")]}>
					Outside dependents are an estimate: deps.dev's direct dependents of each package's default
					version, less the packages in this collection that depend on it. Read{" "}
					{new Date(snapshot.fetchedAt).toISOString().slice(0, 16).replace("T", " ")} UTC.
					{snapshot.missing.length > 0
						? ` ${snapshot.missing.length} packages are not on deps.dev yet.`
						: null}
				</p>

				<StatStrip>
					<StatStrip.Item label="Packages with outside dependents">
						{adopted.length} of {snapshot.packages.length}
					</StatStrip.Item>
					<StatStrip.Item label="Outside dependents, estimated">
						{NUMBER_FORMAT.format(outside)}
					</StatStrip.Item>
					<StatStrip.Item label="Repositories installing the collection">
						{snapshot.repositoriesNote === "no-token"
							? "—"
							: NUMBER_FORMAT.format(snapshot.repositories.length)}
					</StatStrip.Item>
				</StatStrip>

				{adopted.length > 0 ? (
					<Table.Container>
						<Table aria-label="Packages with outside dependents">
							<Table.Header>
								<Table.Row>
									<Table.Column>Package</Table.Column>
									<Table.Column numeric>Outside, estimated</Table.Column>
									<Table.Column numeric>Direct on deps.dev</Table.Column>
									<Table.Column numeric>In this collection</Table.Column>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{adopted.map((entry) => (
									<Table.Row key={entry.directory}>
										<Table.Cell>
											<Link href={`${routes.stats.href()}?package=${entry.directory}`}>
												{entry.name}
											</Link>
										</Table.Cell>
										<Table.Cell numeric>{NUMBER_FORMAT.format(entry.outsideDependents)}</Table.Cell>
										<Table.Cell numeric>{NUMBER_FORMAT.format(entry.directDependents)}</Table.Cell>
										<Table.Cell numeric>
											{NUMBER_FORMAT.format(entry.collectionDependents)}
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table>
					</Table.Container>
				) : null}

				<Repositories snapshot={snapshot} />
			</section>
		);
	};
}

namespace Repositories {
	export interface Props {
		snapshot: AdoptionSnapshot;
	}
}

/** Lists the repositories code search found, or says why the list could not be read. */
function Repositories(handle: Handle<Repositories.Props>) {
	return () => {
		let { repositories, repositoriesNote } = handle.props.snapshot;

		if (repositoriesNote === "no-token") {
			return (
				<p mix={[text("sm"), fg("neutral.muted")]}>
					GitHub code search needs a token, so repositories are listed once the worker has one.
				</p>
			);
		}

		return (
			<div mix={vstack({ gap: 2, align: "stretch" })}>
				<h3 mix={[text("md"), weight("semibold"), fg("neutral.emphasis")]}>
					Repositories whose manifests name an @sdxc package
				</h3>
				{repositoriesNote === "failed" ? (
					<p mix={[text("sm"), fg("warning")]}>
						GitHub refused the last search; this list is from the one before.
					</p>
				) : null}
				{repositories.length === 0 ? (
					<p mix={[text("sm"), fg("neutral.muted")]}>None found outside this repository yet.</p>
				) : (
					<ul mix={[vstack({ gap: 2, align: "stretch" }), text("sm")]}>
						{repositories.map((repository) => (
							<li key={repository.fullName}>
								<Link href={repository.url}>{repository.fullName}</Link>
								<span mix={fg("neutral.muted")}>
									{" "}
									· {repository.paths.join(", ")}
									{repository.packages.length > 0 ? ` · ${repository.packages.join(", ")}` : null}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>
		);
	};
}
