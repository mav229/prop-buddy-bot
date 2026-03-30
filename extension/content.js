// PropScholar Fix — Content Script for Discord
(function () {
  "use strict";

  if (window.__PROP_SCHOLAR_FIX_LOADED__) return;
  window.__PROP_SCHOLAR_FIX_LOADED__ = true;

  const API_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/functions/v1/discord-fix";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJ9.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E";
  const EDITOR_SELECTOR = [
    'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
    'div[role="textbox"][contenteditable="true"]',
    '[data-slate-editor="true"][role="textbox"]',
  ].join(", ");
  const TOOLBAR_LABEL_MATCHERS = ["emoji", "gif", "sticker", "gift", "apps"];

  let editorIdCounter = 0;

  function isVisible(element) {
    if (!element || !(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && styles.display !== "none" && styles.visibility !== "hidden";
  }

  function getEditorId(editor) {
    if (!editor.dataset.psFixEditorId) {
      editorIdCounter += 1;
      editor.dataset.psFixEditorId = `ps-editor-${editorIdCounter}`;
    }
    return editor.dataset.psFixEditorId;
  }

  function getEditorText(editor) {
    const slateStrings = editor.querySelectorAll('[data-slate-string="true"]');
    if (slateStrings.length > 0) {
      return Array.from(slateStrings)
        .map((node) => node.textContent || "")
        .join("\n")
        .replace(/\u200b/g, "")
        .trim();
    }

    return (editor.innerText || editor.textContent || "")
      .replace(/\u200b/g, "")
      .trim();
  }

  function setEditorText(editor, text) {
    editor.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const usedExecCommand = typeof document.execCommand === "function" && document.execCommand("insertText", false, text);

    if (!usedExecCommand) {
      editor.textContent = text;
    }

    editor.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text,
    }));

    editor.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text,
    }));
  }

  function createFixButton(editor) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ps-fix-btn";
    button.dataset.editorId = getEditorId(editor);
    button.setAttribute("aria-label", "PropScholar Fix");
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.flexShrink = "0";
    button.style.zIndex = "3";
    button.innerHTML = `
      <span class="ps-fix-icon">✦</span>
      <span class="ps-fix-tooltip">PropScholar Fix</span>
    `;

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const text = getEditorText(editor);
      if (!text) return;

      button.classList.add("ps-loading");

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || `Error ${response.status}`);
        }

        const data = await response.json();
        if (data.fixed) {
          setEditorText(editor, data.fixed);
          button.classList.add("ps-success");
          window.setTimeout(() => button.classList.remove("ps-success"), 1500);
        }
      } catch (error) {
        console.error("[PropScholar Fix]", error);
        button.style.color = "#ed4245";
        window.setTimeout(() => {
          button.style.color = "";
        }, 2000);
      } finally {
        button.classList.remove("ps-loading");
      }
    });

    return button;
  }

  function isDiscordMessageEditor(editor) {
    const ariaLabel = (editor.getAttribute("aria-label") || "").toLowerCase();
    const hasMessageLabel = ariaLabel.includes("message") || ariaLabel.includes("reply");
    const composerRoot = editor.closest("form") || editor.closest('[class*="channelTextArea"]') || editor.closest('[class*="textArea"]');
    return Boolean(composerRoot) && (hasMessageLabel || editor.getAttribute("role") === "textbox");
  }

  function findToolbarAnchor(editor) {
    const scopes = [
      editor.closest("form"),
      editor.closest('[class*="channelTextArea"]'),
      editor.closest('[class*="textArea"]'),
      editor.parentElement,
      editor.parentElement?.parentElement,
      editor.parentElement?.parentElement?.parentElement,
    ].filter(Boolean);

    for (const scope of scopes) {
      const buttons = scope.querySelectorAll('button[aria-label], [role="button"][aria-label]');
      for (const button of buttons) {
        const label = (button.getAttribute("aria-label") || "").toLowerCase();
        if (TOOLBAR_LABEL_MATCHERS.some((matcher) => label.includes(matcher)) && isVisible(button)) {
          return button;
        }
      }
    }

    return null;
  }

  function injectIntoToolbar(editor) {
    const editorId = getEditorId(editor);
    if (document.querySelector(`.ps-fix-btn[data-editor-id="${editorId}"]`)) return;

    const anchor = findToolbarAnchor(editor);
    if (anchor && anchor.parentElement) {
      const button = createFixButton(editor);
      anchor.insertAdjacentElement("beforebegin", button);
      console.log("[PropScholar Fix] Button injected before Discord toolbar action");
      return;
    }

    const fallbackContainer = editor.closest('[class*="scrollableContainer"]') || editor.parentElement;
    if (!fallbackContainer || fallbackContainer.querySelector(`.ps-fix-btn[data-editor-id="${editorId}"]`)) return;

    if (window.getComputedStyle(fallbackContainer).position === "static") {
      fallbackContainer.style.position = "relative";
    }

    const button = createFixButton(editor);
    button.style.position = "absolute";
    button.style.right = "88px";
    button.style.bottom = "10px";
    fallbackContainer.appendChild(button);
    console.log("[PropScholar Fix] Button injected with absolute fallback");
  }

  function injectButtons() {
    const editors = Array.from(document.querySelectorAll(EDITOR_SELECTOR));
    editors
      .filter(isVisible)
      .filter(isDiscordMessageEditor)
      .forEach(injectIntoToolbar);
  }

  let debounceTimer;
  const observer = new MutationObserver(() => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(injectButtons, 150);
  });

  function init() {
    console.log("[PropScholar Fix] Watching Discord composer...");
    injectButtons();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "class"],
    });
    document.addEventListener("focusin", injectButtons, true);
    window.setInterval(injectButtons, 2000);
  }

  if (document.readyState === "complete") {
    window.setTimeout(init, 1200);
  } else {
    window.addEventListener("load", () => window.setTimeout(init, 1200));
  }
})();
