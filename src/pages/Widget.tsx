import { useEffect } from "react";
import { EmbeddableChat } from "@/components/EmbeddableChat";

const Widget = () => {
  // Add widget-mode class for transparent background
  useEffect(() => {
    // Apply to both html and body for full transparency
    document.documentElement.classList.add("widget-mode");
    document.body.classList.add("widget-mode");
    document.documentElement.style.background = "transparent";
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.background = "transparent";
    document.body.style.backgroundColor = "transparent";
    
    const root = document.getElementById("root");
    if (root) {
      root.style.background = "transparent";
      root.style.backgroundColor = "transparent";
    }
    
    return () => {
      document.documentElement.classList.remove("widget-mode");
      document.body.classList.remove("widget-mode");
    };
  }, []);

  return <EmbeddableChat isWidget={true} />;
};

export default Widget;
