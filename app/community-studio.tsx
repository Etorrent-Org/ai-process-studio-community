"use client";

import mermaid from "mermaid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Step = {
  id: string;
  order: number;
  name: string;
  actor?: string;
  tool?: string;
  action?: string;
  durationMinutes: number;
  waitMinutes: number;
  irritant?: boolean;
  risk?: string;
};

type Process = {
  id: string;
  projectId: string;
  name: string;
  objective?: string;
  trigger?: string;
  result?: string;
  owner?: string;
  status: string;
  version: number;
  updatedAt?: string;
  steps: Step[];
};

type Organization = { id: string; name?: string };
type Project = { id: string; organizationId?: string; name?: string };
type DocumentItem = { id: string; projectId?: string; processId?: string | null; name: string; mimeType: string; size: number };
type State = {
  schemaVersion: string;
  organizations: Organization[];
  projects: Project[];
  processes: Process[];
  documents: DocumentItem[];
  settings: { companyName: string; locale: "fr"; aiMode: "manual"; scoringWeights: Record<string, number> };
  [key: string]: unknown;
};
type AuthStatus = { configured: boolean; authenticated: boolean; user?: { name: string }; csrfToken?: string };
type ViewId = "dashboard" | "repository" | "discover" | "map" | "documents" | "exports" | "admin";

const NAV: Array<{ id: ViewId; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "repository", label: "Référentiel" },
  { id: "discover", label: "Discover" },
  { id: "map", label: "Map" },
  { id: "documents", label: "Documents" },
  { id: "exports", label: "Exports" },
  { id: "admin", label: "Administration" },
];
const EMPTY_STATE: State = {
  schemaVersion: "2.1.0",
  organizations: [],
  projects: [],
  processes: [],
  documents: [],
  settings: {
    companyName: "",
    locale: "fr",
    aiMode: "manual",
    scoringWeights: { timeGain: 2, frequency: 2, businessImpact: 3, ease: 2, risk: -2, confidentiality: -1 },
  },
};
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const classes = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={classes("rounded-2xl border border-[#e3e8f0] bg-white shadow-[0_12px_36px_rgba(23,32,51,.055)]", className)}>{children}</section>;
}
function Button({ children, onClick, secondary = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={classes("rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40", secondary ? "border border-[#dce1ea] bg-white text-[#344054] hover:bg-[#f8f7ff]" : "bg-[#5f57d9] text-white hover:bg-[#4e47c3]")}>{children}</button>;
}
function Field({ label, value, onChange, multiline = false, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; multiline?: boolean; type?: string }) {
  const cls = "mt-2 w-full rounded-xl border border-[#dce1ea] bg-[#fbfcfe] px-3.5 py-2.5 text-sm focus:border-[#7d74ea] focus:bg-white";
  return <label className="block text-sm font-semibold text-[#465065]">{label}{multiline ? <textarea rows={3} className={cls} value={value} onChange={(event) => onChange(event.target.value)} /> : <input className={cls} type={type} value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}
function Empty({ title, copy }: { title: string; copy: string }) {
  return <Card className="p-8 text-center"><h3 className="text-lg font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#667085]">{copy}</p></Card>;
}

function processChart(process: Process) {
  const clean = (value: string) => value.replace(/["\r\n<>]/g, " ").trim() || "Étape";
  const lines = ["flowchart LR", 'START(["Début"])'];
  process.steps.forEach((step, index) => lines.push(`S${index + 1}["${index + 1}. ${clean(step.name)}<br>${clean(step.actor || "")}"]`));
  lines.push('END(["Résultat"])');
  if (!process.steps.length) lines.push("START --> END");
  else {
    lines.push("START --> S1");
    process.steps.slice(0, -1).forEach((_, index) => lines.push(`S${index + 1} --> S${index + 2}`));
    lines.push(`S${process.steps.length} --> END`);
  }
  return lines.join("\n");
}

function MapView({ process }: { process?: Process }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useMemo(() => process ? processChart(process) : "flowchart LR\nA[\"Aucun processus\"]", [process]);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base" });
        const { svg } = await mermaid.render(`aps-community-${Date.now()}`, chart);
        if (!cancelled && ref.current) { ref.current.innerHTML = svg; setError(""); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Diagramme invalide");
      }
    })();
    return () => { cancelled = true; };
  }, [chart]);
  if (!process) return <Empty title="Aucun processus actif" copy="Sélectionnez un processus avant d’afficher sa carte." />;
  return <Card className="p-6"><h2 className="text-xl font-semibold">{process.name}</h2>{error ? <p className="mt-4 rounded-xl bg-[#fff4df] p-4 text-sm text-[#8b5b10]">{error}</p> : <div ref={ref} className="mt-5 min-h-56 overflow-x-auto rounded-xl bg-[#fbfcff] p-5" />}</Card>;
}

function Login({ status, onDone }: { status: AuthStatus; onDone: () => Promise<void> }) {
  const [name, setName] = useState("Administrateur");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    setError("");
    const endpoint = status.configured ? "/api/auth/login" : "/api/auth/setup";
    const payload = status.configured ? { password } : { name, password };
    const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Connexion impossible");
    await onDone();
  };
  return <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-6"><Card className="w-full max-w-md p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#7b74da]">AI Process Studio Community</p><h1 className="mt-3 text-2xl font-semibold">{status.configured ? "Connexion locale" : "Initialisation locale"}</h1><div className="mt-6 space-y-4">{!status.configured && <Field label="Nom" value={name} onChange={setName} />}<Field label="Mot de passe" type="password" value={password} onChange={setPassword} />{error && <p className="rounded-xl bg-[#fff0f0] p-3 text-sm text-[#a33f3f]">{error}</p>}<Button onClick={() => void submit()}>{status.configured ? "Se connecter" : "Créer le compte"}</Button></div></Card></div>;
}

export function CommunityStudio() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [state, setState] = useState<State>(EMPTY_STATE);
  const [auth, setAuth] = useState<AuthStatus>({ configured: false, authenticated: false });
  const [csrf, setCsrf] = useState("");
  const [activeProcessId, setActiveProcessId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); }, []);
  const apiFetch = useCallback(async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    if (init.method && !["GET", "HEAD"].includes(init.method.toUpperCase()) && csrf) headers.set("x-aps-csrf", csrf);
    return fetch(input, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  }, [csrf]);
  const loadWorkspace = useCallback(async () => {
    const response = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("L’espace local ne peut pas être chargé.");
    const next = await response.json() as State;
    setState(next);
    setActiveProcessId((current) => next.processes.some((item) => item.id === current) ? current : next.processes[0]?.id);
  }, []);
  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/status", { credentials: "same-origin", cache: "no-store" });
      const status = await response.json() as AuthStatus;
      setAuth(status);
      setCsrf(status.csrfToken || "");
      if (status.authenticated) await loadWorkspace();
    } finally { setLoading(false); }
  }, [loadWorkspace]);
  useEffect(() => { void bootstrap(); }, [bootstrap]);

  const saveState = useCallback(async (next: State, message: string) => {
    const response = await apiFetch("/api/state", { method: "PUT", body: JSON.stringify(next) });
    const body = await response.json();
    if (!response.ok) return notify(body.error || "Enregistrement impossible");
    setState(next);
    notify(message);
  }, [apiFetch, notify]);
  const process = state.processes.find((item) => item.id === activeProcessId) || state.processes[0];

  const createProcess = () => {
    const organization = state.organizations[0] || { id: uid("org"), name: state.settings.companyName || "Organisation" };
    const project = state.projects[0] || { id: uid("project"), organizationId: organization.id, name: "Projet principal" };
    const created: Process = { id: uid("process"), projectId: project.id, name: "Nouveau processus", objective: "", trigger: "", result: "", owner: "", status: "Brouillon", version: 1, updatedAt: new Date().toISOString(), steps: [] };
    const next: State = {
      ...state,
      organizations: state.organizations.length ? state.organizations : [organization],
      projects: state.projects.length ? state.projects : [project],
      processes: [...state.processes, created],
    };
    setActiveProcessId(created.id);
    void saveState(next, "Processus créé");
  };
  const updateProcess = (next: Process) => setState((current) => ({ ...current, processes: current.processes.map((item) => item.id === next.id ? next : item) }));
  const saveProcess = () => {
    if (!process) return;
    const updated = { ...process, version: Math.max(1, process.version + 1), updatedAt: new Date().toISOString() };
    void saveState({ ...state, processes: state.processes.map((item) => item.id === updated.id ? updated : item) }, "Processus enregistré");
  };
  const addStep = () => {
    if (!process) return;
    updateProcess({ ...process, steps: [...process.steps, { id: uid("step"), order: process.steps.length + 1, name: "Nouvelle étape", actor: "", tool: "", action: "", durationMinutes: 0, waitMinutes: 0, irritant: false, risk: "" }] });
  };
  const updateStep = (id: string, patch: Partial<Step>) => {
    if (!process) return;
    updateProcess({ ...process, steps: process.steps.map((step) => step.id === id ? { ...step, ...patch } : step) });
  };
  const uploadDocument = async (file: File) => {
    const project = state.projects.find((item) => item.id === process?.projectId) || state.projects[0];
    if (!project) return notify("Créez d’abord un processus.");
    const extension = file.name.toLowerCase().split(".").at(-1);
    const mimeType = file.type || (extension === "md" ? "text/markdown" : extension === "pdf" ? "application/pdf" : "text/plain");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    const response = await apiFetch("/api/documents", { method: "POST", body: JSON.stringify({ projectId: project.id, processId: process?.id || null, name: file.name, mimeType, base64: btoa(binary) }) });
    if (!response.ok) return notify((await response.json()).error || "Import impossible");
    await loadWorkspace();
    notify("Document ajouté");
  };
  const exportProject = async () => {
    if (!process) return;
    const response = await fetch(`/api/export/project/${encodeURIComponent(process.projectId)}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return notify("Export impossible");
    const disposition = response.headers.get("content-disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `${process.projectId}.aps.zip`;
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-[#667085]">Chargement de l’espace local…</div>;
  if (!auth.authenticated) return <Login status={auth} onDone={bootstrap} />;

  const render = () => {
    if (view === "dashboard") {
      const work = process?.steps.reduce((sum, step) => sum + Number(step.durationMinutes || 0), 0) || 0;
      const wait = process?.steps.reduce((sum, step) => sum + Number(step.waitMinutes || 0), 0) || 0;
      return <div className="space-y-5"><Card className="p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#7b74da]">Community 1.1</p><h2 className="mt-3 text-3xl font-semibold">Comprendre, documenter et cartographier les processus.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">Référentiel local, découverte AS-IS, cartographie, documents et exports.</p></Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Processus", state.processes.length], ["Étapes", process?.steps.length || 0], ["Travail", `${work} min`], ["Attente", `${Math.round(wait / 60)} h`]].map(([label, value]) => <Card key={String(label)} className="p-5"><p className="text-sm text-[#667085]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></Card>)}</div></div>;
    }
    if (view === "repository") return <div className="space-y-4"><div className="flex justify-end"><Button onClick={createProcess}>Créer un processus</Button></div>{state.processes.length ? state.processes.map((item) => <Card key={item.id} className={classes("p-5", item.id === process?.id && "ring-2 ring-[#7d74ea]")}><button className="w-full text-left" onClick={() => setActiveProcessId(item.id)}><h3 className="text-lg font-semibold">{item.name}</h3><p className="mt-2 text-sm text-[#667085]">{item.objective || "Objectif non renseigné"}</p><p className="mt-2 text-xs text-[#8b93a3]">{item.steps.length} étape(s) · version {item.version}</p></button></Card>) : <Empty title="Aucun processus" copy="Créez le premier processus du référentiel." />}</div>;
    if (view === "discover") {
      if (!process) return <Empty title="Aucun processus actif" copy="Créez ou sélectionnez un processus." />;
      return <div className="space-y-5"><Card className="p-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="Nom" value={process.name} onChange={(value) => updateProcess({ ...process, name: value })} /><Field label="Responsable" value={process.owner || ""} onChange={(value) => updateProcess({ ...process, owner: value })} /><Field label="Objectif" value={process.objective || ""} multiline onChange={(value) => updateProcess({ ...process, objective: value })} /><Field label="Déclencheur" value={process.trigger || ""} multiline onChange={(value) => updateProcess({ ...process, trigger: value })} /><Field label="Résultat attendu" value={process.result || ""} multiline onChange={(value) => updateProcess({ ...process, result: value })} /></div><div className="mt-5 flex justify-end"><Button onClick={saveProcess}>Enregistrer</Button></div></Card><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Étapes AS-IS</h2><Button secondary onClick={addStep}>Ajouter une étape</Button></div>{process.steps.map((step) => <Card key={step.id} className="p-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Étape" value={step.name} onChange={(value) => updateStep(step.id, { name: value })} /><Field label="Acteur" value={step.actor || ""} onChange={(value) => updateStep(step.id, { actor: value })} /><Field label="Outil" value={step.tool || ""} onChange={(value) => updateStep(step.id, { tool: value })} /><Field label="Action" value={step.action || ""} multiline onChange={(value) => updateStep(step.id, { action: value })} /><Field label="Travail (min)" type="number" value={step.durationMinutes} onChange={(value) => updateStep(step.id, { durationMinutes: Math.max(0, Number(value)) })} /><Field label="Attente (min)" type="number" value={step.waitMinutes} onChange={(value) => updateStep(step.id, { waitMinutes: Math.max(0, Number(value)) })} /><Field label="Risque" value={step.risk || ""} multiline onChange={(value) => updateStep(step.id, { risk: value })} /></div><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(step.irritant)} onChange={(event) => updateStep(step.id, { irritant: event.target.checked })} /> Irritant</label></Card>)}</div>;
    }
    if (view === "map") return <MapView process={process} />;
    if (view === "documents") return <div className="space-y-4"><label className="inline-flex cursor-pointer rounded-xl bg-[#5f57d9] px-4 py-2 text-sm font-semibold text-white">Ajouter un document<input className="sr-only" type="file" accept=".txt,.md,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadDocument(file); }} /></label>{state.documents.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{state.documents.map((document) => <Card key={document.id} className="p-5"><h3 className="font-semibold">{document.name}</h3><p className="mt-2 text-xs text-[#8b93a3]">{document.mimeType} · {Math.ceil(document.size / 1024)} Ko</p></Card>)}</div> : <Empty title="Aucun document" copy="Ajoutez des notes, spécifications ou PDF au projet actif." />}</div>;
    if (view === "exports") return <div className="grid gap-4 md:grid-cols-2"><Card className="p-6"><h3 className="text-lg font-semibold">Projet</h3><p className="mt-2 text-sm text-[#667085]">Archive locale du projet et de ses documents.</p><div className="mt-5"><Button disabled={!process} onClick={() => void exportProject()}>Exporter le projet</Button></div></Card><Card className="p-6"><h3 className="text-lg font-semibold">Sauvegarde locale</h3><p className="mt-2 text-sm text-[#667085]">Crée une sauvegarde de sécurité côté serveur.</p><div className="mt-5"><Button onClick={() => void apiFetch("/api/backup", { method: "POST", body: "{}" }).then(async (response) => notify(response.ok ? "Sauvegarde créée" : (await response.json()).error || "Sauvegarde impossible"))}>Créer une sauvegarde</Button></div></Card></div>;
    return <Card className="p-6"><h2 className="text-xl font-semibold">Administration</h2><div className="mt-5 max-w-xl"><Field label="Organisation" value={state.settings.companyName} onChange={(value) => setState((current) => ({ ...current, settings: { ...current.settings, companyName: value } }))} /></div><div className="mt-5"><Button onClick={() => void saveState(state, "Paramètres enregistrés")}>Enregistrer</Button></div></Card>;
  };

  return <div className="min-h-screen text-[#172033]"><aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-[#e1e5ed] bg-[#f9fafc] lg:block"><div className="flex h-20 items-center border-b border-[#e6e9f0] px-5"><button onClick={() => setView("dashboard")} className="text-left"><span className="block font-bold">AI Process Studio</span><span className="text-[11px] uppercase tracking-[.16em] text-[#8b93a3]">Community</span></button></div><nav className="px-3 py-5">{NAV.map((item) => <button key={item.id} onClick={() => setView(item.id)} className={classes("mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold", view === item.id ? "bg-[#eeecff] text-[#5149c2]" : "text-[#596275] hover:bg-[#f0f2f6]")}>{item.label}</button>)}</nav><div className="m-4 rounded-2xl bg-[#302d69] p-4 text-white"><p className="text-xs font-semibold">Community</p><p className="mt-2 text-[11px] text-[#cbc9e5]">Local-first · sans licence requise</p></div></aside><main className="min-h-screen lg:ml-72"><header className="sticky top-0 z-20 border-b border-[#e2e6ed] bg-[#f5f7fb]/95 backdrop-blur"><div className="flex min-h-20 items-center gap-4 px-4 sm:px-6 xl:px-9"><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7b74da]">AI Process Studio Community</p><h1 className="truncate text-xl font-semibold">{NAV.find((item) => item.id === view)?.label}</h1></div><select value={activeProcessId || ""} onChange={(event) => setActiveProcessId(event.target.value)} className="hidden max-w-64 rounded-xl border border-[#dce1ea] bg-white px-3 py-2 text-xs sm:block"><option value="">Processus</option>{state.processes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></header><div className="mx-auto max-w-[1640px] px-4 py-6 sm:px-6 xl:px-9 xl:py-8">{render()}</div></main>{toast && <div className="fixed bottom-5 right-5 z-50 rounded-2xl bg-[#172033] px-4 py-3 text-sm font-semibold text-white shadow-2xl">{toast}</div>}</div>;
}
