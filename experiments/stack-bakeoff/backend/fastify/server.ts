import { createApp } from "./app.ts";
import { migrate } from "../shared/database.ts";
await migrate();
await createApp().listen({ host: "127.0.0.1", port: 4311 });
