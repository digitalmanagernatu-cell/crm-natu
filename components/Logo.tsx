import Image from "next/image";
import logoDark from "../public/brand/natu-logo-dark.png";
import logoWhite from "../public/brand/natu-logo-white.png";

/** Logotipo NATU Laboratories + nombre de la herramienta (mismo formato que la plataforma NPD). */
export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <Image src={onDark ? logoWhite : logoDark} alt="NATU Laboratories" priority className="h-6 w-auto sm:h-9" />
      <span className={`hidden h-7 w-px lg:block ${onDark ? "bg-white/30" : "bg-slate-300"}`} aria-hidden />
      <span className={`hidden text-[11px] font-semibold uppercase leading-tight tracking-[0.2em] lg:block ${onDark ? "text-white/85" : "text-slate-600"}`}>
        CRM
        <br />
        Comercial
      </span>
    </span>
  );
}
