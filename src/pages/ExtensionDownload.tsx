import { Button } from "@/components/ui/button";
import { Download, Chrome, Sparkles } from "lucide-react";

const ExtensionDownload = () => {
  const handleDownload = () => {
    fetch("/propscholar-fix.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "propscholar-fix.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground">PropScholar Fix</h1>
        <p className="text-muted-foreground">
          AI-powered Chrome extension for Discord moderators. Polish your messages before sending with one click.
        </p>
        <Button onClick={handleDownload} size="lg" className="gap-2">
          <Download className="w-4 h-4" />
          Download Extension
        </Button>
        <div className="text-left bg-muted/50 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Chrome className="w-4 h-4" /> Installation
          </h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Unzip the downloaded file</li>
            <li>Open <code className="bg-muted px-1.5 py-0.5 rounded text-xs">chrome://extensions</code></li>
            <li>Enable <strong>Developer mode</strong> (top-right toggle)</li>
            <li>Click <strong>Load unpacked</strong> → select the unzipped folder</li>
            <li>Open Discord → type a message → click <strong>✦</strong></li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ExtensionDownload;
