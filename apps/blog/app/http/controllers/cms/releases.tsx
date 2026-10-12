/**
 * CMS controller for the weekly releases posts the weekly job writes: it lists them with
 * their "Post on X" link, edits a post's title and content, and deletes one. Every save and
 * delete queues the post's Webmentions and its ActivityPub publish, as for any post.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure, succeeded } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { Release } from "~/app/models/releases";

import { getAuthUser } from "~/app/http/middleware/auth";
import { ReleaseSchema } from "~/app/http/validators/cms/release";
import { TAGS } from "~/app/initializers/cache";
import jobs from "~/app/jobs";
import { isPublishedAt } from "~/app/models/post-values";
import { RELEASE_TITLE } from "~/app/models/releases";
import { releaseShareText, shareIntent } from "~/app/services/share";
import { permalink } from "~/app/services/webmention";
import { CMSReleasesEditView, CMSReleasesIndexView } from "~/resources/views/cms/releases";
import routes from "~/routes/web";

/**
 * The author's "Post on X" link for a releases post, listing the packages the job found at
 * the post's canonical permalink.
 */
function shareHref(release: Release): string {
	return shareIntent(
		releaseShareText({
			packages: release.meta.packages.map((pkg) => pkg.name),
			permalink: permalink({ postType: "releases", slug: release.meta.slug }).href,
		}),
	);
}

/**
 * CMS releases screens. Posts are created by the weekly job only, so the resource has no
 * `new` or `create`; mutating actions answer See Other so a reload never repeats the write.
 */
export default createController(routes.cms.releases, {
	/** The CMS route group enforces authentication; each write re-checks the user. */
	middleware: [],

	actions: {
		/**
		 * Lists every releases post, newest first, each with its public page, its "Post on X"
		 * link and its edit and delete actions.
		 *
		 * @param ctx Request context carrying the models.
		 */
		index: async (ctx) => {
			let releases = await ctx.models.releases.findAll({ includePreview: true });
			let items = releases.map((release) => ({
				id: release.id,
				title: release.meta.title,
				slug: release.meta.slug,
				preview: !isPublishedAt(release.published_at),
				publicHref: routes.post.href({ postType: "releases", postSlug: release.meta.slug }),
				shareHref: shareHref(release),
				href: routes.cms.releases.edit.href({ id: release.id }),
				deleteAction: routes.cms.releases.destroy.href({ id: release.id }),
			}));

			return ctx.render(CMSReleasesIndexView, { items });
		},

		/**
		 * The edit form, with the post's "Post on X" link; an unknown or deleted post sends the
		 * editor back to the index, which lists every post there is.
		 *
		 * @param ctx Request context carrying the route params and the models.
		 */
		edit: async (ctx) => {
			let id = ctx.params.id;
			let release = id ? await ctx.models.releases.find(id) : null;
			if (!release)
				return redirect(routes.cms.releases.index.href(), { status: redirect.Status.SeeOther });

			return ctx.render(CMSReleasesEditView, {
				title: `Edit ${release.meta.slug}`,
				description: `Editing the releases post at ${routes.post.href({ postType: "releases", postSlug: release.meta.slug })}.`,
				action: routes.cms.releases.update.href({ id: release.id }),
				shareHref: shareHref(release),
				values: { title: release.meta.title, content: release.meta.content },
			});
		},

		/**
		 * Saves the title and content, keeping the slug and package list the job wrote. A blank
		 * title falls back to the standard one. A missing user or id lands on the index.
		 *
		 * @param ctx Request context carrying the route params, form data and models.
		 * @returns See Other back to the edit form, or to the index for an unknown post.
		 */
		update: async (ctx) => {
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.releases.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), ReleaseSchema);
			succeeded(result, "Invalid release form data");

			let release = await ctx.models.releases.find(id);
			if (!release)
				return redirect(routes.cms.releases.index.href(), { status: redirect.Status.SeeOther });

			let updated = await ctx.models.releases.update(id, {
				meta: { title: result.data.title.trim() || RELEASE_TITLE, content: result.data.content },
			});
			if (isFailure(updated))
				return redirect(routes.cms.releases.index.href(), { status: redirect.Status.SeeOther });

			await ctx.jobs.enqueue(jobs.webmentions.send, { postId: id });
			await ctx.jobs.enqueue(jobs.activityPub.publish, {
				postId: id,
				changedAt: new Date().toISOString(),
			});
			ctx.cache.purgeLater(TAGS.post("releases", release.meta.slug));

			return redirect(routes.cms.releases.edit.href({ id }), { status: redirect.Status.SeeOther });
		},

		/**
		 * Tombstones the post, whose permalink then answers 410 Gone, and tells the pages it
		 * linked and its followers. The weekly job never writes that week again.
		 *
		 * @param ctx Request context carrying the route params and models.
		 */
		destroy: async (ctx) => {
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.releases.index.href(), { status: redirect.Status.SeeOther });

			let release = await ctx.models.releases.find(id);
			if (await ctx.models.releases.tombstone(id)) {
				await ctx.jobs.enqueue(jobs.webmentions.send, { postId: id });
				await ctx.jobs.enqueue(jobs.activityPub.publish, {
					postId: id,
					changedAt: new Date().toISOString(),
				});
			}
			if (release) ctx.cache.purgeLater(TAGS.post("releases", release.meta.slug));

			return redirect(routes.cms.releases.index.href(), { status: redirect.Status.SeeOther });
		},
	},
});
