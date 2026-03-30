// PropScholar Fix — Content Script for Discord
(function () {
  "use strict";

  if (window.__PROP_SCHOLAR_FIX_LOADED__) return;
  window.__PROP_SCHOLAR_FIX_LOADED__ = true;

  const API_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/functions/v1/discord-fix";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E";
  const EDITOR_SELECTOR = [
    'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
    'div[role="textbox"][contenteditable="true"]',
    '[data-slate-editor="true"][role="textbox"]',
  ].join(", ");
  const TOOLBAR_LABEL_MATCHERS = ["emoji", "gif", "sticker", "gift", "apps"];
  const TRUNCATE_LENGTH = 80;

  let editorIdCounter = 0;

  // ── Helpers ──

  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const r = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
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
      return Array.from(slateStrings).map((n) => n.textContent || "").join("\n").replace(/\u200b/g, "").trim();
    }
    return (editor.innerText || editor.textContent || "").replace(/\u200b/g, "").trim();
  }

  function normalizeComparableText(text) {
    return String(text || "").replace(/\r\n/g, "\n").replace(/\u200b/g, "").trim();
  }

  function selectEditorContents(editor) {
    editor.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function moveCaretToEnd(editor) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function waitForEditorFlush() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function createPasteEvent(text) {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", text);

    let pasteEvent;
    try {
      pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      });
    } catch {
      pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    }

    if (!pasteEvent.clipboardData) {
      Object.defineProperty(pasteEvent, "clipboardData", {
        value: clipboardData,
      });
    }

    return pasteEvent;
  }

  async function setEditorText(editor, text) {
    const nextText = String(text || "").replace(/\r\n/g, "\n");
    const comparableNextText = normalizeComparableText(nextText);
    const previousText = normalizeComparableText(getEditorText(editor));

    selectEditorContents(editor);
    editor.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteByCut",
    }));
    if (typeof document.execCommand === "function") {
      document.execCommand("delete", false);
    }
    editor.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteByCut",
    }));
    await waitForEditorFlush();

    selectEditorContents(editor);
    editor.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertFromPaste",
      data: nextText,
    }));
    editor.dispatchEvent(createPasteEvent(nextText));
    editor.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertFromPaste",
      data: nextText,
    }));
    await waitForEditorFlush();

    if (normalizeComparableText(getEditorText(editor)) === comparableNextText) {
      moveCaretToEnd(editor);
      return true;
    }

    selectEditorContents(editor);
    const inserted = typeof document.execCommand === "function" && document.execCommand("insertText", false, nextText);
    if (!inserted) {
      editor.textContent = nextText;
    }

    editor.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: nextText,
    }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    await waitForEditorFlush();
    moveCaretToEnd(editor);

    const finalText = normalizeComparableText(getEditorText(editor));
    return finalText === comparableNextText && finalText !== previousText;
  }

  async function requestReplyOptions(text) {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "ps-fix-generate", text }, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || "Extension message failed"));
            return;
          }

          if (!response) {
            reject(new Error("No response from extension background"));
            return;
          }

          if (!response.ok) {
            reject(new Error(response.error || "Reply generation failed"));
            return;
          }

          resolve(response.data);
        });
      });
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Error ${response.status}`);
    }

    return await response.json();
  }

  // ── Popup UI ──

  function removeExistingPopup() {
    const existing = document.querySelector(".ps-fix-popup");
    if (existing) existing.remove();
  }

  function createPopup(options, editor, anchorButton) {
    removeExistingPopup();

    const popup = document.createElement("div");
    popup.className = "ps-fix-popup";

    const header = document.createElement("div");
    header.className = "ps-fix-popup-header";
    header.innerHTML = `<span class="ps-fix-popup-icon">✦</span><span>Pick a reply</span>`;
    popup.appendChild(header);

    options.forEach((text, i) => {
      const row = document.createElement("div");
      row.className = "ps-fix-option";

      const isTruncated = text.length > TRUNCATE_LENGTH;
      const preview = isTruncated ? text.slice(0, TRUNCATE_LENGTH) + "…" : text;

      const textSpan = document.createElement("span");
      textSpan.className = "ps-fix-option-text";
      textSpan.textContent = preview;
      textSpan.title = text;
      row.appendChild(textSpan);

      if (isTruncated) {
        const dots = document.createElement("button");
        dots.className = "ps-fix-expand-btn";
        dots.textContent = "•••";
        dots.title = "Show full reply";
        dots.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        dots.addEventListener("click", (e) => {
          e.stopPropagation();
          if (textSpan.textContent === text) {
            textSpan.textContent = preview;
            textSpan.classList.remove("ps-fix-expanded");
          } else {
            textSpan.textContent = text;
            textSpan.classList.add("ps-fix-expanded");
          }
        });
        row.appendChild(dots);
      }

      row.addEventListener("mousedown", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        row.classList.add("ps-fix-option-pending");
        const replaced = await setEditorText(editor, text);
        row.classList.remove("ps-fix-option-pending");

        if (replaced) {
          removeExistingPopup();
          return;
        }

        anchorButton.style.color = "#ed4245";
        setTimeout(() => { anchorButton.style.color = ""; }, 2000);
      });

      popup.appendChild(row);
    });

    // Position near the button
    document.body.appendChild(popup);
    const btnRect = anchorButton.getBoundingClientRect();
    popup.style.position = "fixed";
    const popupLeft = Math.min(window.innerWidth - 348, Math.max(8, btnRect.left - 160));
    popup.style.left = `${popupLeft}px`;
    popup.style.bottom = `${window.innerHeight - btnRect.top + 8}px`;
    popup.style.zIndex = "999999";

    // Close on outside click
    const closeHandler = (e) => {
      if (!popup.contains(e.target) && e.target !== anchorButton) {
        removeExistingPopup();
        document.removeEventListener("mousedown", closeHandler, true);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", closeHandler, true), 50);

    return popup;
  }

  // ── Inject CSS ──

  function injectStyles() {
    if (document.getElementById("ps-fix-styles")) return;
    const style = document.createElement("style");
    style.id = "ps-fix-styles";
    style.textContent = `
      .ps-fix-btn {
        display: inline-flex; align-items: center; justify-content: center;
        flex-shrink: 0; z-index: 3; background: none; border: none;
        cursor: pointer; padding: 4px; border-radius: 4px; position: relative;
        color: #b5bac1; transition: color 0.15s, transform 0.1s;
      }
      .ps-fix-btn:hover { color: #fff; transform: scale(1.1); }
      .ps-fix-icon { font-size: 20px; line-height: 1; }
      .ps-fix-tooltip {
        display: none; position: absolute; bottom: calc(100% + 6px); left: 50%;
        transform: translateX(-50%); background: #111214; color: #dbdee1;
        font-size: 12px; padding: 6px 10px; border-radius: 6px; white-space: nowrap;
        pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,.5);
      }
      .ps-fix-btn:hover .ps-fix-tooltip { display: block; }
      .ps-fix-btn.ps-loading .ps-fix-icon { animation: ps-spin 0.8s linear infinite; }
      .ps-fix-btn.ps-success .ps-fix-icon { color: #57f287; }
      @keyframes ps-spin { to { transform: rotate(360deg); } }

      .ps-fix-popup {
        background: #1e1f22; border: 1px solid #2b2d31; border-radius: 10px;
        width: 340px; max-height: 320px; overflow-y: auto; padding: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,.6); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .ps-fix-popup-header {
        display: flex; align-items: center; gap: 6px; padding: 8px 10px 6px;
        color: #b5bac1; font-size: 11px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .ps-fix-popup-icon { font-size: 14px; color: #5865f2; }
      .ps-fix-option {
        display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px;
        border-radius: 6px; cursor: pointer; transition: background 0.12s;
        color: #dbdee1; font-size: 13px; line-height: 1.45;
      }
      .ps-fix-option.ps-fix-option-pending { opacity: 0.6; pointer-events: none; }
      .ps-fix-option:hover { background: #2b2d31; }
      .ps-fix-option-text { flex: 1; word-break: break-word; }
      .ps-fix-option-text.ps-fix-expanded { white-space: pre-wrap; }
      .ps-fix-expand-btn {
        flex-shrink: 0; background: #2b2d31; border: none; color: #b5bac1;
        cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 12px;
        line-height: 1; margin-top: 2px; transition: background 0.12s, color 0.12s;
      }
      .ps-fix-expand-btn:hover { background: #383a40; color: #fff; }
    `;
    document.head.appendChild(style);
  }

  // ── Button creation ──

  function createFixButton(editor) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ps-fix-btn";
    button.dataset.editorId = getEditorId(editor);
    button.setAttribute("aria-label", "PropScholar Fix");
    button.innerHTML = `<span class="ps-fix-icon">✦</span><span class="ps-fix-tooltip">PropScholar Fix</span>`;

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      // If popup is already open, close it
      if (document.querySelector(".ps-fix-popup")) {
        removeExistingPopup();
        return;
      }

      const text = getEditorText(editor);
      if (!text) return;

      button.classList.add("ps-loading");

      try {
        const data = await requestReplyOptions(text);

        if (data.options && Array.isArray(data.options)) {
          createPopup(data.options, editor, button);
        } else if (data.fixed) {
          // Backward compat
          setEditorText(editor, data.fixed);
          button.classList.add("ps-success");
          setTimeout(() => button.classList.remove("ps-success"), 1500);
        }
      } catch (error) {
        console.error("[PropScholar Fix]", error);
        button.style.color = "#ed4245";
        setTimeout(() => { button.style.color = ""; }, 2000);
      } finally {
        button.classList.remove("ps-loading");
      }
    });

    return button;
  }

  // ── Injection logic ──

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
      for (const btn of buttons) {
        const label = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (TOOLBAR_LABEL_MATCHERS.some((m) => label.includes(m)) && isVisible(btn)) return btn;
      }
    }
    return null;
  }

  function injectIntoToolbar(editor) {
    const editorId = getEditorId(editor);
    if (document.querySelector(`.ps-fix-btn[data-editor-id="${editorId}"]`)) return;

    const anchor = findToolbarAnchor(editor);
    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement("beforebegin", createFixButton(editor));
      return;
    }

    const fallback = editor.closest('[class*="scrollableContainer"]') || editor.parentElement;
    if (!fallback || fallback.querySelector(`.ps-fix-btn[data-editor-id="${editorId}"]`)) return;
    if (window.getComputedStyle(fallback).position === "static") fallback.style.position = "relative";

    const btn = createFixButton(editor);
    btn.style.position = "absolute";
    btn.style.right = "88px";
    btn.style.bottom = "10px";
    fallback.appendChild(btn);
  }

  function injectButtons() {
    Array.from(document.querySelectorAll(EDITOR_SELECTOR))
      .filter(isVisible)
      .filter(isDiscordMessageEditor)
      .forEach(injectIntoToolbar);
  }

  // ── Observer ──

  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(injectButtons, 150);
  });

  function init() {
    injectStyles();
    console.log("[PropScholar Fix] Watching Discord composer...");
    injectButtons();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "class"] });
    document.addEventListener("focusin", injectButtons, true);
    setInterval(injectButtons, 2000);
  }

  if (document.readyState === "complete") setTimeout(init, 1200);
  else window.addEventListener("load", () => setTimeout(init, 1200));
})();
