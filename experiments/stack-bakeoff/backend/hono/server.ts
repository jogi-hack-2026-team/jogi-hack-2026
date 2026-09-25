import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { migrate } from "../shared/database.ts";
await migrate();
serve({ fetch: createApp().fetch, hostname: "127.0.0.1", port: 4310 });
