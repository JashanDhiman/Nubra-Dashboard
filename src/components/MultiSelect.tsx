'use client';

import { useState, useEffect, useRef } from 'react';

interface MultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ value, onChange, options, placeholder = "Select options...", className = "" }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(item => item !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const removeOption = (option: string) => {
    onChange(value.filter(item => item !== option));
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected Items Display */}
      <div
        className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-surface-2 text-foreground font-mono text-xs cursor-pointer min-h-[32px] flex items-center flex-wrap gap-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value.length === 0 ? (
          <span className="text-text-muted">{placeholder}</span>
        ) : (
          value.map((item) => (
            <span
              key={item}
              className="px-1.5 py-0.5 bg-accent-muted/20 text-accent-green rounded text-xs font-mono flex items-center gap-1"
            >
              {item}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeOption(item);
                }}
                className="text-accent-green/70 hover:text-accent-green"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-surface-1 border border-border rounded shadow-lg max-h-48 overflow-y-auto">
          <div className="p-1">
            {options.map((option) => (
              <div
                key={option}
                onClick={() => toggleOption(option)}
                className="px-2 py-1.5 hover:bg-surface-2 cursor-pointer flex items-center gap-2 text-xs font-mono text-foreground"
              >
                <input
                  type="checkbox"
                  checked={value.includes(option)}
                  onChange={() => { }}
                  className="w-3 h-3 text-primary bg-surface-2 border-border rounded focus:ring-primary"
                />
                <span className={value.includes(option) ? "text-accent-green" : "text-foreground"}>
                  {option}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
