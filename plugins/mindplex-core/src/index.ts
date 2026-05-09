import type { PluginDescriptor } from "emdash";

export function mindplexCorePlugin(): PluginDescriptor {
  return {
    id: "mindplex-core",
    version: "1.0.0",
    format: "standard",
    entrypoint: "@mindplex/plugin-core/sandbox",
    capabilities: ["read:content", "write:content", "read:users", "network:fetch"],
    allowedHosts: ["oauth2.googleapis.com", "www.googleapis.com", "accounts.google.com"],
    storage: {
      users: { indexes: ["email", "username"] },
      user_profiles: { indexes: ["userId"] },
      user_preferences: { indexes: ["userId"] },
      user_notification_settings: { indexes: ["userId"] },
      user_social_auths: { indexes: ["provider", "providerId", "userId", ["provider", "providerId"]] },
      refresh_tokens: { indexes: ["token", "familyId", "userId"] },
      activation_tokens: { indexes: ["token", "userId"] },
    },
  };
}
