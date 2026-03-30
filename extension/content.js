// PropScholar Fix — Content Script for Discord
(function () {
  "use strict";

  const API_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/functions/v1/discord-fix";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E";

  // Get text from Discord's Slate editor
  function getEditorText(editor) {
    const strings = editor.querySelectorAll('[data-slate-string="true"]');
    if (strings.length === 0) return "";
    return Array.from(strings).map(s => s.textContent).join("\n");
  }

  // Set text in Discord's Slate editor
  function setEditorText(editor, text) {
    editor.focus();
    // Select all
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    sel.removeAllRanges();
    sel.addRange(range);

    // Use InputEvent to work with Slate's event system
    setTimeout(() => {
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }, 50);
  }

  // Create the Fix button matching Discord's button style
  function createFixButton(editor) {
    const btn = document.createElement("button");
    btn.className = "ps-fix-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "PropScholar Fix");
    btn.innerHTML = `
      <span class="ps-fix-icon">✦</span>
      <span class="ps-fix-tooltip">PropScholar Fix</span>
    `;

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const text = getEditorText(editor);
      if (!text.trim()) return;

      btn.classList.add("ps-loading");

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Error ${res.status}`);
        }

        const data = await res.json();
        if (data.fixed) {
          setEditorText(editor, data.fixed);
          btn.classList.add("ps-success");
          setTimeout(() => btn.classList.remove("ps-success"), 1500);
        }
      } catch (err) {
        console.error("[PropScholar Fix]", err);
        btn.style.color = "#ed4245";
        setTimeout(() => { btn.style.color = ""; }, 2000);
      } finally {
        btn.classList.remove("ps-loading");
      }
    });

    return btn;
  }

  // Find and inject into Discord's toolbar
  function injectButton() {
    // Target the main chat form's toolbar buttons
    // Discord's structure: form contains the editor and a buttons area
    const forms = document.querySelectorAll('form');
    
    forms.forEach((form) => {
      // Must have a Slate editor inside
      const editor = form.querySelector('[role="textbox"][data-slate-editor="true"]');
      if (!editor) return;

      // Skip if already injected
      if (form.querySelector(".ps-fix-btn")) return;

      // Strategy 1: Find buttons by aria-label (most reliable)
      const knownButtons = form.querySelectorAll('button[aria-label]');
      if (knownButtons.length === 0) return;

      // Find the container that holds emoji/gif/sticker buttons
      // These are typically in a div next to or near the editor
      let buttonsContainer = null;
      
      for (const btn of knownButtons) {
        const label = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes("emoji") || label.includes("gif") || label.includes("sticker") || 
            label.includes("select emoji") || label.includes("open gif")) {
          buttonsContainer = btn.parentElement;
          break;
        }
      }

      if (!buttonsContainer) {
        // Fallback: find any button cluster near the bottom of the form
        const allBtns = form.querySelectorAll('button');
        if (allBtns.length > 0) {
          const lastBtn = allBtns[allBtns.length - 1];
          buttonsContainer = lastBtn.parentElement;
        }
      }

      if (!buttonsContainer) return;

      const fixBtn = createFixButton(editor);
      // Insert at the beginning of the toolbar
      buttonsContainer.insertBefore(fixBtn, buttonsContainer.firstChild);
      
      console.log("[PropScholar Fix] ✦ Button injected into Discord toolbar");
    });
  }

  // Observe DOM changes to re-inject when Discord re-renders (SPA navigation)
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(injectButton, 300);
  });

  function init() {
    console.log("[PropScholar Fix] Extension loaded, looking for Discord editor...");
    injectButton();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    // Also periodically check in case MutationObserver misses something
    setInterval(injectButton, 3000);
  }

  // Wait for Discord to fully load
  if (document.readyState === "complete") {
    setTimeout(init, 3000);
  } else {
    window.addEventListener("load", () => setTimeout(init, 3000));
  }
})();
