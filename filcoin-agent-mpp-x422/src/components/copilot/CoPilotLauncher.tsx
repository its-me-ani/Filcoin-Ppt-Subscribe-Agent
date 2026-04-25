/**
 * Floating launcher button — navigates to the Co-Pilot page.
 */
import React from 'react';
import { IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { sparkles } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

export const CoPilotLauncher: React.FC = () => {
  const history = useHistory();
  return (
    <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ marginBottom: 24, marginRight: 16 }}>
      <IonFabButton onClick={() => history.push('/app/dashboard/copilot')} color="primary" title="Open Invoice Co-Pilot">
        <IonIcon icon={sparkles} />
      </IonFabButton>
    </IonFab>
  );
};

export default CoPilotLauncher;
