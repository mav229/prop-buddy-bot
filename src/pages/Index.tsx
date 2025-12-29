import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { EmbeddableChat } from "@/components/EmbeddableChat";

const Index = () => {
  const [showWidget, setShowWidget] = useState(true);

  return (
    <>
      <ChatInterface />
      
      {/* Floating Widget Test - for testing the embeddable widget */}
      {showWidget && (
        <div className="fixed bottom-6 right-6 z-[9999] w-14 h-14 sm:w-16 sm:h-16">
          <EmbeddableChat isWidget={true} />
        </div>
      )}
    </>
  );
};

export default Index;
