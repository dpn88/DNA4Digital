import React from "react";
import { createRoot } from "react-dom/client";
import StaggeredMenu from "./StaggeredMenu.jsx";

/** Mount all .dna-stgm elements placed by the shortcode */
export function mount(selector = ".dna-stgm", defaults = {}) {
  document.querySelectorAll(selector).forEach((el) => {
    const props = el.dataset.props ? JSON.parse(el.dataset.props) : {};
    const root  = createRoot(el);
    root.render(<StaggeredMenu {...defaults} {...props} />);
  });
}

// Auto-mount on DOM ready
const run = () => mount();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}

// Provide a global for optional manual mounting
window.DNA4DReact = { mount };
