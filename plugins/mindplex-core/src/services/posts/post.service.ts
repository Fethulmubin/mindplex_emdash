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


function generateSlug(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export async function createPost(ctx: PluginContext, input: CreatePostInput) {
	ctx.log.info(`[createPost] Starting creation for title: ${input.title}`);
	/*
	const slug = input.slug?.trim() || generateSlug(input.title);
	ctx.log.info(`[createPost] Generated slug: ${slug}`);

	const existing = await ctx.content!.list("posts", { limit: 1, where: { slug } });
	const existingItems = extractListItems(existing);
	ctx.log.info(`[createPost] Checked existing items for slug ${slug}. Found ${existingItems.length} items`);
	if (existingItems.length > 0) {
		ctx.log.info(`[createPost] The matched item is: ${JSON.stringify(existingItems[0])}`);
	}
	
	if (existingItems.length > 0) {
		ctx.log.info(`[createPost] Conflicting slug found. Aborting.`);
		const r = new Response(JSON.stringify({ error: "A post with this slug already exists" }), {
			status: 409,
			headers: { "Content-Type": "application/json" },
		});
		throw r;
	}
	*/

	let publishedAt: string | undefined;
	if (input.published_at) {
		publishedAt = new Date(input.published_at).toISOString();
	} else if (input.status === "published") {
		publishedAt = new Date().toISOString();
	}

	const payload: any = {
		title: input.title,
		content: input.content,
		type: input.type,
		// slug,
		status: input.status || "draft",
		published_at: publishedAt,
		excerpt: input.excerpt,
		author: input.author,
		comment_enabled: input.comment_enabled,
		is_editors_pick: input.is_editors_pick,
		estimated_reading_minutes: input.estimated_reading_minutes,
		origin_resource: input.origin_resource,
	};
	if (input.slug?.trim()) {
		payload.slug = input.slug.trim();
	}
	
	ctx.log.info(`[createPost] Sending payload to ctx.content.create: ${JSON.stringify(payload)}`);
	
	try {
		const result = await ctx.content!.create!("posts", payload);
		ctx.log.info(`[createPost] Result from create!: ${JSON.stringify(result)}`);
		return result;
	} catch (e: any) {
		ctx.log.error(`[createPost] Error calling create!: ${e.message}`, { error: e });
		throw e;
	}
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
