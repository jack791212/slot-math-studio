import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const el = document.getElementById("root");
if (!el) throw new Error("找不到 #root 掛載點");
createRoot(el).render(<App />);
