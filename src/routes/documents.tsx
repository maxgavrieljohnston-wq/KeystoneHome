import { useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { useAuthReady } from "@/hooks/useAuthReady";
import {
  LENDER_CHECKLIST,
  type ChecklistItemId,
  listLenderDocuments,
  recordLenderDocument,
  deleteLenderDocument,
  getLenderDocumentDownloadUrl,
} from "@/lib/documents.functions";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Document vault — Keystone" },
      { name: "description", content: "Guided checklist + secure storage for everything your lender will ask for." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: DocumentsPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#527f5c",
  gold: "#c79933",
};

const mono = "'JetBrains Mono', monospace";
const MAX_FILE = 25 * 1024 * 1024; // 25 MB

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type DocRow = {
  id: string;
  checklist_item: ChecklistItemId;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  status: string;
  created_at: string;
};

function DocumentsPage() {
  const auth = useAuthReady();
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const proLocked = !sub.loading && !sub.isPro;
  const qc = useQueryClient();
  const fetchDocs = useServerFn(listLenderDocuments);
  const recordDoc = useServerFn(recordLenderDocument);
  const removeDoc = useServerFn(deleteLenderDocument);
  const signUrl = useServerFn(getLenderDocumentDownloadUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["lender-docs", auth.user?.id],
    queryFn: () => fetchDocs(),
    enabled: auth.ready && !!auth.user && !proLocked,
  });
  const docs = (data?.documents ?? []) as DocRow[];

  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (vars: { item: ChecklistItemId; file: File }) => {
      if (!auth.user) throw new Error("Not signed in");
      if (vars.file.size > MAX_FILE) throw new Error("File too large (max 25 MB)");
      const safeName = vars.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${auth.user.id}/${vars.item}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("lender-docs").upload(path, vars.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: vars.file.type || undefined,
      });
      if (error) throw new Error(error.message);
      await recordDoc({
        data: {
          checklistItem: vars.item,
          filePath: path,
          fileName: vars.file.name,
          fileSize: vars.file.size,
          mimeType: vars.file.type || null,
        },
      });
    },
    onSuccess: () => {
      setUploadError(null);
      qc.invalidateQueries({ queryKey: ["lender-docs"] });
    },
    onError: (err: Error) => setUploadError(err.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeDoc({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lender-docs"] }),
  });

  const download = async (id: string) => {
    try {
      const { url, fileName } = await signUrl({ data: { id } });
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't download");
    }
  };

  const docsByItem = LENDER_CHECKLIST.reduce<Record<string, DocRow[]>>((acc, item) => {
    acc[item.id] = docs.filter((d) => d.checklist_item === item.id);
    return acc;
  }, {});

  const requiredCount = LENDER_CHECKLIST.filter((c) => c.required).length;
  const requiredDone = LENDER_CHECKLIST.filter((c) => c.required && (docsByItem[c.id]?.length ?? 0) > 0).length;

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: "'Cormorant Garamond', Georgia, serif", padding: "28px 20px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Header />
        <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
          Pre-qual paperwork, sorted.
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, marginBottom: 28 }}>
          Upload everything once — securely. When you're ready to talk to a lender, it's all here.
        </p>

        {proLocked ? (
          <LockedCard onUpgrade={() => gate.openUpgrade("pro", "Lender pre-qual doc vault")} />
        ) : (
          <>
            <ProgressCard done={requiredDone} total={requiredCount} />
            {uploadError && (
              <div style={{ background: "#fff", border: `1px solid ${C.ember}`, borderRadius: 10, padding: 14, color: C.ember, marginBottom: 14 }}>
                {uploadError}
              </div>
            )}
            {isLoading ? (
              <p style={{ color: C.inkMute }}>Loading…</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {LENDER_CHECKLIST.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    docs={docsByItem[item.id] ?? []}
                    onUpload={(file) => upload.mutate({ item: item.id, file })}
                    onDelete={(id) => del.mutate(id)}
                    onDownload={download}
                    isUploading={upload.isPending && upload.variables?.item === item.id}
                  />
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, color: C.inkMute, marginTop: 18, lineHeight: 1.5 }}>
              Files are stored privately. Only you can read them. Max 25 MB per file.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.ink}`, marginBottom: 32 }}>
      <Link to="/dashboard" style={{ color: C.inkMute, fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none" }}>
        ← Dashboard
      </Link>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember }}>
        Doc vault · Pro
      </div>
    </div>
  );
}

function LockedCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div style={{ border: `1.5px solid ${C.ink}`, borderRadius: 12, padding: 28, textAlign: "center" }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember, marginBottom: 8 }}>Pro feature</div>
      <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 12px" }}>One folder. Every document.</h2>
      <p style={{ color: C.inkSoft, marginBottom: 18 }}>
        Get a head start on your mortgage application — checklist + private file storage in one place.
      </p>
      <button type="button" onClick={onUpgrade} style={{ background: C.ink, color: C.paper, padding: "14px 22px", border: "none", borderRadius: 8, fontFamily: mono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>
        Upgrade to Pro →
      </button>
    </div>
  );
}

function ProgressCard({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkMute }}>
          Required documents
        </span>
        <span style={{ fontFamily: mono, fontSize: 12, color: pct === 100 ? C.sage : C.ember }}>
          {done} / {total}
        </span>
      </div>
      <div style={{ height: 6, background: C.paper, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? C.sage : C.ember, transition: "width 200ms ease" }} />
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  docs,
  onUpload,
  onDelete,
  onDownload,
  isUploading,
}: {
  item: { id: ChecklistItemId; title: string; required: boolean; hint: string };
  docs: DocRow[];
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
  isUploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filled = docs.length > 0;

  return (
    <div style={{ background: "#fff", border: `1px solid ${filled ? C.sage : C.inkFaint}`, borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 500, fontSize: 17 }}>
              {filled ? "✓" : "○"} {item.title}
            </span>
            {!item.required && (
              <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.inkMute, padding: "2px 8px", border: `1px solid ${C.inkFaint}`, borderRadius: 999 }}>
                Optional
              </span>
            )}
          </div>
          <div style={{ color: C.inkMute, fontSize: 13 }}>{item.hint}</div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          style={{ background: "transparent", border: `1px solid ${C.ink}`, color: C.ink, padding: "8px 12px", borderRadius: 6, fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: isUploading ? "default" : "pointer", opacity: isUploading ? 0.5 : 1, whiteSpace: "nowrap" }}
        >
          {isUploading ? "…" : "+ Add file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      {docs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {docs.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", background: C.paper, borderRadius: 6 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.file_name}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: C.inkMute }}>
                  {formatSize(d.file_size)} · {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
              <button type="button" onClick={() => onDownload(d.id)} style={linkBtn}>Download</button>
              <button type="button" onClick={() => { if (confirm("Delete this file?")) onDelete(d.id); }} style={{ ...linkBtn, color: C.ember }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  fontFamily: mono,
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: C.inkSoft,
  cursor: "pointer",
};
