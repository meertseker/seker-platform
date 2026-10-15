'use client';

import { Drawer } from './Drawer';

export function PhonePreview({ onClose }: { onClose(): void }) {
  return (
    <Drawer title="Telefon görünümü (kaydedilmiş hâli)" onClose={onClose}>
      <iframe title="Telefon önizlemesi" src={window.location.pathname} style={{ width: 390, maxWidth: '100%', height: 760, border: '8px solid #2a1840', borderRadius: 28 }} />
    </Drawer>
  );
}
