import {ShieldAlert} from 'lucide-react';
import type {IncidentAttention} from './IncidentWorkspace';

export function IncidentNavIndicator({attention}: {attention:IncidentAttention}) {
  if (!attention.pending && !attention.followup) return null;
  const description=attention.pending ? `${attention.pending} incidente(s) pendiente(s). Ir al panel principal para revisar.` : 'Geocerca por revisar. Ir al panel principal.';
  return <span className="nav-attention-badge" title={description} aria-label={description}><ShieldAlert size={15}/>{attention.pending>0 && <b>{attention.pending}</b>}</span>;
}
