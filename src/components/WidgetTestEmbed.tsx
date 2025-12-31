import { useEffect, useRef } from "react";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";

/**
 * In-app widget embed tester.
 * Minimal: single container + single iframe + overlay button.
 * No nudge/notification popup.
 */
export function WidgetTestEmbed() {
  const { config } = useWidgetConfig();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const allowedOriginRef = useRef<string>(window.location.origin);

  // Send config updates to iframe whenever config changes
  useEffect(() => {
    if (!iframeRef.current) return;
    try {
      iframeRef.current.contentWindow?.postMessage(
        { type: "scholaris:config", config },
        allowedOriginRef.current
      );
    } catch {
      // ignore
    }
  }, [config]);

  useEffect(() => {
    const host = window.location.origin.replace(/\/+$/, "");
    const allowedOrigin = window.location.origin;

    const bubbleSize = window.matchMedia("(min-width: 640px)").matches ? 64 : 56;
    const requestedW = 384;
    const requestedH = 600;

    function calcExpandedW() {
      const maxW = Math.max(280, Math.floor(window.innerWidth * 0.92));
      return Math.min(requestedW, maxW);
    }

    function calcExpandedH() {
      const maxH = Math.max(360, Math.floor(window.innerHeight * 0.86));
      return Math.min(requestedH, maxH);
    }

    const container = document.createElement("div");
    container.setAttribute("data-scholaris-widget-test", "true");
    container.style.position = "fixed";
    container.style.right = "calc(16px + env(safe-area-inset-right))";
    container.style.bottom = "calc(16px + env(safe-area-inset-bottom))";
    container.style.zIndex = "2147483647";

    // Launcher button (real button + img)
    const launcherBtn = document.createElement("button");
    launcherBtn.type = "button";
    launcherBtn.setAttribute("aria-label", "Open Scholaris chat");
    launcherBtn.style.width = `${bubbleSize}px`;
    launcherBtn.style.height = `${bubbleSize}px`;
    launcherBtn.style.border = "none";
    launcherBtn.style.padding = "0";
    launcherBtn.style.margin = "0";
    launcherBtn.style.background = "transparent";
    launcherBtn.style.borderRadius = "9999px";
    launcherBtn.style.overflow = "hidden";
    launcherBtn.style.cursor = "pointer";

    const launcherImg = document.createElement("img");
    launcherImg.src = config.launcherLogoUrl;
    launcherImg.alt = "Chat";
    launcherImg.draggable = false;
    launcherImg.style.width = "100%";
    launcherImg.style.height = "100%";
    launcherImg.style.display = "block";
    launcherImg.style.objectFit = "cover";
    launcherImg.style.background = "transparent";
    launcherImg.style.borderRadius = "9999px";
    launcherBtn.appendChild(launcherImg);

    // Panel wrapper
    const panel = document.createElement("div");
    panel.style.display = "none";
    panel.style.overflow = "hidden";
    panel.style.background = "transparent";

    const iframe = document.createElement("iframe");
    iframe.src = `${host}/widget`;
    iframe.allow = "clipboard-write";
    iframe.title = "Scholaris chat widget";
    iframeRef.current = iframe;

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    iframe.style.overflow = "hidden";
    iframe.style.background = "#0b1020"; // Dark fallback

    panel.appendChild(iframe);
    container.appendChild(launcherBtn);
    container.appendChild(panel);
    document.body.appendChild(container);

    let isExpanded = false;

    function postToWidget(action: "expand" | "minimize") {
      try {
        iframe.contentWindow?.postMessage({ type: "scholaris:host", action }, allowedOrigin);
      } catch {
        // ignore
      }
    }

    function openPanel() {
      isExpanded = true;
      launcherBtn.style.display = "none";
      panel.style.display = "block";
      applySizing();
      postToWidget("expand");
    }

    function closePanel() {
      isExpanded = false;
      panel.style.display = "none";
      launcherBtn.style.display = "block";
      container.style.left = "auto";
      container.style.top = "auto";
      container.style.right = "calc(16px + env(safe-area-inset-right))";
      container.style.bottom = "calc(16px + env(safe-area-inset-bottom))";
      postToWidget("minimize");
    }

    function applySizing() {
      if (!isExpanded) return;

      const w = calcExpandedW();
      const h = calcExpandedH();

      const isSmall = window.innerWidth < 520;
      if (isSmall) {
        container.style.left = "0";
        container.style.right = "0";
        container.style.bottom = "0";
        container.style.top = "0";
        panel.style.width = "100vw";
        panel.style.height = "100dvh";
        panel.style.borderRadius = "0";
        iframe.style.borderRadius = "0";
      } else {
        container.style.left = "auto";
        container.style.top = "auto";
        container.style.right = "calc(16px + env(safe-area-inset-right))";
        container.style.bottom = "calc(16px + env(safe-area-inset-bottom))";
        panel.style.width = `${w}px`;
        panel.style.height = `${h}px`;
        panel.style.borderRadius = "16px";
        iframe.style.borderRadius = "16px";
      }

      iframe.style.boxShadow = "0 25px 60px -18px rgba(0,0,0,0.5)";
    }

    const onLauncherClick = () => openPanel();
    launcherBtn.addEventListener("click", onLauncherClick);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKeyDown);

    const onResize = () => applySizing();
    window.addEventListener("resize", onResize);

    const onMessage = (e: MessageEvent) => {
      if (!e || !e.data || typeof e.data !== "object") return;
      const data = e.data as { type?: string; action?: string };
      if (data.type !== "scholaris:widget") return;
      if (e.origin && e.origin !== allowedOrigin) return;
      if (data.action === "expanded") openPanel();
      if (data.action === "minimized") closePanel();
    };
    window.addEventListener("message", onMessage);

    const onIframeLoad = () => {
      postToWidget(isExpanded ? "expand" : "minimize");
      try {
        iframe.contentWindow?.postMessage({ type: "scholaris:config", config }, allowedOrigin);
      } catch {
        // ignore
      }
    };
    iframe.addEventListener("load", onIframeLoad);

    closePanel();

    return () => {
      iframe.removeEventListener("load", onIframeLoad);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("message", onMessage);
      launcherBtn.removeEventListener("click", onLauncherClick);
      container.remove();
    };
  }, [config]);


  return null;
}
