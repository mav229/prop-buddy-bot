import { useSearchParams } from "react-router-dom";
import { DiscordConnectWidget } from "@/components/DiscordConnectWidget";

const DiscordWidget = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
      <DiscordConnectWidget emailOverride={email} />
    </div>
  );
};

export default DiscordWidget;
