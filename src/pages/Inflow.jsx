// src/pages/Inflow.jsx — Proago CRM
// v2025-11-14 • Inflow: column alignment + ghost Calls + per-section memory (date/time/comment) + comment modal + auto-sort
// Notes:
// - Keeps your original structure, imports, audit log, importers, templates.
// - Columns are locked by colgroup in ALL sections -> perfect alignment.
// - Interview/Formation render a ghost Calls cell to keep symmetry.
// - Move preserves/recalls date/time/comment per section via _stageMeta.
// - Comment modal per row; stored per section in _stageMeta[section].comment.
// - Auto-sort by date then time inside each section after edits/moves/add/import.

import React, { useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Upload, Trash2, Plus, ChevronUp, ChevronDown, Bell, MessageCircle } from "lucide-react";
import * as U from "../util.js";

const { titleCase, clone, fmtISO, addAuditLog, load, K, DEFAULT_SETTINGS } = U;

// --- col widths identical in all sections (sum = 100%) ---
// (Using your table + colgroup approach to guarantee alignment)
const COLS = [
  { w: "18%" }, // Name
  { w: "18%" }, // Mobile
  { w: "20%" }, // Email
  { w: "12%" }, // Source
  { w: "12%" }, // Date
  { w: "8%"  }, // Time
  { w: "4%"  }, // Calls (ghosted in Interview/Formation to keep symmetry)
  { w: "8%"  }, // Actions (includes comment button)
];

// fixed-size action slots (so rows never shift)
const BTN_W = 36, BTN_H = 36;
const BtnSlot = ({ children }) =>
  children ? children : <span className="inline-block" style={{ width: BTN_W, height: BTN_H }} aria-hidden="true" />;

// center native date/time text cross-browser
const DateCenterStyle = () => (
  <style>{`
    input.date-center { text-align:center; }
    input.date-center::-webkit-datetime-edit { text-align:center; }
    input[type="time"].time-center { text-align:center; }
    input[type="time"].time-center::-webkit-datetime-edit { text-align:center; }
  `}</style>
);

const PREFIXES = ["+352", "+33", "+32", "+49"];

function formatPhoneByCountry(prefix, localDigits) {
  const d = String(localDigits || "").replace(/\D+/g, "");
  switch (prefix) {
    case "+352": { let o = "+352"; if (d) o += " " + d.slice(0,3); if (d.length>3) o += " " + d.slice(3,6); if (d.length>6) o += " " + d.slice(6,9); return o; }
    case "+33": { const b = d.replace(/^0/,""); let o = "+33"; if (b) o += " " + b.slice(0,1); if (b.length>1) o += " " + b.slice(1,3); if (b.length>3) o += " " + b.slice(3,5); if (b.length>5) o += " " + b.slice(5,7); if (b.length>7) o += " " + b.slice(7,9); return o; }
    case "+32": { const b = d.replace(/^0/,""); let o = "+32"; if (b) o += " " + b.slice(0,3); if (b.length>3) o += " " + b.slice(3,5); if (b.length>5) o += " " + b.slice(5,7); if (b.length>7) o += " " + b.slice(7,9); return o; }
    case "+49": { const b = d.replace(/^0/,""); let o = "+49"; if (b) o += " " + b.slice(0,4); if (b.length>4) o += " " + b.slice(4,7); if (b.length>7) o += " " + b.slice(7,11); return o; }
    default: return `${prefix} ${d}`.trim();
  }
}

function getSettings() {
  const s = load(K.settings, DEFAULT_SETTINGS) || {};
  return {
    ...s,
    notifyFrom: {
      email: s.notifyFrom?.email || "noreply@proago.com",
      phone: s.notifyFrom?.phone || "+352 691 337 633",
    },
  };
}

// ---- Templates (LB/FR/DE) with dd/mm/yyyy rendering ----
const TPL = {
  call: {
    lb: `Moien {name},

Entschëllegt, dass ech Iech stéieren. Ech erlaaben mir just Iech kuerz unzeruffen, well Dir Iech iwwer Indeed bei eis beworben hutt.

Ech wollt einfach nofroen, ob Dir nach interesséiert sidd un der Aarbecht bei eis. Zéckt wgl. net, ierch sou séier wéi méiglech bei mir ze mellen.

Ech wenschen Iech nach en agreabelen Daag.

Mat beschte Gréiss,
Garcia Oscar
CEO – Proago, Face to Face Marketing`,
    fr: `Bonjour {name},

Désolé(e) de vous déranger. Je me permets de vous appeler brièvement car vous avez postulé chez nous via Indeed.

Je voulais simplement savoir si vous êtes toujours intéressé(e) par le poste. N’hésitez pas à me recontacter dès que possible.

Je vous souhaite une agréable journée.

Cordialement,
Garcia Oscar
CEO – Proago, Face to Face Marketing`,
    de: `Guten Tag {name},

Entschuldigen Sie die Störung. Ich erlaube mir, Sie kurz anzurufen, da Sie sich über Indeed bei uns beworben haben.

Ich wollte nur nachfragen, ob Sie noch an der Stelle interessiert sind. Bitte zögern Sie nicht, sich so bald wie möglich bei mir zu melden.

Ich wünsche Ihnen einen angenehmen Tag.

Mit freundlichen Grüßen,
Garcia Oscar
CEO – Proago, Face to Face Marketing`,
  },
  interview: {
    lb: `Moien {name},

No eisem leschten Telefongespréich gouf en Entretien festgeluecht fir den {date} um {time}.

Den Entretien fënnt am Coffee Fellows statt, op dëser Adress:
4 Place de Paris, 2314 Lëtzebuerg (Quartier Gare, bei der Arrêt Zitha/Paris).

Dir kënnt am Parking Fort Neipperg parken, ongeféier 5–6 Minutte Fousswee ewech:
43, rue du Fort Neipperg, 2230 Lëtzebuerg (Quartier Gare).

Wann Dir nach Froen hutt, kënnt Dir Iech gären bei mir mellen.
Mat frëndleche Gréiss,
Oscar Garcia Saint-Medar
CEO vun Proago`,
    fr: `Bonjour {name},

Suite à notre dernier appel, un entretien est prévu le {date} à {time}.

L’entretien aura lieu chez Coffee Fellows, à l’adresse suivante :
4 Place de Paris, 2314 Luxembourg (quartier Gare, arrêt Zitha/Paris).

Vous pouvez vous garer au Parking Fort Neipperg, à environ 5–6 minutes à pied :
43, rue du Fort Neipperg, 2230 Luxembourg (quartier Gare).

Si vous avez des questions, n’hésitez pas à me contacter.
Cordialement,
Oscar Garcia Saint-Medar
CEO de Proago`,
    de: `Guten Tag {name},

Nach unserem letzten Telefonat wurde ein Vorstellungsgespräch für den {date} um {time} vereinbart.

Das Gespräch findet bei Coffee Fellows statt, unter folgender Adresse:
4 Place de Paris, 2314 Luxemburg (Stadtteil Gare, Haltestelle Zitha/Paris).

Sie können im Parking Fort Neipperg parken, etwa 5–6 Minuten zu Fuß:
43, rue du Fort Neipperg, 2230 Luxemburg (Stadtteil Gare).

Bei Fragen können Sie sich gerne bei mir melden.
Mit freundlichen Grüßen,
Oscar Garcia Saint-Medar
CEO von Proago`,
  },
  formation: {
    lb: `Moien {name},

No eisem Entetien gouf eng Formatioun festgeluecht fir den {date} um {time}.

D’Formatioun fënnt bei Eis statt, op dës er Adress:
9a Rue de Chiny, 1334 Lëtzebuerg (Quartier Gare).

Dir kënnt am Parking Fort Neipperg parken, ongeféier 15–16 Minutte Fousswee ewech:
43, rue du Fort Neipperg, 2230 Lëtzebuerg (Quartier Gare).

Wann Dir nach Froen hutt, kënnt Dir Iech gären bei mir mellen.
Mat frëndleche Gréiss,
Oscar Garcia Saint-Medar
CEO vun Proago`,
    fr: `Bonjour {name},

Suite à notre entretien, une formation est prévue le {date} à {time}.

La formation aura lieu chez nous, à l’adresse suivante :
9a Rue de Chiny, 1334 Luxembourg (quartier Gare).

Vous pouvez vous garer au Parking Fort Neipperg, à environ 15–16 minutes à pied :
43, rue du Fort Neipperg, 2230 Luxembourg (quartier Gare).

Si vous avez des questions, n’hésitez pas à me contacter.
Cordialement,
Oscar Garcia Saint-Medar
CEO de Proago`,
    de: `Guten Tag {name},

Nach unserem Gespräch wurde eine Schulung für den {date} um {time} geplant.

Die Schulung findet bei uns statt, unter folgender Adresse:
9a Rue de Chiny, 1334 Luxemburg (Stadtteil Gare).

Sie können im Parking Fort Neipperg parken, etwa 15–16 Minuten zu Fuß:
43, rue du Fort Neipperg, 2230 Luxemburg (Stadtteil Gare).

Bei Fragen können Sie sich gerne bei mir melden.
Mit freundlichen Grüßen,
Oscar Garcia Saint-Medar
CEO von Proago`,
  },
};

function compileTemplate(tpl, lead) {
  const ddmm = lead.date ? new Date(lead.date).toLocaleDateString("en-GB") : "(dd/mm/yyyy)";
  const t = lead.time || "(time)";
  return (tpl || "")
    .replaceAll("{name}", titleCase(lead.name || ""))
    .replaceAll("{date}", ddmm)
    .replaceAll("{time}", t);
}

// ---- Visual bell logic (unchanged for interview/formation; leads at >=3) ----
function shouldShowBell(stage, lead) {
  if (stage === "leads") return (lead.calls ?? 0) >= 3;        // max calls reached
  if (stage === "interview" || stage === "formation") return Boolean(lead.date && lead.time);
  return false;
}

// ---- Small local-edit cell that only commits onBlur/Enter (kept)
function EditableCell({ value, onCommit, type = "text", placeholder, inputMode, className = "" }) {
  const [val, setVal] = useState(value ?? "");
  React.useEffect(() => { setVal(value ?? ""); }, [value]);
  const commit = () => { if (val !== value) onCommit(val); };
  const onKeyDown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); e.currentTarget.blur(); } };
  return (
    <Input
      type={type}
      inputMode={inputMode}
      className={`w-full ${className}`}
      placeholder={placeholder}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

// ---------- New Lead Dialog (kept) ----------
const AddLeadDialog = ({ open, onOpenChange, onSave }) => {
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("+352");
  const [localMobile, setLocalMobile] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("Indeed");
  const [calls, setCalls] = useState(0);

  const builtPhone = useMemo(() => {
    const digits = (localMobile || "").replace(/\D+/g, "");
    return digits ? formatPhoneByCountry(prefix, digits) : "";
  }, [prefix, localMobile]);

  const save = () => {
    const nm = titleCase(name);
    if (!nm) return alert("Name required.");
    if (!builtPhone && !email.trim()) return alert("At least Mobile or Email is required.");
    if (email && !email.includes("@")) return alert("Email must contain '@'.");

    const now = new Date();
    const lead = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      name: nm,
      phone: builtPhone || "",
      email: email.trim(),
      source: source.trim(),
      calls: Math.min(Math.max(Number(calls || 0), 0), 3),
      date: fmtISO(now),
      time: now.toTimeString().slice(0, 5),
      _stageMeta: {}, // per-stage memory
    };
    onSave(lead);
    addAuditLog({ area: "Inflow", action: "Add Lead", lead: { id: lead.id, name: lead.name, source: lead.source } });
    onOpenChange(false);
    setName(""); setPrefix("+352"); setLocalMobile(""); setEmail(""); setSource("Indeed"); setCalls(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader><DialogTitle className="text-center">Lead</DialogTitle></DialogHeader>

        <div className="grid gap-3 text-center items-center">
          <div className="grid gap-1">
            <Label>Full Name</Label>
            <Input placeholder="John Doe" className="text-center" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-1">
            <Label>Mobile</Label>
            <div className="flex gap-2 justify-center">
              <select className="h-10 border rounded-md px-2" value={prefix} onChange={(e) => setPrefix(e.target.value)}>
                {PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <Input
                placeholder="mobile number"
                className="text-center"
                value={localMobile}
                onChange={(e) => setLocalMobile(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label>Email</Label>
            <Input type="email" placeholder="johndoe@gmail.com" className="text-center" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid gap-1">
            <Label>Source</Label>
            <select className="h-10 border rounded-md px-2 mx-auto" value={source} onChange={(e) => setSource(e.target.value)}>
              <option>Indeed</option>
              <option>Street</option>
              <option>Referral</option>
              <option>Other</option>
            </select>
          </div>

          <div className="grid gap-1">
            <Label>Calls (0–3)</Label>
            <div className="w-12 mx-auto">
              <Input
                inputMode="numeric"
                className="text-center"
                value={String(calls)}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(3, Number(String(e.target.value).replace(/\D/g, "")) || 0));
                  setCalls(n);
                }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="justify-center gap-2 mt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" style={{ background: "black", color: "white" }} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---- Sorting helpers (date asc, then time asc) -----------------------------
const ts = (d, t) => {
  if (!d) return Number.POSITIVE_INFINITY;
  try {
    const [y, m, dd] = d.split("-").map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = (t || "00:00").split(":").map((n) => parseInt(n, 10));
    return new Date(y, (m || 1) - 1, dd, hh, mm).getTime();
  } catch { return Number.POSITIVE_INFINITY; }
};
const sortAsc = (a, b) => {
  const A = ts(a.date, a.time), B = ts(b.date, b.time);
  if (A < B) return -1; if (A > B) return 1; return 0;
};

export default function Inflow({ pipeline, setPipeline, onHire }) {
  const fileRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);

  // Notify state (kept)
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyText, setNotifyText] = useState("");
  const [notifyLead, setNotifyLead] = useState(null);
  const [notifyStage, setNotifyStage] = useState(null);
  const [notifyLang, setNotifyLang] = useState("lb"); // lb | fr | de

  // Comment dialog state
  const [commentDlg, setCommentDlg] = useState({ open: false, section: null, id: null, value: "" });

  const stableUpdate = (updater) =>
    setPipeline((prev) => { const next = clone(prev); updater(next);
      // auto-sort each section after any change
      next.leads = [...(next.leads || [])].sort(sortAsc);
      next.interview = [...(next.interview || [])].sort(sortAsc);
      next.formation = [...(next.formation || [])].sort(sortAsc);
      return next;
    });

  // ---------- Stage move with memory ----------
  // Now: ALWAYS restore target's prior values if they exist (forward or backward).
  const move = (item, from, to) => {
    stableUpdate((next) => {
      const cur = next[from];
      const lead = cur.find((x) => x.id === item.id);
      if (!lead) return;

      if (!lead._stageMeta) lead._stageMeta = {};
      // save from-stage state INCLUDING comment
      const fromSnap = lead._stageMeta[from] || {};
      lead._stageMeta[from] = { date: lead.date || "", time: lead.time || "", comment: fromSnap.comment || "" };

      // remove from the source list
      next[from] = cur.filter((x) => x.id !== item.id);

      // restore previous values for target if any
      const toSnap = (lead._stageMeta[to] || {});
      const incoming = {
        date: toSnap.date || "",
        time: toSnap.time || "",
      };
      const withComment = toSnap.comment != null ? { comment: toSnap.comment } : {};

      next[to] = [...(next[to] || []), { ...lead, ...incoming, ...withComment }];
    });

    addAuditLog({ area: "Inflow", action: "Move", from, to, lead: { id: item.id, name: item.name } });
  };

  const hireFromFormation = (item) => {
    let code = prompt("Crewcode (5 digits):");
    if (!code) return;
    code = String(code).trim();
    if (!/^\d{5}$/.test(code)) { alert("Crewcode must be exactly 5 digits."); return; }
    onHire({ ...item, crewCode: code, role: "Rookie" });
    stableUpdate((next) => { next.formation = next.formation.filter((x) => x.id !== item.id); });
    addAuditLog({ area: "Inflow", action: "Hire", lead: { id: item.id, name: item.name }, crewCode: code });
  };

  const del = (item, from) => {
    if (!confirm("Delete?")) return;
    stableUpdate((next) => { next[from] = next[from].filter((x) => x.id !== item.id); });
    addAuditLog({ area: "Inflow", action: "Delete Lead", from, lead: { id: item.id, name: item.name } });
  };

  // ---------- Importers (JSON/NDJSON/CSV) (kept) ----------
  const parseMaybeCSV = (txt) => {
    const lines = txt.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (k) => headers.findIndex((h) => h.includes(k));
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      out.push({
        name: cols[idx("name")] || "",
        email: cols[idx("mail")] || cols[idx("email")] || "",
        phone: cols[idx("phone")] || cols[idx("mobile")] || "",
        calls: cols[idx("calls")] || 0,
        date: cols[idx("date")] || "",
        time: cols[idx("time")] || "",
        source: cols[idx("source")] || "Indeed",
      });
    }
    return out;
  };

  const normalizeLead = (j) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    name: titleCase(j.name || ""),
    phone: j.phone || "",
    email: (j.email || "").trim(),
    source: j.source || "Indeed",
    calls: Math.min(Math.max(Number(j.calls || 0), 0), 3),
    date: /^\d{4}-\d{2}-\d{2}$/.test(j.date || "") ? j.date : fmtISO(new Date()),
    time: j.time || new Date().toTimeString().slice(0, 5),
    _stageMeta: {}, // ensure memory for imported
  });

  const onImport = async (file) => {
    if (!file) return;
    try {
      let txt = await file.text();
      txt = txt.replace(/^\uFEFF/, ""); // strip BOM
      let rows = [];

      // Try JSON object/array first
      try {
        const js = JSON.parse(txt);

        // CASE A: array
        if (Array.isArray(js)) rows = js;
        // CASE B: common array containers
        else if (Array.isArray(js?.results)) rows = js.results;
        else if (Array.isArray(js?.candidates)) rows = js.candidates;
        else if (Array.isArray(js?.data)) rows = js.data;
        else if (Array.isArray(js?.applications)) rows = js.applications;
        // CASE C: single-object with applicant node
        else if (js?.applicant) {
          rows = [{
            name: js.applicant.fullName || js.applicant.name || "",
            email: js.applicant.email || js.applicant.mail || "",
            phone: js.applicant.phoneNumber || js.applicant.phone || js.applicant.mobile || "",
            source: "Indeed",
            date: "", time: "",
          }];
        }
      } catch {
        // Not standard JSON → try NDJSON
        rows = txt
          .split(/\r?\n/)
          .map((line) => { try { return JSON.parse(line); } catch { return null; } })
          .filter(Boolean);
      }

      // CSV fallback
      if (!rows.length && txt.includes(",") && txt.includes("\n")) rows = parseMaybeCSV(txt);

      if (!rows.length) { alert("Could not parse this file. Please upload an Indeed JSON or CSV export."); return; }

      const leads = rows
        .map((row) => {
          const name =
            row.name ||
            row.full_name ||
            row.candidate ||
            `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
            row.applicant?.fullName ||
            "";

          const phone =
            row.phone ||
            row.phone_number ||
            row.mobile ||
            row.contact?.phone ||
            row.contact?.phones?.[0] ||
            row.applicant?.phoneNumber ||
            "";

          const email =
            row.email ||
            row.mail ||
            row.contact?.email ||
            row.contact?.emails?.[0] ||
            row.applicant?.email ||
            "";

          const source = row.source || row.platform || "Indeed";
          const calls = row.calls ?? 0;
          const date = row.date || row.applied_at || row.created_at || row.timestamp || "";
          const time = row.time || "";

          return { name, phone, email, source, calls, date, time };
        })
        .filter((j) => j.name && (j.phone || j.email))
        .map(normalizeLead);

      if (!leads.length) { alert("No valid leads found in file (missing name/phone/email)."); return; }

      setPipeline((p) => ({ ...p, leads: [...leads, ...p.leads].sort(sortAsc) })); // sort after import
      addAuditLog({ area: "Inflow", action: "Import", source: "Indeed", count: leads.length });
      alert(`Imported ${leads.length} lead(s).`);
    } catch (e) {
      console.error("Import error:", e);
      alert("Import failed. Please use an Indeed JSON or CSV export.");
    }
  };

  // ---------- Notify ----------
  const openNotify = (lead, stage) => {
    const base = TPL[stage === "interview" ? "interview" : stage === "formation" ? "formation" : "call"];
    setNotifyText(compileTemplate(base[notifyLang], lead));
    setNotifyLead(lead);
    setNotifyStage(stage);
    setNotifyOpen(true);
  };

  const sendNotify = () => {
    if (!notifyLead) return;
    const from = getSettings().notifyFrom;
    addAuditLog({
      area: "Notify",
      action: "Send",
      lang: notifyLang,
      stage: notifyStage,
      to: { email: notifyLead.email || null, phone: notifyLead.phone || null },
      from,
      preview: notifyText,
    });
    setNotifyOpen(false);
    setNotifyLead(null);
    setNotifyText("");
    setNotifyStage(null);
  };

  // ---------- Comment modal ----------
  const openComment = (section, id) => {
    const list = pipeline?.[section] || [];
    const row = list.find((r) => r.id === id);
    const existing = row?._stageMeta?.[section]?.comment || "";
    setCommentDlg({ open: true, section, id, value: existing });
  };

  const saveComment = () => {
    const { section, id, value } = commentDlg;
    if (!section || !id) { setCommentDlg({ open: false, section: null, id: null, value: "" }); return; }
    stableUpdate((next) => {
      next[section] = next[section].map((r) => {
        if (r.id !== id) return r;
        const meta = r._stageMeta || {};
        const snap = meta[section] || {};
        meta[section] = { ...snap, comment: value || "" };
        return { ...r, _stageMeta: meta };
      });
    });
    setCommentDlg({ open: false, section: null, id: null, value: "" });
  };

  // ---------- Section renderer ----------
  const Section = ({ title, keyName, prev, nextKey, showCalls, enableHireDown }) => (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{title}</span>
          <Badge>{pipeline[keyName].length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-xl">
          <table className="min-w-full text-sm table-fixed">
            <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: c.w }} />)}</colgroup>
            <thead className="bg-zinc-50">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Mobile</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-center">Source</th>
                <th className="p-3 text-center">Date</th>
                <th className="p-3 text-center">Time</th>
                <th className="p-3 text-center">{showCalls ? "Calls" : ""}</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pipeline[keyName].map((x) => {
                const stage = keyName;
                const showBell = shouldShowBell(stage, x);

                return (
                  <tr key={x.id} className="border-t">
                    {/* NAME (editable) */}
                    <td className="p-3 font-medium min-w-0 overflow-hidden whitespace-nowrap">
                      <EditableCell
                        value={x.name}
                        placeholder="Full name"
                        onCommit={(val) =>
                          stableUpdate((p) => {
                            p[keyName] = p[keyName].map((it) => (it.id === x.id ? { ...it, name: val } : it));
                          })
                        }
                      />
                    </td>

                    {/* MOBILE */}
                    <td className="p-3 min-w-0 overflow-hidden whitespace-nowrap">
                      <EditableCell
                        value={x.phone || ""}
                        placeholder="mobile number"
                        onCommit={(val) =>
                          stableUpdate((p) => {
                            p[keyName] = p[keyName].map((it) => (it.id === x.id ? { ...it, phone: val } : it));
                          })
                        }
                      />
                    </td>

                    {/* EMAIL */}
                    <td className="p-3 min-w-0 overflow-hidden whitespace-nowrap">
                      <EditableCell
                        type="email"
                        value={x.email || ""}
                        placeholder="johndoe@gmail.com"
                        onCommit={(val) =>
                          stableUpdate((p) => {
                            p[keyName] = p[keyName].map((it) => (it.id === x.id ? { ...it, email: val } : it));
                          })
                        }
                      />
                    </td>

                    {/* SOURCE (read-only text keeps alignment) */}
                    <td className="p-3 text-center min-w-0 overflow-hidden whitespace-nowrap">{x.source}</td>

                    {/* DATE */}
                    <td className="p-3 min-w-0 overflow-hidden whitespace-nowrap">
                      <EditableCell
                        type="date"
                        className="date-center"
                        value={x.date || ""}
                        onCommit={(val) =>
                          stableUpdate((p) => {
                            p[keyName] = p[keyName].map((it) => (it.id === x.id ? { ...it, date: val } : it));
                          })
                        }
                      />
                    </td>

                    {/* TIME */}
                    <td className="p-3 min-w-0 overflow-hidden whitespace-nowrap">
                      <EditableCell
                        type="time"
                        className="time-center"
                        value={x.time || ""}
                        onCommit={(val) =>
                          stableUpdate((p) => {
                            p[keyName] = p[keyName].map((it) => (it.id === x.id ? { ...it, time: val } : it));
                          })
                        }
                      />
                    </td>

                    {/* CALLS — ghosted for Interview/Formation to keep alignment */}
                    <td className="p-3 text-center min-w-0 overflow-hidden whitespace-nowrap">
                      {showCalls ? (
                        <div className="mx-auto" style={{ width: 64 }}>
                          <EditableCell
                            inputMode="numeric"
                            className="text-center"
                            value={String(x.calls ?? 0)}
                            onCommit={(val) =>
                              stableUpdate((p) => {
                                const n = Math.max(0, Math.min(3, Number(String(val).replace(/\D/g, "")) || 0));
                                p[keyName] = p[keyName].map((it) => (it.id === x.id ? { ...it, calls: n } : it));
                              })
                            }
                          />
                        </div>
                      ) : (
                        <div className="h-10" />
                      )}
                    </td>

                    {/* Actions — Comment • Bell • Up • Down • Trash (fixed slots) */}
                    <td className="p-3">
                      <div className="flex gap-2 justify-end items-center">
                        {/* Comment */}
                        <BtnSlot>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            title="Comment"
                            className="p-0"
                            style={{ width: BTN_W, height: BTN_H }}
                            onClick={() => openComment(stage, x.id)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </BtnSlot>

                        {/* Bell */}
                        <BtnSlot>
                          {showBell && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              title="Notify"
                              className="p-0"
                              style={{ background: "black", color: "white", width: BTN_W, height: BTN_H }}
                              onClick={() => openNotify(x, stage)}
                            >
                              <Bell className="h-4 w-4" color="white" />
                            </Button>
                          )}
                        </BtnSlot>

                        {/* Up */}
                        <BtnSlot>
                          {prev && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              title="Back"
                              className="p-0"
                              style={{ width: BTN_W, height: BTN_H }}
                              onClick={() => move(x, keyName, prev)}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                          )}
                        </BtnSlot>

                        {/* Down (Formation -> Hire) */}
                        <BtnSlot>
                          {nextKey || enableHireDown ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              title={enableHireDown ? "Hire" : "Move"}
                              className="p-0"
                              style={{ width: BTN_W, height: BTN_H }}
                              onClick={() => (enableHireDown ? hireFromFormation(x) : move(x, keyName, nextKey))}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </BtnSlot>

                        {/* Trash */}
                        <BtnSlot>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="p-0"
                            style={{ width: BTN_W, height: BTN_H }}
                            onClick={() => del(x, keyName)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </BtnSlot>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  // --------- Toolbar & layout ----------
  return (
    <div className="grid gap-4">
      <DateCenterStyle />

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <div />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setAddOpen(true)} style={{ background: "black", color: "white" }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
          <Button type="button" onClick={() => fileRef.current?.click()} style={{ background: "black", color: "white" }}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".json,.csv,application/json,text/csv"
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* Sections */}
      <Section title="Leads" keyName="leads" nextKey="interview" showCalls />
      <Section title="Interview" keyName="interview" prev="leads" nextKey="formation" showCalls={false} />
      <Section title="Formation" keyName="formation" prev="interview" showCalls={false} enableHireDown />

      {/* New Lead */}
      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(lead) => setPipeline((p) => ({ ...p, leads: [lead, ...p.leads].sort(sortAsc) }))}
      />

      {/* Notify — language + message only (compact) */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent size="lg">
          <DialogHeader><DialogTitle className="text-center">Notify</DialogTitle></DialogHeader>

          <div className="grid gap-3 place-items-center text-center">
            {notifyLead && (
              <>
                <div className="w-full max-w-xs">
                  <select
                    className="h-9 border rounded-md px-2 w-full text-center"
                    value={notifyLang}
                    onChange={(e) => {
                      const lang = e.target.value;
                      setNotifyLang(lang);
                      const base = TPL[
                        notifyStage === "interview" ? "interview" :
                        notifyStage === "formation" ? "formation" : "call"
                      ];
                      setNotifyText(compileTemplate(base[lang], notifyLead));
                    }}
                  >
                    <option value="lb">Lëtzebuergesch</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>

                <textarea
                  className="border rounded-md p-2 w-full h-56"
                  value={notifyText}
                  onChange={(e) => setNotifyText(e.target.value)}
                />
              </>
            )}
          </div>

          <DialogFooter className="justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => setNotifyOpen(false)}>Cancel</Button>
            <Button type="button" style={{ background: "black", color: "white" }} onClick={sendNotify}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment modal */}
      <Dialog open={commentDlg.open} onOpenChange={(open) => setCommentDlg((d) => ({ ...d, open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Comment</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="comment">Notes about this person</Label>
            <textarea
              id="comment"
              className="min-h-[140px] w-full border rounded-lg p-2 text-sm"
              value={commentDlg.value}
              onChange={(e) => setCommentDlg((d) => ({ ...d, value: e.target.value }))}
              placeholder="Type notes here..."
            />
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setCommentDlg({ open: false, section: null, id: null, value: "" })}>Cancel</Button>
            <Button onClick={saveComment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
