"use client";

import { useState, useTransition } from "react";
import { setCanEditSite } from "@/actions/site-editors";

export interface StaffRow {
  id: string;
  fullName: string;
  canEditSite: boolean;
}

export function SiteEditorToggle({ staff }: { staff: StaffRow[] }) {
  const [rows, setRows] = useState(staff);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(id: string, value: boolean) {
    setError(null);
    start(async () => {
      const res = await setCanEditSite(id, value);
      if (!res.ok) return setError(res.error ?? "Kaydedilemedi.");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, canEditSite: value } : r)));
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Site düzenleme yetkisi</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Yetkisi olan kişi panelden &quot;Siteyi düzenle&quot;ye basarak sitedeki yazıları ve fotoğrafları değiştirebilir.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2">
            <span>{r.fullName}</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                id={`site-edit-${r.id}`}
                type="checkbox"
                checked={r.canEditSite}
                disabled={pending}
                onChange={(e) => toggle(r.id, e.target.checked)}
              />
              Siteyi düzenleyebilir
            </label>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
