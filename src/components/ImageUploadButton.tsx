import { useRef } from "react";
import { Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadButtonProps {
  onImageSelected: (base64: string, mimeType: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ImageUploadButton = ({ onImageSelected, disabled, className }: ImageUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a JPG, PNG, GIF, or WebP image.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Extract base64 data (remove data:image/xxx;base64, prefix)
      const base64 = result.split(",")[1];
      onImageSelected(base64, file.type);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
          "text-white/30 hover:text-white/60 hover:bg-white/5",
          disabled && "opacity-30 cursor-not-allowed",
          className
        )}
        title="Upload image"
      >
        <Image className="w-3.5 h-3.5" />
      </button>
    </>
  );
};
