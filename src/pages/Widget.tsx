import { EmbeddableChat } from "@/components/EmbeddableChat";
import { useEffect } from "react";

const Widget = () => {
  // Force transparent background on html/body for iframe embedding
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  return <EmbeddableChat isWidget={true} />;
};

export default Widget;
