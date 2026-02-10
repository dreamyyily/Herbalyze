import { useState, Fragment } from "react";
import { Combobox, Transition } from "@headlessui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";

export default function SelectField({ label, options, required = false }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");

  const filteredOptions =
    query === ""
      ? options
      : options.filter((opt) =>
          opt.toLowerCase().includes(query.toLowerCase())
        );

  return (
    <div className="mb-10">
      <Combobox value={selected} onChange={setSelected}>
        {({ open }) => (
          <div className="relative">
            {/* Field wrapper */}
            <div className="relative w-full rounded-xl border border-gray-300 bg-white px-5 py-4 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
              {/* Floating label di pinggir kiri atas border */}
              <Combobox.Label className="absolute left-5 -top-2.5 px-2 bg-white text-xs font-medium text-gray-500 pointer-events-none transition-colors focus-within:text-blue-500">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </Combobox.Label>

              {/* Input + placeholder di kiri, selected value hitam */}
              <Combobox.Input
                className="w-full border-none bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none pr-12"
                displayValue={(opt) => opt || ""}
                placeholder="Pilih"
                onChange={(e) => setQuery(e.target.value)}
              />

              {/* Arrow flip single, tengah vertikal kanan */}
              <Combobox.Button className="absolute inset-y-0 right-5 flex items-center">
                {open ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                )}
              </Combobox.Button>
            </div>

            {/* Dropdown options - highlight abu halus seperti screenshot */}
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Combobox.Options className="absolute z-50 mt-2 w-full overflow-auto rounded-xl bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                {filteredOptions.length === 0 && query !== "" ? (
                  <div className="px-5 py-3 text-gray-500">
                    Tidak ditemukan
                  </div>
                ) : (
                  filteredOptions.map((opt) => (
                    <Combobox.Option
                      key={opt}
                      value={opt}
                      className={({ active }) =>
                        `relative cursor-pointer select-none px-5 py-3 ${active ? "bg-gray-100 text-blue-700" : "text-gray-900"}`
                      }
                    >
                      {({ selected }) => (
                        <span className={`block truncate ${selected ? "font-medium text-blue-700" : "font-normal"}`}>
                          {opt}
                        </span>
                      )}
                    </Combobox.Option>
                  ))
                )}
              </Combobox.Options>
            </Transition>
          </div>
        )}
      </Combobox>
    </div>
  );
}