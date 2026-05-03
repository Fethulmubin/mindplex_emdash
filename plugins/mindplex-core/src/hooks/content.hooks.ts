import type { PluginContext } from "emdash";

export const contentHooks = {
	"content:afterSave": {
		handler: async (event: any, ctx: PluginContext) => {
			if (event.collection === "posts") {
				ctx.log.info(`Hook: Post ${event.content.id} saved.`);
			}
		},
	},
};
