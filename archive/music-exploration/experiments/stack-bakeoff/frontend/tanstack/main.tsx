import React from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { Boundary, Screens } from "../shared/Screens";
const root = createRootRoute({
  component: Outlet,
  validateSearch: (s: Record<string, unknown>): { mode?: "live" } => ({
    mode: s.mode === "live" ? "live" : undefined,
  }),
});
function Screen({ screen }: { screen: "search" | "explore" }) {
  const navigate = useNavigate();
  return (
    <Boundary>
      <Screens
        screen={screen}
        go={(path) => {
          const u = new URL(path, location.origin);
          void navigate({
            to: u.pathname === "/explore" ? "/explore" : "/",
            search: {
              mode: u.searchParams.get("mode") === "live" ? "live" : undefined,
            },
          });
        }}
      />
    </Boundary>
  );
}
const index = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: () => <Screen screen="search" />,
});
const explore = createRoute({
  getParentRoute: () => root,
  path: "/explore",
  component: () => <Screen screen="explore" />,
});
const router = createRouter({ routeTree: root.addChildren([index, explore]) });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <RouterProvider router={router} />
  </Boundary>,
);
