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
    setTimeout(() => {
      document.execCommand("selectAll", false, null);
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
    // Find all Slate editors on the page
    const editors = document.querySelectorAll('[role="textbox"][data-slate-editor="true"]');
    
    editors.forEach((editor) => {
      // Walk up to find the form or the main chat input wrapper
      let container = editor.closest('form') || editor.parentElement?.parentElement?.parentElement?.parentElement;
      if (!container) return;

      // Skip if already injected in this container
      if (container.querySelector(".ps-fix-btn")) return;

      // Strategy: Find the buttons area near the editor
      // Discord puts emoji/gif/sticker buttons in a sibling or nearby container
      let buttonsArea = null;

      // Look for buttons with known aria-labels anywhere in the container
      const allButtons = container.querySelectorAll('button[aria-label]');
      for (const b of allButtons) {
        const label = (b.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes("emoji") || label.includes("gif") || label.includes("sticker") ||
            label.includes("select emoji") || label.includes("open gif picker") ||
            label.includes("open sticker picker")) {
          buttonsArea = b.parentElement;
          break;
        }
      }

      // Fallback: look for button clusters outside the form but near it
      if (!buttonsArea) {
        // Try broader search - go up further
        let searchScope = container.parentElement || container;
        const broaderButtons = searchScope.querySelectorAll('button[aria-label]');
        for (const b of broaderButtons) {
          const label = (b.getAttribute("aria-label") || "").toLowerCase();
          if (label.includes("emoji") || label.includes("gif") || label.includes("sticker")) {
            buttonsArea = b.parentElement;
            break;
          }
        }
      }

      // Fallback 2: Find any div with multiple buttons near the editor
      if (!buttonsArea) {
        const editorParent = editor.closest('[class*="channelTextArea"]') || 
                             editor.closest('[class*="textArea"]') ||
                             editor.parentElement?.parentElement?.parentElement;
        if (editorParent) {
          const btns = editorParent.querySelectorAll('button');
          if (btns.length >= 2) {
            buttonsArea = btns[btns.length - 1].parentElement;
          }
        }
      }

      // Fallback 3: Just place it next to the editor itself
      if (!buttonsArea) {
        const editorWrapper = editor.parentElement;
        if (editorWrapper) {
          const fixBtn = createFixButton(editor);
          fixBtn.style.position = "absolute";
          fixBtn.style.right = "8px";
          fixBtn.style.top = "50%";
          fixBtn.style.transform = "translateY(-50%)";
          editorWrapper.style.position = "relative";
          editorWrapper.appendChild(fixBtn);
          console.log("[PropScholar Fix] ✦ Button injected (absolute position fallback)");
          return;
        }
      }

      if (!buttonsArea) return;

      const fixBtn = createFixButton(editor);
      buttonsArea.insertBefore(fixBtn, buttonsArea.firstChild);
      console.log("[PropScholar Fix] ✦ Button injected into Discord toolbar");
    });
  }

  // Observe DOM changes
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(injectButton, 300);
  });

  function init() {
    console.log("[PropScholar Fix] Extension loaded, looking for Discord editor...");
    injectButton();
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(injectButton, 3000);
  }

  if (document.readyState === "complete") {
    setTimeout(init, 2000);
  } else {
    window.addEventListener("load", () => setTimeout(init, 2000));
  }
})();
