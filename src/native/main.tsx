import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { applyTheme, loadTheme } from "@/lib/flicro/theme";
import { NativeRoot } from "./root";

applyTheme(loadTheme());

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <NativeRoot />
    </StrictMode>,
  );
}
