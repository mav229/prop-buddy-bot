// PropScholar Fix — Content Script for Discord
(function () {
  "use strict";

  if (window.__PROP_SCHOLAR_FIX_LOADED__) return;
  window.__PROP_SCHOLAR_FIX_LOADED__ = true;

  const EDITOR_SELECTOR = [
    'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
    'div[role="textbox"][contenteditable="true"]',
    '[data-slate-editor="true"][role="textbox"]',
  ].join(", ");
  const TOOLBAR_LABEL_MATCHERS = ["emoji", "gif", "sticker", "gift", "apps"];
  const TRUNCATE_LENGTH = 80;

  let editorIdCounter = 0;
  let debounceTimer;
  let floatingLayoutTimer;

  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
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

    const API_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/functions/v1/discord-fix";
    const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E";

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
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Error ${response.status}`);
    }

    return await response.json();
  }

  function removeExistingPopup() {
    const existing = document.querySelector(".ps-fix-popup");
    if (existing) existing.remove();
  }

  function removeDraftTray() {
    const existing = document.querySelector(".ps-fix-draft-tray");
    if (existing) existing.remove();
  }

  function closeFloatingUI() {
    removeExistingPopup();
    removeDraftTray();
  }

  async function copyText(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_error) {}

    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      textarea.style.top = "0";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch (_error) {
      return false;
    }
  }

  function positionPopup(popup) {
    const anchorEditorId = popup.dataset.anchorEditorId;
    const anchorButton = document.querySelector(`.ps-fix-btn[data-editor-id="${anchorEditorId}"]`);
    if (!anchorButton) return;

    const btnRect = anchorButton.getBoundingClientRect();
    const popupWidth = 360;
    popup.style.position = "fixed";
    popup.style.left = `${Math.min(window.innerWidth - popupWidth - 8, Math.max(8, btnRect.left - 180))}px`;
    popup.style.bottom = `${window.innerHeight - btnRect.top + 8}px`;
    popup.style.zIndex = "999999";
  }

  function positionDraftTray(tray) {
    const editorId = tray.dataset.editorId;
    const editor = document.querySelector(`[data-ps-fix-editor-id="${editorId}"]`);
    if (!editor) return;

    const rect = editor.getBoundingClientRect();
    const trayWidth = Math.min(420, window.innerWidth - 24);
    tray.style.position = "fixed";
    tray.style.width = `${trayWidth}px`;
    tray.style.left = `${Math.min(window.innerWidth - trayWidth - 12, Math.max(12, rect.left))}px`;
    tray.style.bottom = `${window.innerHeight - rect.top + 12}px`;
    tray.style.zIndex = "999999";
  }

  function scheduleFloatingLayout() {
    window.clearTimeout(floatingLayoutTimer);
    floatingLayoutTimer = window.setTimeout(() => {
      const popup = document.querySelector(".ps-fix-popup");
      if (popup) positionPopup(popup);

      const tray = document.querySelector(".ps-fix-draft-tray");
      if (tray) positionDraftTray(tray);
    }, 20);
  }

  function setDraftStatus(tray, statusText, tone) {
    const status = tray.querySelector(".ps-fix-draft-status");
    if (!status) return;
    status.textContent = statusText;
    status.dataset.tone = tone;
  }

  function flashFixButton(button, tone) {
    if (!button) return;

    if (tone === "success") {
      button.classList.add("ps-success");
      window.setTimeout(() => button.classList.remove("ps-success"), 1200);
      return;
    }

    if (tone === "error") {
      button.classList.add("ps-error");
      window.setTimeout(() => button.classList.remove("ps-error"), 1600);
    }
  }

  function createDraftTray(editor, initialText, anchorButton) {
    removeDraftTray();
    removeExistingPopup();

    const tray = document.createElement("div");
    tray.className = "ps-fix-draft-tray";
    tray.dataset.editorId = getEditorId(editor);

    const titleRow = document.createElement("div");
    titleRow.className = "ps-fix-draft-header";
    titleRow.innerHTML = '<div><div class="ps-fix-draft-title">Edit before copying</div><div class="ps-fix-draft-subtitle">Optional — tweak the reply, then copy it.</div></div><div class="ps-fix-draft-status" data-tone="ready">Ready to copy</div>';
    tray.appendChild(titleRow);

    const textarea = document.createElement("textarea");
    textarea.className = "ps-fix-draft-textarea";
    textarea.value = initialText;
    textarea.spellcheck = false;
    textarea.addEventListener("input", () => {
      const hasText = Boolean(textarea.value.trim());
      setDraftStatus(tray, hasText ? "Ready to copy" : "Type something to copy", hasText ? "ready" : "muted");
    });
    textarea.addEventListener("mousedown", (event) => event.stopPropagation());
    textarea.addEventListener("click", (event) => event.stopPropagation());
    tray.appendChild(textarea);

    const note = document.createElement("div");
    note.className = "ps-fix-draft-note";
    note.textContent = "Click Copy, then paste it into Discord.";
    tray.appendChild(note);

    const actions = document.createElement("div");
    actions.className = "ps-fix-draft-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "ps-fix-draft-btn ps-fix-draft-btn-secondary";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const nextText = textarea.value.trim();
      if (!nextText) {
        setDraftStatus(tray, "Nothing to copy", "muted");
        return;
      }

      const copied = await copyText(nextText);
      if (copied) {
        setDraftStatus(tray, "Copied to clipboard", "ready");
        copyBtn.textContent = "Copied";
        flashFixButton(anchorButton, "success");
        window.setTimeout(removeDraftTray, 180);
        return;
      }

      setDraftStatus(tray, "Copy failed — try again", "error");
      copyBtn.textContent = "Copy failed";
      flashFixButton(anchorButton, "error");
      window.setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ps-fix-draft-btn ps-fix-draft-btn-ghost";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeDraftTray();
    });

    actions.appendChild(copyBtn);
    actions.appendChild(closeBtn);
    tray.appendChild(actions);

    document.body.appendChild(tray);
    positionDraftTray(tray);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    return tray;
  }

  function createPopup(options, editor, anchorButton) {
    removeExistingPopup();

    const popup = document.createElement("div");
    popup.className = "ps-fix-popup";
    popup.dataset.anchorEditorId = getEditorId(editor);

    const header = document.createElement("div");
    header.className = "ps-fix-popup-header";
    header.innerHTML = '<span class="ps-fix-popup-icon">✦</span><div><div class="ps-fix-popup-title">Pick a reply</div><div class="ps-fix-popup-subtitle">Click any option to copy instantly.</div></div>';
    popup.appendChild(header);

    const labels = ["⚡ Short", "📝 Detailed", "💛 Empathetic"];

    options.forEach((text, idx) => {
      const row = document.createElement("div");
      row.className = "ps-fix-option";

      const isTruncated = text.length > TRUNCATE_LENGTH;
      const preview = isTruncated ? `${text.slice(0, TRUNCATE_LENGTH)}…` : text;

      const textWrap = document.createElement("div");
      textWrap.className = "ps-fix-option-main";

      const labelSpan = document.createElement("span");
      labelSpan.className = "ps-fix-option-label";
      labelSpan.textContent = labels[idx] || "";

      const textSpan = document.createElement("span");
      textSpan.className = "ps-fix-option-text";
      textSpan.textContent = preview;
      textSpan.title = text;

      textWrap.appendChild(labelSpan);
      textWrap.appendChild(textSpan);
      row.appendChild(textWrap);

      const actions = document.createElement("div");
      actions.className = "ps-fix-option-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "ps-fix-edit-btn";
      editBtn.textContent = "Edit";
      editBtn.title = "Edit before copying";
      editBtn.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      editBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        createDraftTray(editor, text, anchorButton);
      });
      actions.appendChild(editBtn);

      if (isTruncated) {
        const dots = document.createElement("button");
        dots.type = "button";
        dots.className = "ps-fix-expand-btn";
        dots.textContent = "•••";
        dots.title = "Show full reply";
        dots.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        dots.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (textSpan.textContent === text) {
            textSpan.textContent = preview;
            textSpan.classList.remove("ps-fix-expanded");
          } else {
            textSpan.textContent = text;
            textSpan.classList.add("ps-fix-expanded");
          }
        });
        actions.appendChild(dots);
      }

      row.appendChild(actions);

      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      row.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const copied = await copyText(text);
        if (copied) {
          removeExistingPopup();
          flashFixButton(anchorButton, "success");
          return;
        }

        flashFixButton(anchorButton, "error");
        const tray = createDraftTray(editor, text, anchorButton);
        setDraftStatus(tray, "Clipboard blocked — edit and copy manually", "error");
      });

      popup.appendChild(row);
    });

    popup.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    document.body.appendChild(popup);
    positionPopup(popup);

    const closeHandler = (event) => {
      if (!popup.contains(event.target) && event.target !== anchorButton) {
        removeExistingPopup();
        document.removeEventListener("mousedown", closeHandler, true);
      }
    };

    window.setTimeout(() => document.addEventListener("mousedown", closeHandler, true), 50);
    return popup;
  }

  function injectStyles() {
    if (document.getElementById("ps-fix-styles")) return;

    const style = document.createElement("style");
    style.id = "ps-fix-styles";
    style.textContent = `
      .ps-fix-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        z-index: 3;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        position: relative;
        color: #b5bac1;
        transition: color 0.15s, transform 0.1s;
      }

      .ps-fix-btn:hover {
        color: #fff;
        transform: scale(1.1);
      }

      .ps-fix-icon {
        font-size: 20px;
        line-height: 1;
      }

      .ps-fix-tooltip {
        display: none;
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: #111214;
        color: #dbdee1;
        font-size: 12px;
        padding: 6px 10px;
        border-radius: 6px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      }

      .ps-fix-btn:hover .ps-fix-tooltip {
        display: block;
      }

      .ps-fix-btn.ps-loading .ps-fix-icon {
        animation: ps-spin 0.8s linear infinite;
      }

      .ps-fix-btn.ps-success .ps-fix-icon {
        color: #57f287;
      }

      .ps-fix-btn.ps-error .ps-fix-icon {
        color: #ed4245;
      }

      @keyframes ps-spin {
        to {
          transform: rotate(360deg);
        }
      }

      .ps-fix-popup,
      .ps-fix-draft-tray {
        background: #1e1f22;
        border: 1px solid #2b2d31;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .ps-fix-popup {
        width: 360px;
        max-height: 340px;
        overflow-y: auto;
        padding: 6px;
        border-radius: 10px;
      }

      .ps-fix-popup-header {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 10px 8px;
        color: #b5bac1;
      }

      .ps-fix-popup-icon {
        font-size: 14px;
        color: #5865f2;
        margin-top: 2px;
      }

      .ps-fix-popup-title {
        color: #f2f3f5;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .ps-fix-popup-subtitle {
        color: #949ba4;
        font-size: 11px;
        margin-top: 2px;
      }

      .ps-fix-option {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.12s;
        color: #dbdee1;
        font-size: 13px;
        line-height: 1.45;
        user-select: none;
      }

      .ps-fix-option:hover {
        background: #2b2d31;
      }

      .ps-fix-option-main {
        flex: 1;
        min-width: 0;
      }

      .ps-fix-option-label {
        display: block;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #949ba4;
        margin-bottom: 2px;
      }

      .ps-fix-option-text {
        display: block;
        word-break: break-word;
      }

      .ps-fix-option-text.ps-fix-expanded {
        white-space: pre-wrap;
      }

      .ps-fix-option-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .ps-fix-edit-btn {
        flex-shrink: 0;
        background: #2b2d31;
        border: none;
        color: #dbdee1;
        cursor: pointer;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        transition: background 0.12s, color 0.12s;
      }

      .ps-fix-edit-btn:hover,
      .ps-fix-expand-btn:hover {
        background: #383a40;
        color: #fff;
      }

      .ps-fix-expand-btn {
        flex-shrink: 0;
        background: #2b2d31;
        border: none;
        color: #b5bac1;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1;
        margin-top: 1px;
        transition: background 0.12s, color 0.12s;
      }

      .ps-fix-draft-tray {
        padding: 12px;
        border-radius: 12px;
      }

      .ps-fix-draft-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }

      .ps-fix-draft-title {
        color: #f2f3f5;
        font-size: 13px;
        font-weight: 700;
      }

      .ps-fix-draft-subtitle {
        color: #949ba4;
        font-size: 12px;
        margin-top: 2px;
      }

      .ps-fix-draft-status {
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }

      .ps-fix-draft-status[data-tone="ready"] {
        color: #57f287;
        background: rgba(87, 242, 135, 0.12);
      }

      .ps-fix-draft-status[data-tone="error"] {
        color: #ed4245;
        background: rgba(237, 66, 69, 0.14);
      }

      .ps-fix-draft-status[data-tone="muted"] {
        color: #b5bac1;
        background: rgba(181, 186, 193, 0.12);
      }

      .ps-fix-draft-textarea {
        width: 100%;
        min-height: 120px;
        resize: vertical;
        border: 1px solid #2b2d31;
        border-radius: 10px;
        background: #111214;
        color: #f2f3f5;
        padding: 12px;
        font-size: 13px;
        line-height: 1.5;
        outline: none;
      }

      .ps-fix-draft-textarea:focus {
        border-color: #5865f2;
        box-shadow: 0 0 0 1px rgba(88, 101, 242, 0.35);
      }

      .ps-fix-draft-note {
        margin-top: 8px;
        color: #b5bac1;
        font-size: 11.5px;
        line-height: 1.4;
      }

      .ps-fix-draft-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 10px;
      }

      .ps-fix-draft-btn {
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .ps-fix-draft-btn-secondary {
        background: #5865f2;
        color: #fff;
      }

      .ps-fix-draft-btn-ghost {
        background: #2b2d31;
        color: #dbdee1;
      }
    `;

    document.head.appendChild(style);
  }

  function createFixButton(editor) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ps-fix-btn";
    button.dataset.editorId = getEditorId(editor);
    button.setAttribute("aria-label", "PropScholar Fix");
    button.innerHTML = '<span class="ps-fix-icon">✦</span><span class="ps-fix-tooltip">PropScholar Fix</span>';

    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (document.querySelector(".ps-fix-popup") || document.querySelector(".ps-fix-draft-tray")) {
        closeFloatingUI();
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
          const copied = await copyText(data.fixed);
          if (copied) {
            flashFixButton(button, "success");
          } else {
            const tray = createDraftTray(editor, data.fixed, button);
            setDraftStatus(tray, "Clipboard blocked — copy manually", "error");
            flashFixButton(button, "error");
          }
        }
      } catch (error) {
        console.error("[PropScholar Fix]", error);
        flashFixButton(button, "error");
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
      for (const btn of buttons) {
        const label = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (TOOLBAR_LABEL_MATCHERS.some((matcher) => label.includes(matcher)) && isVisible(btn)) return btn;
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

    scheduleFloatingLayout();
  }

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(injectButtons, 150);
  });

  function init() {
    injectStyles();
    console.log("[PropScholar Fix] v1.6 copy-first flow ready");
    injectButtons();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "class"] });
    document.addEventListener("focusin", injectButtons, true);
    window.addEventListener("resize", scheduleFloatingLayout, { passive: true });
    window.addEventListener("scroll", scheduleFloatingLayout, true);
    setInterval(injectButtons, 2000);
  }

  if (document.readyState === "complete") setTimeout(init, 1200);
  else window.addEventListener("load", () => setTimeout(init, 1200));
})();
