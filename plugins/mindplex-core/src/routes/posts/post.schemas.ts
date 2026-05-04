export type PostListQuery = {
	type?: string;
	feed?: string;
	sort?: string;
	limit?: number;
	cursor?: string;
};

export type PostIdentifierParam = {
	identifier: string;
};
