function getInitials(name) {
  if (!name) return "?";
  const words = name.trim().split(" ").filter(Boolean);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getAvatarColor(name) {
  const colors = ["bg-primary-40", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500", "bg-indigo-500"];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}

export default function Avatar({ name, fotoProfil, size = "md", className = "" }) {
  const sizeClass = {
    sm: "w-10 h-10 text-xs", //tabel
    md: "w-11 h-11 text-sm", //navbar
    lg: "w-12 h-12 text-sm", //card pasien
    xl: "w-32 h-32 text-4xl", //detail
  }[size] || "w-11 h-11 text-sm";

  return (
    <div className={`rounded-full overflow-hidden flex-shrink-0 ${sizeClass} ${className}`}>
      {fotoProfil ? (
        <img src={fotoProfil} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full flex items-center justify-center text-white font-bold ${getAvatarColor(name)}`}>
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}