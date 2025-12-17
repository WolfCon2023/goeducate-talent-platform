import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(20).optional(),
  // Comma-separated list of allowed origins. Example:
  // "http://localhost:3000,https://talent.goeducateinc.org"
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000")
});

export type Env = z.infer<typeof EnvSchema>;

export type ResolvedEnv = Omit<Env, "MONGODB_URI" | "JWT_SECRET"> & {
  MONGODB_URI: string;
  JWT_SECRET: string;
};

export function getEnv(): ResolvedEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  const env = parsed.data;
  const isProd = env.NODE_ENV === "production";

  const withDefaults: ResolvedEnv = {
    ...env,
    MONGODB_URI: env.MONGODB_URI ?? "mongodb://localhost:27017/goeducate_talent",
    JWT_SECRET: env.JWT_SECRET ?? "dev_secret_change_me_please_1234567890"
  };

  if (isProd) {
    if (!env.MONGODB_URI) throw new Error("Missing MONGODB_URI in production");
    if (!env.JWT_SECRET) throw new Error("Missing JWT_SECRET in production");
  }

  return withDefaults;
}


