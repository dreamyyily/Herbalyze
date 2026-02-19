import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDownIcon, ChevronUpIcon, CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid";

export default function MultiSelectField({ 
  label, 
  options = [], 
  required = false,
  value,       // Opsional: Untuk state dari parent (Home.jsx)
  onChange     // Opsional: Untuk update state ke parent
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  
  // Jika parent tidak mengirimkan `value`, gunakan state internal ini
  const [internalSelected, setInternalSelected] = useState([]);
  const selected = value || internalSelected;

  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  // Menutup dropdown saat klik di luar area
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(""); // Reset pencarian saat ditutup
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Otomatis fokus ke kolom pencarian saat dropdown terbuka
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  // Logika toggle pilihan
  const toggleSelect = (item) => {
    let newSelected;
    if (selected.includes(item)) {
      newSelected = selected.filter((s) => s !== item);
    } else {
      newSelected = [...selected, item];
    }

    // Update parent state jika ada, jika tidak update internal state
    if (onChange) onChange(newSelected);
    else setInternalSelected(newSelected);
  };

  // Logika Filter Pencarian
  const filteredOptions = useMemo(() => {
    return query === ""
      ? options
      : options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  // Logika Tampilan Teks Terpilih (+X)
  const getDisplayText = () => {
    if (selected.length === 0) return <span className="text-gray-400">Pilih {label.toLowerCase()}...</span>;

    const limit = 3;
    const visibleItems = selected.slice(0, limit).join(", ");
    const remainingCount = selected.length - limit;

    return (
      <div className="flex items-center gap-2 w-full">
        {/* Teks item yang muat (dibatasi agar tidak tumpah) */}
        <span className="truncate text-gray-800 font-medium">
          {visibleItems}
        </span>
        
        {/* Badge "+X" yang lebih elegan */}
        {remainingCount > 0 && (
          <span className="flex-shrink-0 text-blue-700 font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md text-xs">
            +{remainingCount}
          </span>
        )}
      </div>
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

        {/* Area Teks (Flex-1 min-w-0 penting agar truncate bekerja) */}
        <div className="flex-1 min-w-0 flex items-center pr-4">
          {getDisplayText()}
        </div>

        <div className="flex-shrink-0 text-gray-400">
          {open ? (
            <ChevronUpIcon className="h-5 w-5 text-blue-500" />
          ) : (
            <ChevronDownIcon className="h-5 w-5" />
          )}
        </div>
      </div>

      {/* --- DROPDOWN MENU --- */}
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden border border-gray-100 flex flex-col origin-top animate-in fade-in slide-in-from-top-1 duration-150">
          
          {/* SEARCH BAR SEAMLESS */}
          <div className="p-2 border-b border-gray-100 bg-white sticky top-0 z-10">
            <div className="relative flex items-center">
              <MagnifyingGlassIcon className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-700 transition-all outline-none placeholder:text-gray-400"
                placeholder="Ketik untuk mencari..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* LIST ITEM */}
          <ul className="max-h-60 overflow-y-auto py-1.5 overscroll-contain">
            {filteredOptions.length === 0 ? (
              <li className="px-4 py-6 text-center text-gray-400 text-sm">
                "{query}" tidak ditemukan
              </li>
            ) : (
              filteredOptions.map((item, index) => {
                const isSelected = selected.includes(item);

                return (
                  <li
                    key={index}
                    onClick={() => toggleSelect(item)}
                    className={`px-4 py-2.5 mx-1.5 mb-0.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors duration-150
                      ${isSelected 
                        ? "bg-blue-50/70" // Soft blue, tidak memblok berat
                        : "hover:bg-gray-50"}
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
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}