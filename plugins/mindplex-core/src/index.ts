import type { PluginDescriptor } from "emdash";

export function mindplexCorePlugin(): PluginDescriptor {
  return {
    id: "mindplex-core",
    version: "1.0.0",
    format: "standard",
    entrypoint: "@mindplex/plugin-core/sandbox",
    capabilities: ["read:content", "write:content", "read:users"],
  };
}
