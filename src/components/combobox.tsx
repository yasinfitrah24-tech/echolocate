"use client";

// A text field with a suggestion list (ARIA combobox). Typing anything is
// allowed; picking a suggestion fills in its exact label. Used for City and
// Genre. No dependencies.

import { useId, useState, type KeyboardEvent } from "react";

export interface ComboOption {
  label: string;
  key: string;
  /** Same as key without commas, so "austin tx" also matches. */
  loose: string;
  /** Words after the first, for matches inside a label ("arbor" -> Ann Arbor). */
  inner: string[];
  /** Other words people type for it ("rap" -> Hip hop). */
  also: string[];
}

const MAX_SUGGESTIONS = 8;

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeOption(label: string, also: string[] = []): ComboOption {
  const key = normalize(label);
  return {
    label,
    key,
    loose: key.replace(/,/g, ""),
    inner: key.split(/[\s\-/]+/).slice(1),
    also: also.map(normalize),
  };
}

/** True when the text is exactly one of the options. */
export function isOption(options: ComboOption[], text: string): boolean {
  const key = normalize(text);
  return options.some((option) => option.key === key);
}

function suggest(options: ComboOption[], query: string, showAllWhenEmpty: boolean): ComboOption[] {
  const q = normalize(query);
  if (!q) return showAllWhenEmpty ? options : [];
  const starts: ComboOption[] = [];
  const other: ComboOption[] = [];
  for (const option of options) {
    if (option.key.startsWith(q) || option.loose.startsWith(q)) {
      starts.push(option);
      if (starts.length === MAX_SUGGESTIONS) break;
    } else if (
      other.length < MAX_SUGGESTIONS &&
      (option.inner.some((word) => word.startsWith(q)) || option.also.some((word) => word.startsWith(q)))
    ) {
      other.push(option);
    }
  }
  return [...starts, ...other].slice(0, MAX_SUGGESTIONS);
}

export function Combobox({
  id,
  value,
  onChange,
  options,
  className,
  placeholder,
  note,
  onFirstFocus,
  showAllWhenEmpty = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Null while the options are still loading. */
  options: ComboOption[] | null;
  className: string;
  placeholder?: string;
  /** Shown under the field while the list is closed. */
  note?: string | null;
  onFirstFocus?: () => void;
  showAllWhenEmpty?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const suggestions = options && open ? suggest(options, value, showAllWhenEmpty) : [];
  const showList = suggestions.length > 0;

  function pick(option: ComboOption) {
    onChange(option.label);
    setOpen(false);
  }

  /** Opens the list, unless the field already holds a picked option. */
  function openUnlessPicked() {
    if (options && isOption(options, value)) return;
    setOpen(true);
    setActive(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      if (!showList) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && showList) {
      // Pick the highlighted option instead of submitting the form.
      event.preventDefault();
      pick(suggestions[Math.min(active, suggestions.length - 1)]);
    } else if (event.key === "Escape") {
      if (open) event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        className={className}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        // Focus alone (tabbing back, returning to the window) does not reopen
        // the list after a pick; typing, a click or the arrow keys do.
        onFocus={() => {
          onFirstFocus?.();
          openUnlessPicked();
        }}
        onClick={() => {
          if (!open) {
            setOpen(true);
            setActive(0);
          }
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1000] mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg"
        >
          {suggestions.map((option, index) => (
            <li
              key={option.label}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: it runs before the input loses focus.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer px-3 py-2 ${index === active ? "bg-zinc-100" : ""}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
      {note && !open && <p className="mt-1 text-xs text-zinc-500">{note}</p>}
    </div>
  );
}
