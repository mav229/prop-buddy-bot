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
  const PAGE_ARM_DRAFT_EVENT = "ps-fix:arm-draft";
  const PAGE_CLEAR_DRAFT_EVENT = "ps-fix:clear-draft";
  const PAGE_DRAFT_STATE_EVENT = "ps-fix:draft-state";

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
    return (editor.innerText || editor.textContent || "").replace(/\u200b/g, "").trim();
  }

  function ensurePageBridge() {
    if (document.getElementById("ps-fix-page-bridge")) return;

    const script = document.createElement("script");
    script.id = "ps-fix-page-bridge";
    script.textContent = `
      (() => {
        if (window.__PROP_SCHOLAR_FIX_PAGE_BRIDGE__) return;
        window.__PROP_SCHOLAR_FIX_PAGE_BRIDGE__ = true;

        const ARM_EVENT = ${JSON.stringify("ps-fix:arm-draft")};
        const CLEAR_EVENT = ${JSON.stringify("ps-fix:clear-draft")};
        const STATE_EVENT = ${JSON.stringify("ps-fix:draft-state")};
        const MESSAGE_ROUTE = /\/channels\/[^/]+\/messages(?:\/[^/?]+)?(?:\?|$)/;

        let pendingDraft = null;

        function emitState(reason) {
          document.dispatchEvent(new CustomEvent(STATE_EVENT, {
            detail: {
              active: Boolean(pendingDraft && pendingDraft.text),
              text: pendingDraft?.text || '',
              reason,
            },
          }));
        }

        function shouldPatch(url, method) {
          return MESSAGE_ROUTE.test(String(url || '')) && ['POST', 'PATCH'].includes(String(method || 'GET').toUpperCase());
        }

        function patchBody(body, nextText) {
          if (typeof body !== 'string') return null;
          const trimmed = body.trim();
          if (!trimmed.startsWith('{')) return null;

          try {
            const parsed = JSON.parse(trimmed);
            if (!parsed || typeof parsed !== 'object' || typeof parsed.content !== 'string') return null;
            parsed.content = nextText;

            if (typeof parsed.validated_content === 'string') {
              parsed.validated_content = nextText;
            }

            if (typeof parsed.raw_content === 'string') {
              parsed.raw_content = nextText;
            }

            return JSON.stringify(parsed);
          } catch (_error) {
            return null;
          }
        }

        function currentDraft() {
          return pendingDraft && pendingDraft.text ? pendingDraft : null;
        }

        document.addEventListener(ARM_EVENT, (event) => {
          const nextText = String(event.detail?.text || '').trim();
          if (!nextText) {
            pendingDraft = null;
            emitState('cleared');
            return;
          }

          pendingDraft = {
            id: String(Date.now()) + Math.random().toString(36).slice(2),
            text: nextText,
            inFlight: false,
          };
          emitState('armed');
        });

        document.addEventListener(CLEAR_EVENT, () => {
          pendingDraft = null;
          emitState('cleared');
        });

        const nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
        if (nativeFetch) {
          window.fetch = async function(resource, init) {
            const draft = currentDraft();
            const url = typeof resource === 'string'
              ? resource
              : resource && typeof resource.url === 'string'
                ? resource.url
                : '';
            const method = String((init && init.method) || (resource && resource.method) || 'GET').toUpperCase();
            let applied = false;
            const activeDraftId = draft?.id;

            if (draft && !draft.inFlight && shouldPatch(url, method)) {
              try {
                const originalBody = init && Object.prototype.hasOwnProperty.call(init, 'body')
                  ? init.body
                  : resource instanceof Request
                    ? await resource.clone().text()
                    : null;
                const patchedBody = patchBody(originalBody, draft.text);

                if (patchedBody !== null) {
                  draft.inFlight = true;
                  applied = true;

                  if (resource instanceof Request && !(init && Object.prototype.hasOwnProperty.call(init, 'body'))) {
                    resource = new Request(resource, {
                      body: patchedBody,
                      method,
                    });
                  } else {
                    init = {
                      ...(init || {}),
                      method,
                      body: patchedBody,
                    };
                  }
                }
              } catch (_error) {}
            }

            try {
              const response = await nativeFetch(resource, init);

              if (applied && pendingDraft && pendingDraft.id === activeDraftId) {
                if (response.ok) {
                  pendingDraft = null;
                  emitState('sent');
                } else {
                  pendingDraft.inFlight = false;
                  emitState('error');
                }
              }

              return response;
            } catch (error) {
              if (applied && pendingDraft && pendingDraft.id === activeDraftId) {
                pendingDraft.inFlight = false;
                emitState('error');
              }
              throw error;
            }
          };
        }

        const nativeOpen = XMLHttpRequest.prototype.open;
        const nativeSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          this.__psFixMethod = method;
          this.__psFixUrl = url;
          return nativeOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function(body) {
          const draft = currentDraft();

          if (draft && !draft.inFlight && shouldPatch(this.__psFixUrl, this.__psFixMethod)) {
            const patchedBody = patchBody(body, draft.text);

            if (patchedBody !== null) {
              draft.inFlight = true;
              const activeDraftId = draft.id;

              this.addEventListener('loadend', () => {
                if (!pendingDraft || pendingDraft.id !== activeDraftId) return;

                if (this.status >= 200 && this.status < 300) {
                  pendingDraft = null;
                  emitState('sent');
                } else {
                  pendingDraft.inFlight = false;
                  emitState('error');
                }
              }, { once: true });

              body = patchedBody;
            }
          }

          return nativeSend.call(this, body);
        };
      })();
    `;

    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  function updatePendingDraft(text) {
    ensurePageBridge();
    document.dispatchEvent(new CustomEvent(PAGE_ARM_DRAFT_EVENT, {
      detail: { text: String(text || "") },
    }));
  }

  function clearPendingDraft() {
    ensurePageBridge();
    document.dispatchEvent(new CustomEvent(PAGE_CLEAR_DRAFT_EVENT));
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

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function positionPopup(popup) {
    const anchorEditorId = popup.dataset.anchorEditorId;
    const anchorButton = document.querySelector(`.ps-fix-btn[data-editor-id="${anchorEditorId}"]`);
    if (!anchorButton) return;

    const btnRect = anchorButton.getBoundingClientRect();
    const popupWidth = 340;
    popup.style.position = "fixed";
    popup.style.left = `${Math.min(window.innerWidth - popupWidth - 8, Math.max(8, btnRect.left - 160))}px`;
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

  function createDraftTray(editor, initialText) {
    removeDraftTray();

    const tray = document.createElement("div");
    tray.className = "ps-fix-draft-tray";
    tray.dataset.editorId = getEditorId(editor);

    const titleRow = document.createElement("div");
    titleRow.className = "ps-fix-draft-header";
    titleRow.innerHTML = '<div><div class="ps-fix-draft-title">AI draft armed</div><div class="ps-fix-draft-subtitle">Edit here, then press Enter / Send in Discord.</div></div><div class="ps-fix-draft-status" data-tone="ready">Ready for next send</div>';
    tray.appendChild(titleRow);

    const textarea = document.createElement("textarea");
    textarea.className = "ps-fix-draft-textarea";
    textarea.value = initialText;
    textarea.spellcheck = false;
    textarea.addEventListener("input", () => {
      const nextValue = textarea.value.trim();
      if (nextValue) {
        updatePendingDraft(nextValue);
        setDraftStatus(tray, "Ready for next send", "ready");
      } else {
        clearPendingDraft();
        setDraftStatus(tray, "Draft cleared", "muted");
      }
    });
    textarea.addEventListener("mousedown", (event) => event.stopPropagation());
    textarea.addEventListener("click", (event) => event.stopPropagation());
    tray.appendChild(textarea);

    const note = document.createElement("div");
    note.className = "ps-fix-draft-note";
    note.textContent = "Discord's composer stays untouched; the next sent or edited message will use this draft instead.";
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
      const copied = await copyText(textarea.value.trim());
      copyBtn.textContent = copied ? "Copied" : "Copy failed";
      window.setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ps-fix-draft-btn ps-fix-draft-btn-ghost";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearPendingDraft();
    });

    actions.appendChild(copyBtn);
    actions.appendChild(cancelBtn);
    tray.appendChild(actions);

    document.body.appendChild(tray);
    positionDraftTray(tray);
    updatePendingDraft(initialText);
    return tray;
  }

  function createPopup(options, editor, anchorButton) {
    removeExistingPopup();

    const popup = document.createElement("div");
    popup.className = "ps-fix-popup";
    popup.dataset.anchorEditorId = getEditorId(editor);

    const header = document.createElement("div");
    header.className = "ps-fix-popup-header";
    header.innerHTML = '<span class="ps-fix-popup-icon">✦</span><span>Pick a reply</span>';
    popup.appendChild(header);

    options.forEach((text) => {
      const row = document.createElement("div");
      row.className = "ps-fix-option";

      const isTruncated = text.length > TRUNCATE_LENGTH;
      const preview = isTruncated ? `${text.slice(0, TRUNCATE_LENGTH)}…` : text;

      const textSpan = document.createElement("span");
      textSpan.className = "ps-fix-option-text";
      textSpan.textContent = preview;
      textSpan.title = text;
      row.appendChild(textSpan);

      // Copy button for every option
      const copyBtn = document.createElement("button");
      copyBtn.className = "ps-fix-copy-btn";
      copyBtn.textContent = "📋";
      copyBtn.title = "Copy to clipboard";
      copyBtn.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
      copyBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const ok = await copyText(text);
        copyBtn.textContent = ok ? "✅" : "❌";
        setTimeout(() => { copyBtn.textContent = "📋"; }, 1200);
      });
      row.appendChild(copyBtn);

      if (isTruncated) {
        const dots = document.createElement("button");
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
        row.appendChild(dots);
      }

      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      row.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeExistingPopup();
        createDraftTray(editor, text);
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

      .ps-fix-popup,
      .ps-fix-draft-tray {
        background: #1e1f22; border: 1px solid #2b2d31;
        box-shadow: 0 8px 24px rgba(0,0,0,.6);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .ps-fix-popup {
        width: 340px; max-height: 320px; overflow-y: auto; padding: 6px; border-radius: 10px;
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
        color: #dbdee1; font-size: 13px; line-height: 1.45; user-select: none;
      }
      .ps-fix-option:hover { background: #2b2d31; }
      .ps-fix-option-text { flex: 1; word-break: break-word; }
      .ps-fix-option-text.ps-fix-expanded { white-space: pre-wrap; }
      .ps-fix-expand-btn {
        flex-shrink: 0; background: #2b2d31; border: none; color: #b5bac1;
        cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 12px;
        line-height: 1; margin-top: 2px; transition: background 0.12s, color 0.12s;
      }
      .ps-fix-expand-btn:hover { background: #383a40; color: #fff; }

      .ps-fix-copy-btn {
        flex-shrink: 0; background: none; border: none; cursor: pointer;
        padding: 2px 4px; font-size: 14px; line-height: 1; margin-top: 1px;
        opacity: 0.5; transition: opacity 0.15s;
      }
      .ps-fix-copy-btn:hover { opacity: 1; }
      .ps-fix-option-label {
        display: block; font-size: 10px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.5px; color: #949ba4; margin-bottom: 2px;
      }

      .ps-fix-draft-tray { padding: 12px; border-radius: 12px; }
      .ps-fix-draft-header {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px;
      }
      .ps-fix-draft-title { color: #f2f3f5; font-size: 13px; font-weight: 700; }
      .ps-fix-draft-subtitle { color: #949ba4; font-size: 12px; margin-top: 2px; }
      .ps-fix-draft-status {
        padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap;
      }
      .ps-fix-draft-status[data-tone="ready"] { color: #57f287; background: rgba(87, 242, 135, 0.12); }
      .ps-fix-draft-status[data-tone="error"] { color: #ed4245; background: rgba(237, 66, 69, 0.14); }
      .ps-fix-draft-status[data-tone="muted"] { color: #b5bac1; background: rgba(181, 186, 193, 0.12); }
      .ps-fix-draft-textarea {
        width: 100%; min-height: 120px; resize: vertical; border: 1px solid #2b2d31; border-radius: 10px;
        background: #111214; color: #f2f3f5; padding: 12px; font-size: 13px; line-height: 1.5; outline: none;
      }
      .ps-fix-draft-textarea:focus { border-color: #5865f2; box-shadow: 0 0 0 1px rgba(88, 101, 242, 0.35); }
      .ps-fix-draft-note { margin-top: 8px; color: #b5bac1; font-size: 11.5px; line-height: 1.4; }
      .ps-fix-draft-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
      .ps-fix-draft-btn {
        border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
      }
      .ps-fix-draft-btn-secondary { background: #5865f2; color: #fff; }
      .ps-fix-draft-btn-ghost { background: #2b2d31; color: #dbdee1; }
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

    button.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

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
          createDraftTray(editor, data.fixed);
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

    scheduleFloatingLayout();
  }

  function handleDraftState(event) {
    const detail = event.detail || {};
    const tray = document.querySelector(".ps-fix-draft-tray");
    if (!tray) return;

    if (!detail.active || detail.reason === "sent" || detail.reason === "cleared") {
      removeDraftTray();
      return;
    }

    const textarea = tray.querySelector(".ps-fix-draft-textarea");
    if (textarea && document.activeElement !== textarea && detail.text && textarea.value !== detail.text) {
      textarea.value = detail.text;
    }

    if (detail.reason === "error") {
      setDraftStatus(tray, "Send failed — draft kept", "error");
      return;
    }

    setDraftStatus(tray, "Ready for next send", "ready");
  }

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(injectButtons, 150);
  });

  function init() {
    ensurePageBridge();
    injectStyles();
    console.log("[PropScholar Fix] v1.5 workaround ready");
    injectButtons();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "class"] });
    document.addEventListener("focusin", injectButtons, true);
    document.addEventListener(PAGE_DRAFT_STATE_EVENT, handleDraftState);
    window.addEventListener("resize", scheduleFloatingLayout, { passive: true });
    window.addEventListener("scroll", scheduleFloatingLayout, true);
    setInterval(injectButtons, 2000);
  }

  if (document.readyState === "complete") setTimeout(init, 1200);
  else window.addEventListener("load", () => setTimeout(init, 1200));
})();
