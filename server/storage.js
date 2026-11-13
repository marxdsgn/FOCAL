import { randomUUID } from "node:crypto";
/** R2-compatible persistence backed by a private Supabase table and photo bucket. */
export class SupabaseBucket {
  constructor(client, bucket = "focal-photos") {
    this.client = client;
    this.bucket = bucket;
  }
  async ready() {
    const { error } = await this.client
      .from("focal_objects")
      .select("key")
      .limit(1);
    if (error)
      throw Error(
        "Database unavailable. Apply supabase/migrations/001_focal.sql to your Supabase project.",
      );
  }
  async get(key) {
    const { data, error } = await this.client
      .from("focal_objects")
      .select("*")
      .eq("key", key)
      .maybeSingle();
    if (error) throw Error("Could not read storage.");
    if (!data) return null;
    let body = data.body;
    if (data.binary_path) {
      const result = await this.client.storage
        .from(this.bucket)
        .download(data.binary_path);
      if (result.error) throw Error("Could not load photograph.");
      body = new Uint8Array(await result.data.arrayBuffer());
    }
    return {
      etag: data.etag,
      body,
      httpMetadata: data.http_metadata || {},
      customMetadata: data.custom_metadata || {},
      json: async () => JSON.parse(data.body),
    };
  }
  async put(key, value, options = {}) {
    const binary = value instanceof Uint8Array || value instanceof ArrayBuffer;
    let binaryPath = null;
    if (binary) {
      binaryPath = key;
      const { error } = await this.client.storage
        .from(this.bucket)
        .upload(binaryPath, value, {
          contentType:
            options.httpMetadata?.contentType || "application/octet-stream",
          upsert: false,
        });
      if (error) throw Error("Could not save photograph.");
    }
    const etag = randomUUID();
    const { data, error } = await this.client.rpc("focal_put_object", {
      p_key: key,
      p_body: binary ? null : String(value),
      p_binary_path: binaryPath,
      p_etag: etag,
      p_http_metadata: options.httpMetadata || {},
      p_custom_metadata: options.customMetadata || {},
      p_match: options.onlyIf?.etagMatches || null,
      p_absent: options.onlyIf?.etagDoesNotMatch === "*",
    });
    if (error) {
      if (binaryPath)
        await this.client.storage.from(this.bucket).remove([binaryPath]);
      throw Error("Could not update storage.");
    }
    return data ? { etag: data } : null;
  }
  async list({ prefix = "", limit = 100 }) {
    const { data, error } = await this.client
      .from("focal_objects")
      .select("key")
      .gte("key", prefix)
      .lt("key", prefix + "\uffff")
      .order("key")
      .limit(Math.min(limit, 100));
    if (error) throw Error("Could not list storage.");
    return { objects: data || [] };
  }
}
