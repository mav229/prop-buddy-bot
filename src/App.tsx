import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WidgetConfigProvider } from "@/contexts/WidgetConfigContext";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Embed from "./pages/Embed";
import Widget from "./pages/Widget";
import EmbedChecker from "./pages/EmbedChecker";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WidgetConfigProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/chat" element={<Index />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/embed" element={<Embed />} />
            <Route path="/widget" element={<Widget />} />
            <Route path="/embed-checker" element={<EmbedChecker />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WidgetConfigProvider>
  </QueryClientProvider>
);

export default App;
