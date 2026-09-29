import { createApp } from "../backend/fastify/app.ts";
import { migrate } from "../backend/shared/database.ts";
await migrate();
await createApp().listen({ host: "127.0.0.1", port: 4310 });
