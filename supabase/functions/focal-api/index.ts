import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { api } from "../../../worker/api.js";
import { SupabaseBucket } from "../../../server/storage.js";
import { createEdgeHandler } from "../../../server/edge-handler.js";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const publicKey =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
const privateKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !publicKey || !privateKey)
  throw new Error("Supabase function environment is incomplete.");
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const auth = createClient(supabaseUrl, publicKey, options);
const admin = createClient(supabaseUrl, privateKey, options);
const bucket = new SupabaseBucket(admin);

// verify_jwt remains enabled at the gateway. Re-verify here as public API keys
// can pass its compatibility check but are not authenticated player identities.
Deno.serve(
  createEdgeHandler({
    api,
    bucket,
    verifyUser: async (token: string) => {
      const { data, error } = await auth.auth.getUser(token);
      return error ? null : data.user;
    },
  }),
);
