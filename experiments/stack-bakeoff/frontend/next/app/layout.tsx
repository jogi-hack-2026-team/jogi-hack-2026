import React from "react";
import { Boundary } from "../../shared/Screens";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Boundary>{children}</Boundary>
      </body>
    </html>
  );
}
