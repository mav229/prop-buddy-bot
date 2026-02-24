import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export const VoiceInput = ({ onTranscript, disabled, className }: VoiceInputProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [partialText, setPartialText] = useState("");
  const scribeRef = useRef<any>(null);
  const committedTextRef = useRef("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scribeRef.current) {
        try { scribeRef.current.disconnect(); } catch {}
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (disabled || isConnecting) return;
    setIsConnecting(true);
    committedTextRef.current = "";
    setPartialText("");

    try {
      // Get token from edge function
      const tokenUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-scribe-token`;
      const tokenResp = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!tokenResp.ok) throw new Error("Failed to get scribe token");
      const { token } = await tokenResp.json();

      // Dynamically import to avoid SSR issues
      const { useScribe } = await import("@elevenlabs/react");
      
      // Since useScribe is a hook, we need a different approach
      // Use the WebSocket API directly for non-hook usage
      const ws = new WebSocket(
        `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=${token}&language_code=en`
      );

      // Set up audio capture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      let wsReady = false;

      ws.onopen = () => {
        wsReady = true;
        setIsListening(true);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "partial_transcript" && data.text) {
            setPartialText(committedTextRef.current + " " + data.text);
          } else if (data.type === "committed_transcript" && data.text) {
            committedTextRef.current = (committedTextRef.current + " " + data.text).trim();
            setPartialText(committedTextRef.current);
          }
        } catch {}
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        cleanup();
      };

      ws.onclose = () => {
        cleanup();
      };

      processor.onaudioprocess = (e) => {
        if (!wsReady || ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        // Convert to base64
        const bytes = new Uint8Array(int16.buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        try {
          ws.send(JSON.stringify({
            type: "audio",
            data: base64,
          }));
        } catch {}
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      const cleanup = () => {
        setIsListening(false);
        setIsConnecting(false);
        try { processor.disconnect(); } catch {}
        try { source.disconnect(); } catch {}
        try { audioContext.close(); } catch {}
        stream.getTracks().forEach((t) => t.stop());
        if (ws.readyState === WebSocket.OPEN) ws.close();
      };

      scribeRef.current = {
        disconnect: () => {
          // Finalize and send committed text
          const finalText = committedTextRef.current.trim();
          if (finalText) {
            onTranscript(finalText);
          }
          cleanup();
          setPartialText("");
          committedTextRef.current = "";
        },
      };
    } catch (err) {
      console.error("Voice input error:", err);
      setIsConnecting(false);
      setIsListening(false);
    }
  }, [disabled, isConnecting, onTranscript]);

  const stopListening = useCallback(() => {
    if (scribeRef.current) {
      scribeRef.current.disconnect();
      scribeRef.current = null;
    }
  }, []);

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isConnecting}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
          isListening
            ? "bg-red-500 text-white animate-pulse"
            : "text-white/30 hover:text-white/60 hover:bg-white/5",
          disabled && "opacity-30 cursor-not-allowed",
          className
        )}
        title={isListening ? "Stop recording" : "Voice input"}
      >
        {isConnecting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isListening ? (
          <MicOff className="w-3.5 h-3.5" />
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
      </button>
      {/* Floating transcript preview */}
      {isListening && partialText && (
        <div className="absolute bottom-full mb-2 right-0 w-64 rounded-xl border border-[hsl(0,0%,16%)] bg-[hsl(0,0%,8%)] px-3 py-2 text-[11px] text-white/60 font-light shadow-xl z-50">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Listening...</span>
          </div>
          <p className="line-clamp-3">{partialText}</p>
        </div>
      )}
    </div>
  );
};
