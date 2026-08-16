'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { FieldToneLegend, LabeledField } from '@/components/ui/FieldHint';
import { api } from '@/lib/api';

export default function NewPatientPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [civilName, setCivilName] = useState('');
  const [socialName, setSocialName] = useState('');
  const [cpf, setCpf] = useState('');
  const [cns, setCns] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('F');
  const [motherName, setMotherName] = useState('');
  const [motherUnknown, setMotherUnknown] = useState(false);
  const [fatherName, setFatherName] = useState('');
  const [fatherUnknown, setFatherUnknown] = useState(false);
  const [isDeceased, setIsDeceased] = useState(false);
  const [deathDate, setDeathDate] = useState('');
  const [deathCertificate, setDeathCertificate] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Franca');
  const [stateUf, setStateUf] = useState('SP');
  const [zip, setZip] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>('/v1/patients', {
        method: 'POST',
        json: {
          civilName,
          socialName: socialName || undefined,
          cpf: cpf || undefined,
          cns: cns || undefined,
          birthDate,
          sex,
          motherName: motherUnknown ? undefined : motherName || undefined,
          motherNameUnknown: motherUnknown,
          fatherName: fatherUnknown ? undefined : fatherName || undefined,
          fatherNameUnknown: fatherUnknown,
          isDeceased,
          deathDate: isDeceased ? deathDate || undefined : undefined,
          deathCertificate: isDeceased ? deathCertificate || undefined : undefined,
          phone: phone || undefined,
          addressStreet: street || undefined,
          addressNumber: number || undefined,
          addressComplement: complement || undefined,
          addressNeighborhood: neighborhood || undefined,
          addressCity: city || undefined,
          addressState: stateUf || undefined,
          addressZip: zip || undefined,
        },
      });
      router.push(`/pacientes/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell helpId="cadastros.pacientes">
      <PageHeader
        title="Novo paciente"
        description="Identificação Siaps (CPF/CNS) e campos condicionais de óbito / “desconhece” mãe-pai. CDS APS completo na ficha após salvar."
        actions={<HelpLink id="cadastros.pacientes" />}
      />
      <ErrorBox message={error} />
      <form className="card" onSubmit={onSubmit}>
        <FieldToneLegend />
        <div className="grid-2">
          <LabeledField label="Nome civil *" tone="siaps" hint="Identificação mínima do cidadão na produção LEDI.">
            <input required value={civilName} onChange={(e) => setCivilName(e.target.value)} />
          </LabeledField>
          <LabeledField label="Nome social" tone="neutral" hint="Sempre visível — exibido nas listagens quando preenchido.">
            <input value={socialName} onChange={(e) => setSocialName(e.target.value)} />
          </LabeledField>
          <LabeledField
            label="CPF"
            tone="siaps"
            hint="cnsCidadao ou cpfCidadao + stNaoPossuiCpf nas fichas — preencha um dos dois quando possível."
          >
            <input className="mono" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={11} />
          </LabeledField>
          <LabeledField label="CNS" tone="siaps" hint="Preferencial para numerador Previne e header LEDI.">
            <input className="mono" value={cns} onChange={(e) => setCns(e.target.value)} maxLength={16} />
          </LabeledField>
          <LabeledField label="Data de nascimento *" tone="siaps">
            <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </LabeledField>
          <LabeledField label="Sexo *" tone="siaps">
            <select value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="I">Ignorado</option>
            </select>
          </LabeledField>
          <LabeledField
            label="Nome da mãe"
            tone="siaps"
            hint="Obrigatório no cadastro (ou marque Desconhece)."
          >
            <input
              disabled={motherUnknown}
              value={motherName}
              onChange={(e) => setMotherName(e.target.value)}
            />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={motherUnknown}
                onChange={(e) => {
                  setMotherUnknown(e.target.checked);
                  if (e.target.checked) setMotherName('');
                }}
              />
              Desconhece
            </label>
          </LabeledField>
          <LabeledField label="Nome do pai" tone="neutral">
            <input
              disabled={fatherUnknown}
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
            />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={fatherUnknown}
                onChange={(e) => {
                  setFatherUnknown(e.target.checked);
                  if (e.target.checked) setFatherName('');
                }}
              />
              Desconhece
            </label>
          </LabeledField>
          <LabeledField label="Telefone" tone="neutral">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </LabeledField>
        </div>

        <div className="section-label" style={{ marginTop: 8 }}>
          Endereço
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Logradouro</label>
            <input value={street} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div className="field">
            <label>Número</label>
            <input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="field">
            <label>Complemento</label>
            <input value={complement} onChange={(e) => setComplement(e.target.value)} />
          </div>
          <div className="field">
            <label>Bairro</label>
            <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
          </div>
          <div className="field">
            <label>Cidade</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>UF</label>
            <input className="mono" value={stateUf} onChange={(e) => setStateUf(e.target.value)} maxLength={2} />
          </div>
          <div className="field">
            <label>CEP</label>
            <input className="mono" value={zip} onChange={(e) => setZip(e.target.value)} maxLength={8} />
          </div>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={isDeceased}
            onChange={(e) => setIsDeceased(e.target.checked)}
          />
          Paciente é falecido(a)
        </label>
        {isDeceased ? (
          <div className="alert">
            <div className="grid-2">
              <LabeledField label="Data do óbito" tone="siaps" hint="Obrigatório quando falecido.">
                <input type="date" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
              </LabeledField>
              <LabeledField label="Nº da certidão" tone="siaps" hint="Obrigatório quando falecido.">
                <input
                  className="mono"
                  value={deathCertificate}
                  onChange={(e) => setDeathCertificate(e.target.value)}
                />
              </LabeledField>
            </div>
          </div>
        ) : null}

        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => router.back()}>
            Cancelar
          </button>
        </div>
      </form>
    </AppShell>
  );
}
