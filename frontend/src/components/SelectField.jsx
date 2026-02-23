import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from "@heroicons/react/20/solid";

export default function SelectField({ label, options = [], required = false, value = [], onChange, closeOnSelect = true, placeholder = "Pilih"}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item) => {
    if (onChange) onChange(item);
    if (closeOnSelect) setOpen(false);
  };

  const safeValue = Array.isArray(value) ? value : value ? [value] : [];

const getDisplayText = () => {
  if (safeValue.length === 0)
    return <span className="text-dark-30">{placeholder}</span>;

  return (
    <span className="truncate text-dark-50 font-medium">
      {safeValue.join(", ")}
    </span>
  );
};

  return (
    <div className="mb-8 relative" ref={wrapperRef}>
      {/* TRIGGER */}
      <div
        onClick={() => setOpen(!open)}
        className={`relative w-full min-h-[56px] rounded-xl border bg-white px-4 py-3.5 cursor-pointer flex items-center justify-between transition-all duration-200
          ${open 
            ? 'border-primary-40 ring-4 ring-primary-10 shadow-sm' 
            : 'border-light-40 hover:border-primary-20'}
        `}
      >
        <label
          className={`absolute left-3 -top-2.5 px-1.5 bg-white text-xs font-semibold transition-colors z-10
          ${open ? "text-primary-40" : "text-dark-30"}`}
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

      {/* DROPDOWN */}
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg ring-1 ring-black/5 border border-light-30 overflow-hidden flex flex-col">
          <ul className="max-h-60 overflow-y-auto py-1.5">
            {options.map((item, index) => {
              const safeValue = Array.isArray(value) ? value : value ? [value] : [];
              const isSelected = safeValue.includes(item);

              return (
                <li
                  key={index}
                  onClick={() => handleSelect(item)}
                  className={`px-4 py-2.5 mx-1.5 mb-0.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors
                    ${isSelected ? "bg-primary-10" : "hover:bg-light-20"}
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
            })}
          </ul>
        </div>
      )}
    </div>
  );
}