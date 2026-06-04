"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  id: string;
  name: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "blue" | "green" | "gold" | "red" | "default";
}

interface ComboboxProps {
  label?: string;
  placeholder?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  emptyMessage?: string;
  fallbackName?: string;
  helperText?: string;
  allowCustom?: boolean;
}

function getBadgeClasses(variant?: string): string {
  switch (variant) {
    case "blue":
      return "bg-accent-blue/15 text-accent-blue border-accent-blue/30";
    case "green":
      return "bg-accent-green/15 text-accent-green border-accent-green/30";
    case "gold":
      return "bg-accent-gold/15 text-accent-gold border-accent-gold/30";
    case "red":
      return "bg-accent-red/15 text-accent-red border-accent-red/30";
    default:
      return "bg-bg-tertiary text-text-secondary border-border-default";
  }
}

export function Combobox({
  label,
  placeholder = "Select or type to search...",
  options,
  value,
  onChange,
  disabled = false,
  error,
  emptyMessage = "No options found",
  fallbackName,
  helperText,
  allowCustom = false,
}: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.id === value) || null,
    [options, value]
  );

  const displayName = selectedOption?.name ?? (allowCustom && value ? value : fallbackName);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const lower = query.toLowerCase();
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(lower) ||
        (o.subtitle && o.subtitle.toLowerCase().includes(lower))
    );
  }, [options, query]);

  useEffect(() => {
    if (displayName && !open && !query) {
      setQuery(displayName);
    }
  }, [displayName, open, query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (displayName) {
          setQuery(displayName);
        } else {
          setQuery("");
        }
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [displayName]);

  useEffect(() => {
    if (open) {
      setActiveIndex(filteredOptions.length > 0 ? 0 : -1);
    }
  }, [open, filteredOptions.length]);

  function handleSelect(option: ComboboxOption) {
    onChange(option.id);
    setQuery(option.name);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleClear() {
    onChange("");
    setQuery("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setActiveIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIndex >= 0 && activeIndex < filteredOptions.length) {
        handleSelect(filteredOptions[activeIndex]);
      } else if (allowCustom && query.trim()) {
        onChange(query.trim());
        setOpen(false);
        setActiveIndex(-1);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      if (selectedOption) {
        setQuery(selectedOption.name);
      } else {
        setQuery("");
      }
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      {label && (
        <label className="text-label text-text-secondary">{label}</label>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open && e.target.value) setOpen(true);
          }}
          onFocus={() => {
            if (filteredOptions.length > 0 || options.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border bg-bg-tertiary py-2.5 pl-10 pr-20 text-body text-text-primary placeholder:text-text-disabled focus:outline-none transition-colors",
            error
              ? "border-accent-red focus:ring-1 focus:ring-accent-red"
              : "border-border-default focus:border-border-focus focus:ring-1 focus:ring-border-focus",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="rounded p-0.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary"
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
              />
            </button>
          )}
        </div>
      </div>

       {error && <p className="text-caption text-accent-red">{error}</p>}
       {!error && helperText && <p className="text-caption text-text-tertiary">{helperText}</p>}

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border-default bg-bg-secondary shadow-lg">
          {filteredOptions.length === 0 ? (
            allowCustom && query.trim() ? (
              <button
                type="button"
                onClick={() => {
                  onChange(query.trim());
                  setQuery(query.trim());
                  setOpen(false);
                  setActiveIndex(-1);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-tertiary"
              >
                <Plus className="h-4 w-4 text-text-tertiary shrink-0" />
                <span className="text-body-sm text-text-primary">
                  Use &ldquo;<span className="font-medium">{query.trim()}</span>&rdquo;
                </span>
              </button>
            ) : (
              <div className="px-4 py-3 text-body-sm text-text-tertiary text-center">
                {emptyMessage}
              </div>
            )
          ) : (
            filteredOptions.map((option, idx) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  idx === activeIndex
                    ? "bg-accent-gold/10"
                    : "hover:bg-bg-tertiary",
                  idx !== filteredOptions.length - 1 && "border-b border-border-muted"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-text-primary">
                    {option.name}
                  </p>
                  {option.subtitle && (
                    <p className="truncate text-caption text-text-tertiary">
                      {option.subtitle}
                    </p>
                  )}
                </div>
                {option.badge && (
                  <span
                    className={cn(
                      "shrink-0 rounded border px-1.5 py-0.5 text-caption font-medium",
                      getBadgeClasses(option.badgeVariant)
                    )}
                  >
                    {option.badge}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
