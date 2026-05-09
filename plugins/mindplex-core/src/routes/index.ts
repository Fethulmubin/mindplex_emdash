import { authRoutes } from "./auth";
import { postFeatureRoutes } from "./posts";

export const routes = {
	...authRoutes,
	...postFeatureRoutes,
};
