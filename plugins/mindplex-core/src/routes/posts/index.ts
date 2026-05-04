import { commentRoutes } from "./comments";
import { postRoutes } from "./post.routes";

export const postFeatureRoutes = {
	...postRoutes,
	...commentRoutes,
};

export { postRoutes, commentRoutes };
