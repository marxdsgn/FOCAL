import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const content = read("supabase/functions/focal-api/index.ts")
  .replace('"../../../worker/api.js"', '"./api.js"')
  .replace('"../../../server/storage.js"', '"./storage.js"')
  .replace('"../../../server/edge-handler.js"', '"./edge-handler.js"');
const payload = {
  name: "focal-api",
  entrypoint_path: "index.ts",
  verify_jwt: true,
  files: [
    { name: "index.ts", content },
    { name: "api.js", content: read("worker/api.js") },
    { name: "storage.js", content: read("server/storage.js") },
    { name: "edge-handler.js", content: read("server/edge-handler.js") },
  ],
};
const destination = process.argv[2];
if (destination)
  fs.writeFileSync(destination, JSON.stringify(payload, null, 2) + "\n");
else process.stdout.write(JSON.stringify(payload));
