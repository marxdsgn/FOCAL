import { createClient } from "@supabase/supabase-js";
import { SupabaseBucket } from "./storage.js";
import { createHandler, serve } from "./app.js";
const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
for (const name of required)
  if (!process.env[name])
    throw Error(
      `Missing ${name}. Add it to your hosting environment or local .env.`,
    );
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } =
  process.env;
const opts = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts),
  auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
const bucket = new SupabaseBucket(admin);
await bucket.ready();
const origin =
  process.env.APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:5173";
const handler = createHandler({
  bucket,
  origin,
  publicConfig: { supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY },
  verifyUser: async (token) => {
    const { data, error } = await auth.auth.getUser(token);
    return error ? null : data.user;
  },
  production: process.env.NODE_ENV === "production",
});
serve(handler, {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
});
console.log(`FOCAL running on port ${process.env.PORT || 3000}`);
