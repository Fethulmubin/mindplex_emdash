export type ListPostsParams = {
	type?: string;
	feed?: string;
	sort?: string;
	limit?: number;
	cursor?: string;
};

export type CreatePostInput = {
	title: string;
	content: unknown;
	slug?: string;
	status?: string;
	type: string;
	author?: string;
	excerpt?: string;
	comment_enabled?: boolean;
	is_editors_pick?: boolean;
	estimated_reading_minutes?: number;
	origin_resource?: string;
	published_at?: string;
};
