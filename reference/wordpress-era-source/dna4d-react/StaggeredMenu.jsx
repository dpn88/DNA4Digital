import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./style.css";

export default function StaggeredMenu({
  items = [],
  label = "Menu",
  align = "right",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current) return;
      if (open && !ref.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const container = {
    open: {
      height: "auto",
      opacity: 1,
      transition: { when: "beforeChildren", delayChildren: 0.05, staggerChildren: 0.06 },
    },
    closed: {
      height: 0,
      opacity: 0,
      transition: {
        when: "afterChildren",
        staggerChildren: 0.05,
        staggerDirection: -1,
        height: { duration: 0.22 },
        opacity: { duration: 0.18 },
      },
    },
  };

  const item = {
    open:   { opacity: 1, y: 0,  scale: 1,    filter: "blur(0px)", transition: { duration: 0.22 } },
    closed: { opacity: 0, y: 8,  scale: 0.98, filter: "blur(2px)", transition: { duration: 0.18 } },
  };

  return (
    <div className="stgm-root" ref={ref}>
      <button
        className="stgm-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="stgm-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <svg className={`stgm-caret ${open ? "open" : ""}`} width="14" height="14" viewBox="0 0 20 20">
          <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id="stgm-panel"
            role="menu"
            className={`stgm-panel ${align === "left" ? "left" : "right"}`}
            initial="closed"
            animate="open"
            exit="closed"
            variants={container}
          >
            {items.map((it, i) => (
              <motion.li key={i} role="none" variants={item} className="stgm-item">
                <a role="menuitem" href={it.href} className="stgm-link" onClick={() => setOpen(false)}>
                  {it.label}
                </a>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
