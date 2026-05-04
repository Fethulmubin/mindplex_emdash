import type { PluginContext } from "emdash";
import type { CreatePostInput, ListPostsParams } from "../../types/posts";

export async function getPosts(ctx: PluginContext, params: ListPostsParams) {
	const options: any = {
		limit: Math.min(params.limit ?? 10, 100),
		cursor: params.cursor,
		where: {
			status: "published",
		},
	};

	if (params.type) {
		options.where.type = params.type;
	}

	if (params.feed === "editors-pick") {
		options.where.is_editors_pick = true;
	}

	return ctx.content!.list("posts", options);
}

export async function createPost(ctx: PluginContext, input: CreatePostInput) {
	return ctx.content!.create!("posts", {
		title: input.title,
		content: input.content || "",
		excerpt: input.excerpt,
		estimated_reading_minutes: input.estimated_reading_minutes,
		type: input.type || "article",
		author: input.author_id,
		slug: input.slug || undefined,
		status: input.status || "draft",
	});
}

function extractListItems(result: any) {
	if (Array.isArray(result)) return result;
	if (Array.isArray(result?.items)) return result.items;
	if (Array.isArray(result?.data)) return result.data;
	return [];
}

export async function getPostByIdentifier(ctx: PluginContext, identifier: string) {
	const where: any = {};
	if (/^\d+$/.test(identifier)) {
		where.id = Number(identifier);
	} else {
		where.slug = identifier;
	}

	const result = await ctx.content!.list("posts", { limit: 1, where });
	const items = extractListItems(result);

	return items[0] || null;
}
