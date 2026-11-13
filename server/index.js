import { createClient } from "@supabase/supabase-js";
import { SupabaseBucket } from "./storage.js";
import { createSupabaseApiProxy } from "./edge-proxy.js";
import { createHandler, serve } from "./app.js";
for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY"])
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
const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
let bucket, apiHandler;
if (SUPABASE_SERVICE_ROLE_KEY) {
  // Optional direct-server mode for a host where the owner supplies its secret.
  // The default Edge mode keeps this credential entirely inside Supabase.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);
  bucket = new SupabaseBucket(admin);
  await bucket.ready();
} else {
  apiHandler = createSupabaseApiProxy({
    functionUrl:
      process.env.SUPABASE_API_FUNCTION_URL ||
      new URL("/functions/v1/focal-api", SUPABASE_URL).href,
    supabaseUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  });
}
const origin =
  process.env.APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:5173";
const handler = createHandler({
  bucket,
  apiHandler,
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
