/**
 * CMS controller for topics: lists them, and creates, edits and deletes them through
 * `ctx.models.topics`, which canonicalizes each query and guards a kind's topic. A refused
 * write re-renders the form with the reason, keeping what the editor typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure, succeeded } from "@sdxc/result";
import { slugify } from "@sdxc/strings";
import { validate, ValidationError } from "@sdxc/validate";
import { createController } from "remix/router";

import { NewTopicQuerySchema, TopicSchema } from "~/app/http/validators/cms/topic";
import { topicPath } from "~/app/http/view-models/topic";
import { isBuiltInTopic } from "~/app/models/topics";
import { CMSTopicFormView, CMSTopicsIndexView } from "~/resources/views/cms/topics";
import routes from "~/routes/web";

/** The form for a new topic, holding `values` and, after a refused save, why. */
function newForm(
	values: CMSTopicFormView.Values,
	error: string | null = null,
): CMSTopicFormView.Props {
	return {
		title: "New Topic",
		action: routes.cms.topics.create.href(),
		mode: "new",
		builtIn: false,
		values,
		error,
	};
}

/** What a refused save names first, which the form shows above its fields. */
function reason(error: ValidationError | Error): string {
	if (error instanceof ValidationError) return error.issues[0]?.message ?? error.message;
	return error.message;
}

/** CMS topic CRUD; every action answers with an HTML view or a 303 redirect. */
export default createController(routes.cms.topics, {
	middleware: [],

	actions: {
		/** Every topic by title, each with its public address and query. */
		async index(ctx) {
			let topics = await ctx.models.topics.findAll();
			let items = topics.map((topic) => ({
				id: topic.id,
				title: topic.title,
				path: topicPath(topic),
				query: topic.query,
				builtIn: isBuiltInTopic(topic.slug),
				href: routes.cms.topics.edit.href({ id: topic.id }),
				deleteAction: routes.cms.topics.destroy.href({ id: topic.id }),
			}));
			return ctx.render(CMSTopicsIndexView, { items });
		},

		/** A blank form, its query prefilled from `?q=`, which "Save as topic" on `/search` sends. */
		async new(ctx) {
			let query = await validate(ctx.url.searchParams, NewTopicQuerySchema);
			let q = isFailure(query) ? "" : query.data.q;
			return ctx.render(
				CMSTopicFormView,
				newForm({ title: "", slug: "", query: q, description: "" }),
			);
		},

		/** A blank slug is derived from the title; a refused save re-renders the form with 422. */
		async create(ctx) {
			let form = await validate(ctx.get(FormData), TopicSchema);
			succeeded(form, "Invalid topic form data");
			let values = { ...form.data, slug: form.data.slug.trim() || slugify(form.data.title) };

			let saved = await ctx.models.topics.create(values);
			if (isFailure(saved)) {
				return ctx.render(CMSTopicFormView, newForm(values, reason(saved.error)), { status: 422 });
			}
			return redirect(routes.cms.topics.edit.href({ id: saved.data.id }), {
				status: redirect.Status.SeeOther,
			});
		},

		/** A kind's topic shows its slug and query read-only; an unknown id answers 404. */
		async edit(ctx) {
			let topic = await ctx.models.topics.find(ctx.params.id);
			if (topic === null) {
				let missing = newForm({ title: "", slug: "", query: "", description: "" });
				return ctx.render(
					CMSTopicFormView,
					{ ...missing, error: "This topic does not exist." },
					{
						status: 404,
					},
				);
			}
			return ctx.render(CMSTopicFormView, {
				title: `Edit ${topic.title}`,
				action: routes.cms.topics.update.href({ id: topic.id }),
				mode: "edit",
				builtIn: isBuiltInTopic(topic.slug),
				path: topicPath(topic),
				values: {
					title: topic.title,
					slug: topic.slug,
					query: topic.query,
					description: topic.description,
				},
				error: null,
			});
		},

		/**
		 * Saves the form. A kind's topic writes its title and description only, whatever the
		 * form sends for its slug and query; a refused save re-renders the form with 422.
		 */
		async update(ctx) {
			let topic = await ctx.models.topics.find(ctx.params.id);
			if (topic === null) {
				return redirect(routes.cms.topics.index.href(), { status: redirect.Status.SeeOther });
			}

			let form = await validate(ctx.get(FormData), TopicSchema);
			succeeded(form, "Invalid topic form data");
			let builtIn = isBuiltInTopic(topic.slug);
			let values = builtIn
				? { title: form.data.title, description: form.data.description }
				: { ...form.data, slug: form.data.slug.trim() || slugify(form.data.title) };

			let saved = await ctx.models.topics.update(topic.id, values);
			if (isFailure(saved)) {
				return ctx.render(
					CMSTopicFormView,
					{
						title: `Edit ${topic.title}`,
						action: routes.cms.topics.update.href({ id: topic.id }),
						mode: "edit",
						builtIn,
						path: topicPath(topic),
						values: { ...form.data, ...(builtIn ? { slug: topic.slug, query: topic.query } : {}) },
						error: reason(saved.error),
					},
					{ status: 422 },
				);
			}
			return redirect(routes.cms.topics.edit.href({ id: topic.id }), {
				status: redirect.Status.SeeOther,
			});
		},

		/** Deletes an author's topic; the model refuses a kind's, which stays listed. */
		async destroy(ctx) {
			await ctx.models.topics.delete(ctx.params.id);
			return redirect(routes.cms.topics.index.href(), { status: redirect.Status.SeeOther });
		},
	},
});
