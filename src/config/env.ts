import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NETWORK_MODE: z.enum(["testnet", "mainnet"]).default("testnet"),
  PRIVATE_KEY: z.string().startsWith("0x").optional(),

  // Optional RPC endpoints
  RPC_BASE: z.string().url().optional(),
  RPC_OPTIMISM: z.string().url().optional(),
  RPC_ARBITRUM: z.string().url().optional(),
  RPC_POLYGON: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const isTestnet = config.NETWORK_MODE === "testnet";
