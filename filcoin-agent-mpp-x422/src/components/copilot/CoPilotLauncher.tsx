/**
 * Floating launcher button — opens the Co-Pilot panel from any screen.
 */
import React, { useState } from 'react';
import { IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { sparkles } from 'ionicons/icons';
import CoPilotPanel from './CoPilotPanel';

export const CoPilotLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ marginBottom: 24, marginRight: 16 }}>
        <IonFabButton onClick={() => setOpen(true)} color="primary" title="Open Invoice Co-Pilot">
          <IonIcon icon={sparkles} />
        </IonFabButton>
      </IonFab>
      <CoPilotPanel isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default CoPilotLauncher;
