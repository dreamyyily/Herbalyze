export default function InputField({ label, name, placeholder,type = "text", value, onChange, required = false, error}) {
  return (
    <div className="relative">
      <div className={`relative rounded-xl border px-5 py-4 transition-all duration-200 
        ${error ? "border-danger-30" : "border-light-40 hover:border-primary-20 focus-within:border-primary-40 focus-within:ring-2 focus-within:ring-primary-10"}
      `}>
        <label className={`absolute left-5 -top-2.5 px-2 bg-white text-sm font-medium transition-colors
          ${error ? "text-danger-30" : "text-dark-30 group-focus-within:text-primary-40"}
        `}>
          {label}
          {required && <span className="text-danger-30">*</span>}
        </label>

        <input
          type={type}
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          className="w-full bg-transparent outline-none text-dark-50 placeholder:text-dark-30"
        />
      </div>
      
      {error && <p className="text-danger-30 text-sm mt-1">{error}</p>}
    </div>
  );
}
