import { buildIndividualEncounterLediPayload } from '../../encounters/ledi-individual.mapper';
import { buildDentalLediPayload } from '../../care-extra/ledi-dental.mapper';
import {
  faiMasterToNativeInput,
  faoMasterToNativeInput,
  nativeFichaToComposition,
  nativeFichaToEncounter,
  nativeKeyFor,
} from './native-ficha.adapter';

const PATIENT = {
  id: 'p1',
  civilName: 'Paciente Demo',
  cpf: '39053344705',
  cns: '703601040321538',
  birthDate: new Date('1990-05-10'),
  sex: 'FEMALE',
};

describe('native-ficha adapter (LEDI P1)', () => {
  it('FAI mapper → Encounter + Condition/Procedure (sigs-native, sem XML)', () => {
    const payload = buildIndividualEncounterLediPayload({
      uuidFicha: 'ficha-fai-1',
      lotacao: {
        profissionalCNS: '898001234567890',
        cboCodigo_2002: '225125',
        cnes: '2035871',
        ine: '0002321246',
      },
      codigoIbgeMunicipio: '3516200',
      startedAt: new Date('2026-08-13T12:00:00Z'),
      finishedAt: new Date('2026-08-13T12:20:00Z'),
      patient: PATIENT,
      tipoAtendimento: 5,
      localAtendimento: 1,
      turno: 2,
      clinical: {
        faiOrigin: true,
        outcomes: ['ALTA'],
        problemasCondicoes: [{ ciap: 'K86', cid10: 'I10' }],
        procedimentos: [{ code: '0301010064', label: 'Consulta médica', quantidade: 1 }],
        stNaoPossuiCpf: false,
      },
    });
    const input = faiMasterToNativeInput(payload, {
      encounterId: 'e-fai',
      patient: PATIENT,
      status: 'finished',
    });
    const enc = nativeFichaToEncounter(input);
    const composition = nativeFichaToComposition(input);
    expect(composition.sourceFormat).toBe('sigs-native');
    expect(composition.sourceXml).toBeUndefined();
    expect(enc.fichaTipo).toBe('FAI');
    expect(enc.status).toBe('finished');
    expect(enc.uuidFicha).toBe('ficha-fai-1');
    expect(enc.conditions).toEqual(
      expect.arrayContaining([expect.objectContaining({ resourceType: 'Condition', ciap: 'K86', cid10: 'I10' })]),
    );
    expect(enc.procedures).toEqual([
      expect.objectContaining({ resourceType: 'Procedure', code: '0301010064', quantity: 1 }),
    ]);
    expect(enc.patient?.identifiers.some((i) => i.system === 'cpf' && i.value === '39053344705')).toBe(true);
    expect(enc.extensions?.nativeKey).toBe(nativeKeyFor('FAI', 'e-fai'));
  });

  it('FAO mapper → Encounter + Condition/Procedure mínimos', () => {
    const payload = buildDentalLediPayload({
      uuidFicha: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      lotacao: {
        profissionalCNS: '126090861660005',
        cboCodigo_2002: '223208',
        cnes: '9647198',
        ine: '0002165929',
      },
      codigoIbgeMunicipio: '3516200',
      startedAt: new Date('2026-08-13T10:00:00Z'),
      finishedAt: new Date('2026-08-13T10:30:00Z'),
      patient: PATIENT,
      tipoAtendimento: 5,
      outcomes: ['ALTA'],
      vigilanciaSaudeBucal: [1],
      problemasCondicoes: [{ ciap: 'D82' }],
      procedures: [{ code: '0101020010', label: 'Consulta odonto', done: true }],
      stNaoPossuiCpf: false,
    });
    const input = faoMasterToNativeInput(payload, {
      encounterId: 'd1',
      patient: PATIENT,
      status: 'finished',
    });
    const enc = nativeFichaToEncounter(input);
    expect(enc.fichaTipo).toBe('FAO');
    expect(enc.conditions[0]?.ciap).toBe('D82');
    expect(enc.procedures[0]?.code).toBe('0101020010');
    expect(enc.extensions?.nativeKey).toBe('native:FAO:d1');
  });
});
