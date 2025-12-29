import { ChatInterface } from "@/components/ChatInterface";
import { WidgetTestEmbed } from "@/components/WidgetTestEmbed";

const Index = () => {
  return (
    <>
      <ChatInterface />
      {/* In-app tester that behaves like the real embed snippet */}
      <WidgetTestEmbed />
    </>
  );
};

export default Index;

