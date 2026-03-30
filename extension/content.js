// PropScholar Fix — Content Script for Discord
(function () {
  "use strict";

  const API_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/functions/v1/discord-fix";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E";

  let injectedEditors = new WeakSet();

  // Get text from Discord's Slate editor
  function getEditorText(editor) {
    // Discord uses Slate — text lives in spans with data-slate-string
    const strings = editor.querySelectorAll('[data-slate-string="true"]');
    if (strings.length === 0) return "";
    return Array.from(strings).map(s => s.textContent).join("\n");
  }

  // Set text in Discord's Slate editor
  function setEditorText(editor, text) {
    // Focus the editor
    editor.focus();

    // Select all content
    document.execCommand("selectAll", false, null);

    // Small delay to ensure selection registers
    setTimeout(() => {
      // Insert the new text via execCommand which works with contentEditable
      document.execCommand("insertText", false, text);
    }, 50);
  }

  // Create the Fix button
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
        // Brief red flash on error
        btn.style.color = "#ed4245";
        setTimeout(() => { btn.style.color = ""; }, 2000);
      } finally {
        btn.classList.remove("ps-loading");
      }
    });

    return btn;
  }

  // Find toolbar and inject button
  function injectButton() {
    // Discord's message editors
    const editors = document.querySelectorAll('[role="textbox"][data-slate-editor="true"]');

    editors.forEach((editor) => {
      if (injectedEditors.has(editor)) return;

      // Find the buttons toolbar near this editor
      // Discord structures: form > div > div(toolbar with buttons)
      const form = editor.closest("form");
      if (!form) return;

      // Look for the button toolbar — it contains emoji/gif/sticker buttons
      const toolbarButtons = form.querySelectorAll('button[class*="button"]');
      if (toolbarButtons.length === 0) return;

      // Find the buttons container (parent of the rightmost toolbar buttons)
      const lastButton = toolbarButtons[toolbarButtons.length - 1];
      const buttonsContainer = lastButton.parentElement;
      if (!buttonsContainer) return;

      // Check if we already injected here
      if (buttonsContainer.querySelector(".ps-fix-btn")) {
        injectedEditors.add(editor);
        return;
      }

      const fixBtn = createFixButton(editor);
      // Insert before the first button in the toolbar
      buttonsContainer.insertBefore(fixBtn, buttonsContainer.firstChild);
      injectedEditors.add(editor);
    });
  }

  // Observe DOM changes to re-inject when Discord re-renders
  const observer = new MutationObserver(() => {
    injectButton();
  });

  // Start observing once Discord loads
  function init() {
    injectButton();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Wait for Discord to fully load
  if (document.readyState === "complete") {
    setTimeout(init, 2000);
  } else {
    window.addEventListener("load", () => setTimeout(init, 2000));
  }
})();
