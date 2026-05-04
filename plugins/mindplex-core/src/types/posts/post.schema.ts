export type ListPostsParams = {
	type?: string;
	feed?: string;
	sort?: string;
	limit?: number;
	cursor?: string;
};

export type CreatePostInput = {
	title: string;
	content?: string;
	slug?: string;
	status?: string;
	type?: string;
	author_id?: string;
	excerpt?: string;
	estimated_reading_minutes?: number;
};
