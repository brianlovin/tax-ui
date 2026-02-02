import { useEffect, useState, useRef } from "react";
import { cn } from "../lib/cn";

interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
  minChars?: number;
}

const DIGIT_CHARS = "0123456789";

export function AnimatedNumber({
  value,
  format,
  className,
  duration = 0.4,
  minChars,
}: AnimatedNumberProps) {
  const text = format(value);
  const [displayText, setDisplayText] = useState(text);
  const prevValueRef = useRef(value);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any existing animation
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Skip animation if value hasn't changed (same numeric value)
    if (prevValueRef.current === value) {
      setDisplayText(text);
      return;
    }

    // Update ref for next comparison
    prevValueRef.current = value;

    // Start scramble animation
    const speed = 0.03;
    const steps = Math.ceil(duration / speed);
    let step = 0;

    intervalRef.current = setInterval(() => {
      let scrambled = "";
      const progress = step / steps;

      for (let i = 0; i < text.length; i++) {
        const char = text[i]!;
        // Keep non-digit characters static ($ , . K M etc)
        if (!/\d/.test(char)) {
          scrambled += char;
          continue;
        }

        // Reveal digits progressively from left to right
        if (progress * text.length > i) {
          scrambled += char;
        } else {
          scrambled += DIGIT_CHARS[Math.floor(Math.random() * DIGIT_CHARS.length)];
        }
      }

      setDisplayText(scrambled);
      step++;

      if (step > steps) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setDisplayText(text);
      }
    }, speed * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [value, text, duration]);

  return (
    <span
      className={cn(className)}
      style={minChars ? { minWidth: `${minChars}ch` } : undefined}
    >
      {displayText}
    </span>
  );
}
