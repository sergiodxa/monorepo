/**
 * Import and export: every calendar as an `.ics` feed to subscribe to or download, or as
 * JSCalendar JSON, and a form that adds an `.ics` or JSCalendar file's events to the Travel
 * calendar. Both work as plain links and a plain multipart form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { DownloadIcon, LinkIcon, UploadIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Button } from "@sdxc/ui";
import { DropZone } from "@sdxc/ui/app/drop-zone";

import { CALENDARS, SLUG, actionHref, colorValue, findCalendar } from "./data";
import { IMPORT_CALENDAR } from "./ics";

/** The address of one of Sundial's files. */
export function fileHref(part: string): string {
	return `/demo/apps/${SLUG}/files/${part}`;
}

/** A small link to a file, downloaded rather than opened in the app's frame. */
function FileLink(handle: Handle<{ href: string; label: string; name: string }>) {
	return () => (
		<a
			href={handle.props.href}
			download={handle.props.name}
			data-rmx-document=""
			aria-label={handle.props.label}
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.25rem",
					blockSize: "1.75rem",
					paddingInline: "0.5rem",
					borderRadius: "0.375rem",
					border: "1px solid var(--ui-neutral-border)",
					fontSize: "0.75rem",
					fontWeight: "600",
					color: "var(--ui-neutral-fg-emphasis)",
					textDecoration: "none",
					"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
					"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" },
				}),
			]}
		>
			<DownloadIcon size={12} aria-hidden="true" />
			{handle.props.name.split(".").at(-1)}
		</a>
	);
}

namespace ImportScreen {
	export interface Props {
		/** The site's origin, which a subscription address is written against. */
		origin: string;
		/** The page the import form returns to. */
		back: string;
		/** Set when the last upload could not be read. */
		problem: boolean;
	}
}

/** The screen: feeds per calendar, then the import form. */
export function ImportScreen(handle: Handle<ImportScreen.Props>) {
	return () => {
		let { origin, back, problem } = handle.props;
		let subscribe = (part: string) => `webcal://${new URL(origin).host}${fileHref(part)}`;
		let section = raw({ display: "grid", gap: "0.75rem", maxInlineSize: "44rem" });
		let heading = raw({
			margin: "0",
			fontSize: "1rem",
			fontWeight: "650",
			color: "var(--ui-neutral-fg-emphasis)",
		});
		let muted = raw({
			margin: "0",
			fontSize: "0.875rem",
			lineHeight: "1.4",
			color: "var(--ui-neutral-fg-muted)",
		});
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gap: "2rem",
						alignContent: "start",
						padding: "1.25rem",
						overflowY: "auto",
						flex: "1 1 auto",
						minBlockSize: "0",
					}),
				]}
			>
				<section aria-labelledby="sundial-export" mix={[section]}>
					<h2 id="sundial-export" mix={[heading]}>
						Subscribe or download
					</h2>
					<p mix={[muted]}>
						Each calendar is an iCalendar feed any calendar app can subscribe to, and a JSCalendar
						file for apps that speak RFC 8984. Feeds follow your edits in this demo.
					</p>
					<ul
						mix={[
							raw({
								display: "grid",
								margin: "0",
								padding: "0",
								listStyle: "none",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "0.625rem",
							}),
						]}
					>
						{[...CALENDARS.map((calendar) => calendar.id), "all"].map((id) => {
							let calendar = findCalendar(id);
							return (
								<li
									mix={[
										raw({
											display: "flex",
											flexWrap: "wrap",
											alignItems: "center",
											gap: "0.5rem",
											padding: "0.625rem 0.75rem",
											"& + &": { borderBlockStart: "1px solid var(--ui-neutral-border)" },
										}),
									]}
								>
									<span
										aria-hidden="true"
										style={`background-color: ${calendar ? colorValue(calendar.color) : "var(--ui-neutral-fg-muted)"}`}
										mix={[
											raw({
												inlineSize: "0.625rem",
												blockSize: "0.625rem",
												borderRadius: "0.1875rem",
											}),
										]}
									/>
									<span mix={[raw({ flex: "1 1 auto", fontSize: "0.875rem", fontWeight: "500" })]}>
										{calendar?.name ?? "All calendars"}
									</span>
									<a
										href={subscribe(`calendars/${id}.ics`)}
										data-rmx-document=""
										mix={[
											raw({
												display: "inline-flex",
												alignItems: "center",
												gap: "0.25rem",
												fontSize: "0.75rem",
												fontWeight: "600",
												color: "var(--ui-brand-fg)",
											}),
										]}
									>
										<LinkIcon size={12} aria-hidden="true" />
										Subscribe
									</a>
									<FileLink
										href={fileHref(`calendars/${id}.ics`)}
										name={`${id}.ics`}
										label={`Download ${calendar?.name ?? "all calendars"} as iCalendar`}
									/>
									{calendar ? (
										<FileLink
											href={fileHref(`calendars/${id}.json`)}
											name={`${id}.json`}
											label={`Download ${calendar.name} as JSCalendar`}
										/>
									) : null}
								</li>
							);
						})}
					</ul>
				</section>
				<section aria-labelledby="sundial-import" mix={[section]}>
					<h2 id="sundial-import" mix={[heading]}>
						Import a calendar
					</h2>
					<p mix={[muted]}>
						{`Add the events from an .ics file or a JSCalendar file to your ${findCalendar(IMPORT_CALENDAR)?.name ?? "Travel"} calendar. Importing the same file again updates its events rather than adding them twice.`}
					</p>
					{problem ? (
						<p
							role="alert"
							mix={[
								raw({
									margin: "0",
									padding: "0.625rem 0.75rem",
									borderRadius: "0.5rem",
									fontSize: "0.875rem",
									color: "var(--ui-danger-fg, crimson)",
									backgroundColor:
										"color-mix(in oklch, var(--ui-danger-bg-solid, crimson) 10%, transparent)",
								}),
							]}
						>
							That file couldn't be read as a calendar. Pick an .ics or JSCalendar .json file.
						</p>
					) : null}
					<form
						method="post"
						action={actionHref("import")}
						enctype="multipart/form-data"
						data-rmx-document=""
						mix={[raw({ display: "grid", gap: "0.75rem", justifyItems: "start" })]}
					>
						<input type="hidden" name="back" value={back} />
						<DropZone
							name="file"
							accept=".ics,.json,text/calendar,application/json"
							required
							mix={[raw({ inlineSize: "100%" })]}
						>
							<UploadIcon size={20} aria-hidden="true" />
							<span mix={[raw({ display: "grid", gap: "0.125rem" })]}>
								<span mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
									Drop a calendar file here, or click to choose
								</span>
								<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
									iCalendar (.ics) or JSCalendar (.json)
								</span>
							</span>
						</DropZone>
						<Button type="submit" color="brand">
							Import
						</Button>
					</form>
				</section>
			</div>
		);
	};
}
