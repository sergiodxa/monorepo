/**
 * Delta's dashboard and its own 404. The dashboard lists the one repository and its newest
 * real commits; the 404 sits inside the shell and leads back to the code, so a mistyped
 * address still leaves the visitor one click from somewhere real.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { BookOpenIcon, CompassIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, tabularNums, text, weight } from "@sdxc/u/typography";
import { HeadingScope, LinkButton, RelativeTime } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";

import type { DeltaCommit, DeltaCommitMeta, DeltaHistory } from "~/app/services/delta/source";

import { commitsHref, repoHref } from "../data";
import { COPY } from "../labels";

import { CommitList, CommitRow } from "./commits";

/** How many commits the dashboard lists. */
const RECENT = 5;

namespace DashboardScreen {
	export interface Props {
		history: DeltaHistory;
		files: number;
		latest: DeltaCommit | DeltaCommitMeta | undefined;
		now: number;
	}
}

/** Renders the dashboard: the repository as a card, then its newest commits. */
export function DashboardScreen(handle: Handle<DashboardScreen.Props>) {
	return () => {
		let { files, history, latest, now } = handle.props;
		return (
			<>
				<PageHeader title={COPY.dashboard.title} description={COPY.dashboard.description} />
				<HeadingScope level={2}>
					<div mix={[raw({ display: "grid", gap: "1.5rem" })]}>
						<section aria-labelledby="delta-repos" mix={[raw({ display: "grid", gap: "0.5rem" })]}>
							<h2 id="delta-repos" mix={[text("sm"), weight("semibold"), raw({ margin: 0 })]}>
								{COPY.dashboard.repositories}
							</h2>
							<a
								href={repoHref()}
								data-rmx-prefetch="intent"
								mix={[
									raw({
										display: "grid",
										gap: "0.375rem",
										padding: "0.875rem 1rem",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "var(--ui-radius-lg)",
										background: "var(--ui-bg)",
										textDecoration: "none",
										color: "inherit",
										"&:hover": { borderColor: "var(--ui-brand-border)" },
									}),
								]}
							>
								<span
									mix={[
										raw({ display: "flex", alignItems: "center", gap: "0.5rem" }),
										weight("semibold"),
										fg("brand"),
									]}
								>
									<BookOpenIcon size={16} aria-hidden="true" />
									<span mix={[font("mono")]}>{`${COPY.org}/${COPY.repo}`}</span>
								</span>
								<span mix={[text("sm"), fg("neutral.muted")]}>{COPY.about}</span>
								<span
									mix={[
										raw({ display: "flex", flexWrap: "wrap", gap: "1rem" }),
										text("xs"),
										fg("neutral.muted"),
										tabularNums(),
									]}
								>
									<span>{COPY.dashboard.files(files)}</span>
									<span>{COPY.latest.commits(history.commits.length, history.capped)}</span>
									{latest === undefined ? null : (
										<span>
											{COPY.dashboard.updated}{" "}
											<RelativeTime date={latest.date} now={now} locale="en" />
										</span>
									)}
								</span>
							</a>
						</section>
						{history.commits.length === 0 ? null : (
							<section
								aria-labelledby="delta-recent"
								mix={[raw({ display: "grid", gap: "0.5rem" })]}
							>
								<h2 id="delta-recent" mix={[text("sm"), weight("semibold"), raw({ margin: 0 })]}>
									{COPY.dashboard.recent}
								</h2>
								<CommitList label={COPY.dashboard.recent}>
									{history.commits.slice(0, RECENT).map((commit) => (
										<CommitRow commit={commit} now={now} scope="recent" />
									))}
								</CommitList>
								<LinkButton
									href={commitsHref()}
									size="sm"
									variant="ghost"
									color="neutral"
									data-rmx-prefetch="viewport"
									mix={[raw({ justifySelf: "start" })]}
								>
									{COPY.dashboard.all}
								</LinkButton>
							</section>
						)}
					</div>
				</HeadingScope>
			</>
		);
	};
}

/** Renders the app's own 404 inside the shell, so the sidebar still leads somewhere. */
export function NotFoundScreen() {
	return () => (
		<>
			<PageHeader title={COPY.notFound.title} />
			<HeadingScope level={2}>
				<Empty icon={<CompassIcon />}>
					<Empty.Description>{COPY.notFound.hint}</Empty.Description>
					<Empty.Action>
						<LinkButton href={repoHref()} color="brand">
							{COPY.notFound.action}
						</LinkButton>
					</Empty.Action>
				</Empty>
			</HeadingScope>
		</>
	);
}
