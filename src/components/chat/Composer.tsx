import { useRef } from "react";

type ComposerProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSend: () => void;
};

export function Composer({ value, placeholder, onChange, onSend }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="border-t border-border p-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={placeholder}
        aria-label="Message"
        className="max-h-40 w-full resize-none rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}
