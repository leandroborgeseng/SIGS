'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
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
        description="Campos condicionais de óbito e “desconhece” mãe/pai seguem a regra do design."
        actions={<HelpLink id="cadastros.pacientes" />}
      />
      <ErrorBox message={error} />
      <form className="card" onSubmit={onSubmit}>
        <div className="grid-2">
          <div className="field">
            <label>Nome civil *</label>
            <input required value={civilName} onChange={(e) => setCivilName(e.target.value)} />
          </div>
          <div className="field">
            <label>Nome social</label>
            <input value={socialName} onChange={(e) => setSocialName(e.target.value)} />
            <span className="hint">Sempre visível — exibido nas listagens quando preenchido.</span>
          </div>
          <div className="field">
            <label>CPF</label>
            <input className="mono" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={11} />
          </div>
          <div className="field">
            <label>CNS</label>
            <input className="mono" value={cns} onChange={(e) => setCns(e.target.value)} maxLength={16} />
          </div>
          <div className="field">
            <label>Data de nascimento *</label>
            <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Sexo *</label>
            <select value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="I">Ignorado</option>
            </select>
          </div>
          <div className="field">
            <label>Nome da mãe</label>
            <input
              disabled={motherUnknown}
              value={motherName}
              onChange={(e) => setMotherName(e.target.value)}
            />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
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
          </div>
          <div className="field">
            <label>Nome do pai</label>
            <input
              disabled={fatherUnknown}
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
            />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
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
          </div>
          <div className="field">
            <label>Telefone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
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
              <div className="field">
                <label>Data do óbito</label>
                <input type="date" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Nº da certidão</label>
                <input
                  className="mono"
                  value={deathCertificate}
                  onChange={(e) => setDeathCertificate(e.target.value)}
                />
              </div>
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
