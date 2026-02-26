import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDownIcon, ChevronUpIcon, CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid";

export default function MultiSelectField({ label, options = [], required = false, value, onChange, error}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [internalSelected, setInternalSelected] = useState([]);
  const selected = value || internalSelected;

  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  const toggleSelect = (item) => {
    let newSelected;
    if (selected.includes(item)) {
      newSelected = selected.filter((s) => s !== item);
    } else {
      newSelected = [...selected, item];
    }

    if (onChange) onChange(newSelected);
    else setInternalSelected(newSelected);
  };

  const filteredOptions = useMemo(() => {
    return query === ""
      ? options
      : options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  const getDisplayText = () => {
    if (selected.length === 0)
      return <span className="text-dark-30">Pilih {label.toLowerCase()}</span>;

    const limit = 2;
    const visibleItems = selected.slice(0, limit).join(", ");
    const remainingCount = selected.length - limit;

    return (
      <div className="flex items-center gap-2 w-full">
        <span className="truncate text-dark-50 font-medium">
          {visibleItems}
        </span>

        {remainingCount > 0 && (
          <span className="flex-shrink-0 text-primary-40 font-semibold bg-primary-10 border border-primary-20 px-2 py-0.5 rounded-md text-xs">
            +{remainingCount}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="mb-8 relative" ref={wrapperRef}>
      {/* TRIGGER */}
      <div
        onClick={() => setOpen((prev) => !prev)}
        className={`relative w-full min-h-[56px] rounded-xl border bg-white px-4 py-3.5 cursor-pointer flex items-center justify-between transition-all duration-200
          ${
            error
              ? "border-danger-30"
              : open
              ? "border-primary-40 ring-2 ring-primary-10"
              : "border-light-40 hover:border-primary-20"
          }
        `}
      >
        <label
          className={`absolute left-3 -top-2.5 px-1.5 bg-white text-sm font-medium transition-colors z-10
            ${
              error
                ? "text-danger-30"
                : open
                ? "text-primary-40"
                : "text-dark-30"
            }`}
        >
          {label}
          {required && <span className="text-danger-30 ml-0.5">*</span>}
        </label>

        <div className="flex-1 min-w-0 flex items-center pr-4">
          {getDisplayText()}
        </div>

        <div className="flex-shrink-0">
          {open ? (
            <ChevronUpIcon className="h-5 w-5 text-primary-40" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-dark-30" />
          )}
        </div>
      </div>

      {error && (
        <p className="mt-1 text-sm text-danger-30">
          {error}
        </p>
      )}

      {/* DROPDOWN */}
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg ring-1 ring-black/5 border border-light-30 overflow-hidden flex flex-col">
          
          {/* SEARCH */}
          <div className="p-2 border-b border-light-30 bg-white sticky top-0 z-10">
            <div className="relative flex items-center">
              <MagnifyingGlassIcon className="absolute left-3 h-4 w-4 text-dark-30 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-light-20 border border-transparent focus:border-primary-40 focus:bg-white focus:ring-1 focus:ring-primary-40 rounded-lg py-2 pl-9 pr-3 text-sm text-dark-50 transition-all outline-none placeholder:text-dark-30"
                placeholder="Ketik untuk mencari..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* LIST */}
          <ul className="max-h-60 overflow-y-auto py-1.5">
            {filteredOptions.length === 0 ? (
              <li className="px-4 py-6 text-center text-dark-30 text-sm">
                "{query}" tidak ditemukan
              </li>
            ) : (
              filteredOptions.map((item, index) => {
                const isSelected = selected.includes(item);

                return (
                  <li
                    key={index}
                    onClick={() => toggleSelect(item)}
                    className={`px-4 py-2.5 mx-1.5 mb-0.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors
                      ${isSelected 
                        ? "bg-primary-10" 
                        : "hover:bg-light-20"}
                    `}
                  >
                    <span
                      className={`text-sm truncate pr-4 ${
                        isSelected
                          ? "text-primary-40 font-semibold"
                          : "text-dark-50 font-medium"
                      }`}
                    >
                      {item}
                    </span>

                    {isSelected && (
                      <CheckIcon className="h-4 w-4 text-primary-40 flex-shrink-0" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}