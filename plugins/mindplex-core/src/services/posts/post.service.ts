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

    const slug = input.slug?.trim() || generateSlug(input.title);

    let publishedAt: string | undefined;
    if (input.published_at) {
        publishedAt = new Date(input.published_at).toISOString();
    } else if (input.status === "published") {
        publishedAt = new Date().toISOString();
    }

    const payload: any = {
        title: input.title,
		content: typeof input.content === 'string' 
            ? [{ _type: 'block', children: [{ _type: 'span', text: input.content }] }] 
            : input.content,
        // content: input.content,
        type: input.type,
        slug: slug, 
        status: input.status || "draft",
        published_at: publishedAt,
        excerpt: input.excerpt,
        author: input.author,
        comment_enabled: input.comment_enabled ?? true,
        is_editors_pick: input.is_editors_pick ?? false,
        estimated_reading_minutes: input.estimated_reading_minutes || 0,
        origin_resource: input.origin_resource,
    };
    
    try {
        if (!ctx.content) throw new Error("Content service is not initialized in PluginContext");
        const result = await ctx.content.create!("posts", payload);
        return result;
    } catch (e: any) {
        ctx.log.error(`[createPost] Error: ${e.message}`);
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
