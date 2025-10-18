import { Camera, Type, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CaptureBarProps {
  onPhotoCapture: (file: File) => void;
  onTextInput: () => void;
  className?: string;
}

export function CaptureBar({ onPhotoCapture, onTextInput, className }: CaptureBarProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onPhotoCapture(file);
    }
  };

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50",
      "bg-card/95 backdrop-blur-md border-t border-card-border",
      "shadow-lg",
      className
    )}>
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-around gap-2">
          <div className="flex-1">
            <input
              type="file"
              id="photo-upload"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-photo-upload"
            />
            <label htmlFor="photo-upload" className="block">
              <Button
                type="button"
                variant="default"
                size="lg"
                className="w-full gap-2"
                onClick={() => document.getElementById('photo-upload')?.click()}
                data-testid="button-capture-photo"
              >
                <Camera className="h-5 w-5" />
                <span>Photo</span>
              </Button>
            </label>
          </div>

          <div className="flex-1">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full gap-2"
              onClick={onTextInput}
              data-testid="button-text-input"
            >
              <Type className="h-5 w-5" />
              <span>Text</span>
            </Button>
          </div>

          <div className="flex-1">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full gap-2"
              disabled
              data-testid="button-voice-input"
            >
              <Mic className="h-5 w-5" />
              <span>Voice</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
