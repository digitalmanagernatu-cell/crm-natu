export const GRUPOS = ["Export", "Gran Consumo"] as const;
export type Grupo = (typeof GRUPOS)[number];

export const ROLES = ["comercial", "responsable", "admin"] as const;
export type Rol = (typeof ROLES)[number];
export const ROL_LABEL: Record<Rol, string> = {
  comercial: "Comercial",
  responsable: "Responsable de grupo",
  admin: "Administrador",
};

export const CALIDADES = ["A · Caliente", "B · Templado", "C · Frío"] as const;
export type Calidad = (typeof CALIDADES)[number];

export const CANALES = ["Feria", "Prospección", "Email", "Web", "Ads", "LinkedIn", "Otro"] as const;
export type Canal = (typeof CANALES)[number];

export const ESTADOS = ["Nuevo", "Contactado", "Propuesta enviada", "Negociación", "Ganado", "Perdido"] as const;
export type Estado = (typeof ESTADOS)[number];
export const ESTADOS_ABIERTOS: Estado[] = ["Nuevo", "Contactado", "Propuesta enviada", "Negociación"];

export const TIPOS_ACCION = ["Llamada", "Email", "Reunión", "Visita", "Muestra enviada", "Oferta", "Nota"] as const;
/** "Sistema" lo genera el propio CRM (cambios de estado, conversiones…). */
export type TipoAccion = (typeof TIPOS_ACCION)[number] | "Sistema";

export const PRIORIDADES = ["Alta", "Media", "Baja"] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const ESTADOS_PROYECTO = ["En curso", "Entregado", "Cancelado"] as const;
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

export interface Usuario {
  email: string; // en minúsculas, es la clave
  nombre: string;
  grupo: Grupo | "Todos";
  rol: Rol;
  activo: boolean;
}

export interface Cliente {
  id: string;
  nombre: string;
  grupo: Grupo;
  responsable: string; // email del comercial; "" = sin asignar
  agenteInicial: string;
  zona: string;
  contacto: string;
  cargo: string;
  email: string;
  telefono: string;
  canal: Canal | "";
  /** Detalle del origen: «Formulario Granel», «Cosmoprof 2026», «Base de datos X»… */
  origen: string;
  calidad: Calidad | "";
  prioridad: Prioridad | "";
  /** Etiquetas libres separadas por comas («FG», «Información enviada»…). */
  etiquetas: string;
  estado: Estado;
  fechaAlta: string; // ISO (fecha y hora de creación; los migrados solo fecha)
  fechaGanado: string;
  proximaAccion: string;
  fechaProximaAccion: string;
  notas: string;
  actualizado: string; // ISO datetime
}

export interface Accion {
  id: string;
  clienteId: string;
  fecha: string; // ISO datetime
  tipo: TipoAccion;
  autor: string; // email
  comentario: string;
}

export interface Proyecto {
  id: string;
  clienteId: string;
  nombre: string;
  importe: number | null;
  fecha: string;
  estado: EstadoProyecto;
  autor: string;
  notas: string;
}

export const ESTADOS_TAREA = ["Pendiente", "Hecha", "Cancelada"] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

/** Acción comercial programada (Agenda). */
export interface Tarea {
  id: string;
  clienteId: string;
  tipo: (typeof TIPOS_ACCION)[number];
  titulo: string;
  fecha: string; // yyyy-mm-dd
  hora: string; // hh:mm o ""
  responsable: string; // email de quien la tiene que hacer
  estado: EstadoTarea;
  notas: string;
  creadoPor: string;
  creado: string; // ISO
  completada: string; // ISO de cuando se marcó hecha/cancelada
  resultado: string; // qué pasó (al completarla)
}

export interface CrmData {
  clientes: Cliente[];
  acciones: Accion[];
  proyectos: Proyecto[];
  usuarios: Usuario[];
  agenda: Tarea[];
}
