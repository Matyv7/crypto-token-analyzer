import { z } from "zod";

const envSchema = z.object({
  OG_PRIVATE_KEY: z.string().startsWith("0x", "Private key must start with 0x"),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Environment validation failed:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Missing or invalid environment variables");
  }
  return result.data;
}
