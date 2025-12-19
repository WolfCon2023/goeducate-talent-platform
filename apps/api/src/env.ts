import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(20).optional(),
  // Optional. If set, allows one-time bootstrapping of the first admin user.
  // Recommended: set it temporarily, bootstrap, then remove it.
  BOOTSTRAP_ADMIN_KEY: z.string().min(20).optional(),
  // Comma-separated list of allowed origins. Example:
  // "http://localhost:3000,https://talent.goeducateinc.org"
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),

  // Cloudinary (optional). If set, enables signed video uploads from the web app.
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_FOLDER: z.string().min(1).optional(),

  // Email (optional). If set, invite emails will be sent via SMTP.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_SECURE: z.coerce.boolean().optional(), // true for 465, false for 587 typically
  INVITE_FROM_EMAIL: z.string().email().optional(),
  WEB_APP_URL: z.string().url().optional()
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


