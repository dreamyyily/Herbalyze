import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from "@heroicons/react/20/solid";

export default function SelectField({ 
  label, 
  options = [], 
  required = false,
  value = [], // Kita selalu gunakan array agar konsisten
  onChange,
  closeOnSelect = true, // Prop untuk menentukan dropdown nutup otomatis atau tidak
  placeholder = "Pilih..."
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Menutup dropdown saat klik di luar area
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

  const getDisplayText = () => {
    if (value.length === 0) return <span className="text-gray-400">{placeholder}</span>;
    return (
      <span className="truncate text-gray-800 font-medium">
        {value.join(", ")}
      </span>
    );
  };

  return (
    <div className="mb-8 relative" ref={wrapperRef}>
      
      {/* --- BOX TRIGGER (FLOATING LABEL) --- */}
      <div
        onClick={() => setOpen(!open)}
        className={`relative w-full min-h-[56px] rounded-xl border bg-white px-4 py-3.5 cursor-pointer flex items-center justify-between transition-all duration-200
          ${open 
            ? 'border-blue-500 ring-1 ring-blue-500 shadow-sm' 
            : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <label className={`absolute left-3 -top-2.5 px-1.5 bg-white text-xs font-semibold transition-colors z-10
            ${open ? 'text-blue-600' : 'text-gray-500'}`}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>

        {/* Area Teks Terpilih */}
        <div className="flex-1 min-w-0 flex items-center pr-4">
          {getDisplayText()}
        </div>

        {/* Icon Panah */}
        <div className="flex-shrink-0 text-gray-400">
          {open ? (
            <ChevronUpIcon className="h-5 w-5 text-blue-500" />
          ) : (
            <ChevronDownIcon className="h-5 w-5" />
          )}
        </div>
      </div>

      {/* --- DROPDOWN MENU (Tanpa Search) --- */}
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden border border-gray-100 flex flex-col origin-top animate-in fade-in slide-in-from-top-1 duration-150">
          
          <ul className="max-h-60 overflow-y-auto py-1.5 overscroll-contain">
            {options.map((item, index) => {
              const isSelected = value.includes(item);

              return (
                <li
                  key={index}
                  onClick={() => handleSelect(item)}
                  className={`px-4 py-2.5 mx-1.5 mb-0.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors duration-150
                    ${isSelected ? "bg-blue-50/70" : "hover:bg-gray-50"}
                  `}
                >
                  <span
                    className={`text-sm truncate pr-4 ${
                      isSelected ? "text-blue-700 font-semibold" : "text-gray-700 font-medium"
                    }`}
                  >
                    {item}
                  </span>

                  {isSelected && (
                    <CheckIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
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