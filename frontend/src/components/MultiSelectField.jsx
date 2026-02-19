import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from "@heroicons/react/20/solid";

export default function MultiSelectField({ label, options = [], required = false }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
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

  const toggleSelect = (item) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((s) => s !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  const getDisplayText = () => {
    if (selected.length === 0) return "";
    if (selected.length === 1) return selected[0];
    return `${selected[0]} ${selected.length - 1}+`;
  };

  return (
    <div className="mb-10 relative" ref={wrapperRef}>
      <div
        onClick={() => setOpen(!open)}
        className="relative w-full rounded-xl border border-light-40 bg-white px-5 py-4 cursor-pointer
        focus-within:border-primary-40 focus-within:ring-4 focus-within:ring-primary-10 transition-all"
      >
        <label className="absolute left-5 -top-2.5 px-2 bg-white text-regular-12 text-dark-30">
          {label}
          {required && <span className="text-danger-30 ml-1">*</span>}
        </label>

        <div className="text-regular-16 text-dark-50 pr-8 text-left">
          {selected.length === 0 ? (
            <span className="text-dark-30">Pilih</span>
          ) : (
            getDisplayText()
          )}
        </div>

        <div className="absolute inset-y-0 right-5 flex items-center">
          {open ? (
            <ChevronUpIcon className="h-5 w-5 text-dark-30" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-dark-30" />
          )}
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-5 py-3 text-dark-30">Tidak ada data</div>
          ) : (
            options.map((item, index) => {
              const isSelected = selected.includes(item);

              return (
                <div
                  key={index}
                  onClick={() => toggleSelect(item)}
                  className={`relative cursor-pointer select-none px-5 py-3 flex items-center justify-between transition
                    ${isSelected ? "bg-primary-10" : "hover:bg-light-30"}`}
                >
                  <span
                    className={`truncate text-regular-15 ${
                      isSelected
                        ? "text-primary-40 font-medium"
                        : "text-dark-50"
                    }`}
                  >
                    {item}
                  </span>

                  {isSelected && (
                    <CheckIcon className="h-4 w-4 text-primary-40" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}