'use client';

import { useState, useTransition } from 'react';
import { uploadImage } from '@/app/actions/media';
import type { ImageValue } from '@/lib/content/types';
import { Drawer } from './Drawer';

export function UploadDialog({ title, current, onDone, onClose }: {
  title: string; current: ImageValue; onDone(v: ImageValue): void; onClose(): void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState(current.alt);
  const [faces, setFaces] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const preview = file ? URL.createObjectURL(file) : current.src;

  function submit() {
    setError(null);
    if (!file) return setError('Bir fotoğraf seçin.');
    if (file.size > 10 * 1024 * 1024) return setError('Fotoğraf 10 MB’tan büyük. Daha küçük bir kopyasını yükleyin.');
    const f = new FormData();
    f.set('file', file);
    f.set('alt', alt);
    f.set('faces', faces);
    start(async () => {
      const r = await uploadImage(f);
      if (!r.ok) return setError(r.error);
      onDone({ src: r.asset.src, alt: r.asset.alt, width: r.asset.width, height: r.asset.height, assetId: r.asset.id });
    });
  }

  return (
    <Drawer title={title} onClose={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 12 }} />
      <label style={{ display: 'grid', gap: 4 }}>
        Fotoğraf
        <input id="seker-upload-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <label style={{ display: 'grid', gap: 4, marginTop: 12 }}>
        Kısa açıklama (görme engelli ziyaretçiler ve Google için)
        <input id="seker-upload-alt" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} />
      </label>
      <fieldset style={{ marginTop: 12 }}>
        <legend>Fotoğrafta çocuk yüzü var mı? (zorunlu)</legend>
        <label style={{ display: 'flex', gap: 6 }}>
          <input id="seker-faces-yok" type="radio" name="faces" value="yok" checked={faces === 'yok'} onChange={() => setFaces('yok')} />
          Fotoğrafta çocuk yüzü yok
        </label>
        <label style={{ display: 'flex', gap: 6 }}>
          <input id="seker-faces-izin" type="radio" name="faces" value="bulanik_veya_izinli" checked={faces === 'bulanik_veya_izinli'} onChange={() => setFaces('bulanik_veya_izinli')} />
          Yüzler bulanıklaştırıldı veya velinin yazılı izni dosyada
        </label>
      </fieldset>
      {error ? <p role="alert" style={{ color: '#b4234e' }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={submit} disabled={busy}>{busy ? 'Yükleniyor…' : 'Yükle'}</button>
        <button type="button" onClick={onClose}>Vazgeç</button>
      </div>
      <p style={{ fontSize: 13, color: '#5f4f75' }}>Konum bilgisi fotoğraftan otomatik silinir. Fotoğraf &quot;Kaydet&quot;e basınca yayınlanır.</p>
    </Drawer>
  );
}
