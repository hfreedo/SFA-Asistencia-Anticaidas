export function relativeAge(seconds:number):string {
  if (!Number.isFinite(seconds) || seconds < -30) return "hora por verificar";
  const value=Math.max(0,Math.floor(seconds));
  if (value<60) return `hace ${value} s`;
  if (value<3600) return `hace ${Math.floor(value/60)} min`;
  if (value<86400) return `hace ${Math.floor(value/3600)} h${Math.floor(value%3600/60) ? ` ${Math.floor(value%3600/60)} min` : ""}`;
  return `hace ${Math.floor(value/86400)} d${Math.floor(value%86400/3600) ? ` ${Math.floor(value%86400/3600)} h` : ""}`;
}
