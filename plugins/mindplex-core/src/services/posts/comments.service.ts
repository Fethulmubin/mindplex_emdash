import type { PluginContext } from "emdash";
import type { ListCommentsParams } from "../../types/posts";

export async function listComments(
	ctx: PluginContext,
	params: ListCommentsParams & { postId: string | number },
) {
	const options: any = {
		limit: Math.min(params.limit ?? 10, 100),
		cursor: params.cursor,
		where: {
			post_id: params.postId,
		},
	};

	return ctx.content!.list("comments", options);
}
