import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Boundary, Screens } from "../shared/Screens";
function Screen({ screen }: { screen: "search" | "explore" }) {
  const go = useNavigate();
  return <Screens screen={screen} go={go} />;
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Screen screen="search" />} />
        <Route path="/explore" element={<Screen screen="explore" />} />
      </Routes>
    </BrowserRouter>
  </Boundary>,
);
