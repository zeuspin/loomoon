import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { CreoorApp } from "./app/CreoorApp";
import "./app/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <CreoorApp />
  </StrictMode>,
);

