"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function FilterBar({ filtros }: { filtros: { key: string; label: string; options: { value: string; label: string }[] }[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp);
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`${path}?${p}`);
  };
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {filtros.map((f) => (
        <select key={f.key} value={sp.get(f.key) ?? ""} onChange={(e) => set(f.key, e.target.value)} className="input w-auto min-w-40">
          <option value="">{f.label}: todos</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
    </div>
  );
}
