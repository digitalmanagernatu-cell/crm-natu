"use client";
import { Bot, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant"; content: string };

const SUGERENCIAS = [
  "¿Qué prospectos llevan más de 14 días sin actividad?",
  "Resúmeme el estado del pipeline y dime en qué debería enfocarme esta semana",
  "¿Cuáles son los prospectos más calientes y cuál es la siguiente acción con cada uno?",
  "Resúmeme la relación con mi cliente más activo y propón próximos pasos",
];

export function Chat({ nombre }: { nombre: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("crm-chat") ?? "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem("crm-chat", JSON.stringify(msgs)); } catch {}
    fin.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, cargando]);

  async function enviar(texto: string) {
    if (!texto.trim() || cargando) return;
    const nuevos: Msg[] = [...msgs, { role: "user", content: texto.trim() }];
    setMsgs(nuevos); setInput(""); setCargando(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nuevos }) });
      const j = await r.json();
      setMsgs([...nuevos, { role: "assistant", content: j.reply ?? `⚠️ ${j.error ?? "Error"}` }]);
    } catch {
      setMsgs([...nuevos, { role: "assistant", content: "⚠️ No se pudo contactar con el servidor." }]);
    } finally { setCargando(false); }
  }

  return (
    <div className="card flex h-[calc(100vh-11rem)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="mx-auto max-w-xl py-10 text-center">
            <Bot className="mx-auto text-accent" size={32} />
            <h2 className="mt-3 text-lg font-semibold">Hola {nombre.split(" ")[0]}, ¿en qué te ayudo?</h2>
            <p className="mt-1 text-sm text-ink-2">Pregúntame por tus clientes, el pipeline o pídeme que apunte una acción en la bitácora.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {SUGERENCIAS.map((s) => <button key={s} onClick={() => enviar(s)} className="rounded-lg border border-line p-3 text-left text-sm hover:bg-surface-2">{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-4 py-2 text-sm text-white" : "prose-chat max-w-none text-sm"}>
              {m.role === "user" ? m.content : <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>}
            </div>
          </div>
        ))}
        {cargando && <div className="text-sm text-muted">Consultando el CRM…</div>}
        <div ref={fin} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); enviar(input); }} className="flex gap-2 border-t border-line p-3">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="Escribe tu pregunta…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(input); } }}
          className="input resize-none" />
        <button disabled={cargando || !input.trim()} className="btn-primary"><Send size={16} /></button>
        {msgs.length > 0 && <button type="button" onClick={() => setMsgs([])} className="btn-ghost">Nueva</button>}
      </form>
    </div>
  );
}
