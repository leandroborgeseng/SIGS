'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';

export default function ProntuarioPage() {
  const params = useParams<{ id: string }>();
  return (
    <AppShell helpId="cadastros.pacientes">
      <PageHeader
        title="Prontuário"
        description="Timeline clínica — placeholder do MVP visual (próxima rodada de design)."
        actions={<Link className="btn btn-secondary" href={`/pacientes/${params.id}`}>Voltar à ficha</Link>}
      />
      <div className="card">
        <p>Os atendimentos e vacinas do paciente aparecerão aqui em ordem cronológica.</p>
      </div>
    </AppShell>
  );
}
