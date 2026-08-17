import { fixStNaoPossuiCpf } from './ledi-fao-xml.fixer';
import {
  validateAdXml,
  validateCadastroDomiciliarXml,
  validateCadastroIndividualXml,
  validateColetivoXml,
  validateVisitaAcsXml,
} from './ledi-cds-extra.validator';
import {
  FIXTURE_AD,
  FIXTURE_AD_NO_ST,
  FIXTURE_CADASTRO_DOMICILIAR,
  FIXTURE_CADASTRO_INDIVIDUAL,
  FIXTURE_CADASTRO_INDIVIDUAL_NO_ST,
  FIXTURE_COLETIVO,
  FIXTURE_VISITA_ACS,
  FIXTURE_VISITA_ACS_NO_ST,
} from './fixtures/ledi-cds-synthetic';
import { runRulesEngine } from '../clinical-core/rules-engine';
import { assertLoteTipoMatch, detectLediFichaTipo } from './ledi-ficha-tipo';

describe('ledi-cds-extra validators (tipos 2/3/6/8/10)', () => {
  it('detecta tipos e marca loteXmlLive', () => {
    expect(detectLediFichaTipo(FIXTURE_CADASTRO_INDIVIDUAL)).toMatchObject({
      id: 'CADASTRO_INDIVIDUAL',
      code: 2,
      loteXmlLive: true,
    });
    expect(detectLediFichaTipo(FIXTURE_CADASTRO_DOMICILIAR).id).toBe('CADASTRO_DOMICILIAR');
    expect(detectLediFichaTipo(FIXTURE_COLETIVO).id).toBe('COLETIVO');
    expect(detectLediFichaTipo(FIXTURE_VISITA_ACS).id).toBe('VISITA_ACS');
    expect(detectLediFichaTipo(FIXTURE_AD).id).toBe('AD');
  });

  it('cadastro individual: ST_NAO_POSSUI_CPF + autofix', () => {
    const before = validateCadastroIndividualXml(FIXTURE_CADASTRO_INDIVIDUAL_NO_ST);
    expect(before.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(true);
    expect(before.siapsReady).toBe(false);
    const fixed = fixStNaoPossuiCpf(FIXTURE_CADASTRO_INDIVIDUAL_NO_ST);
    expect(fixed.changed).toBe(true);
    const after = validateCadastroIndividualXml(fixed.xml);
    expect(after.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
    expect(after.siapsReady).toBe(true);
  });

  it('domicílio/coletivo: aptos sintéticos e cruzamento municipal', () => {
    expect(validateCadastroDomiciliarXml(FIXTURE_CADASTRO_DOMICILIAR).siapsReady).toBe(true);
    expect(validateColetivoXml(FIXTURE_COLETIVO).siapsReady).toBe(true);

    const cross = validateColetivoXml(FIXTURE_COLETIVO, {
      municipalCnes: new Set(['9999999']),
      municipalCnsProf: new Set(['703601040321538']),
    });
    expect(cross.findings.some((f) => f.code === 'CNES_NOT_IN_MUNICIPAL_NETWORK')).toBe(true);
  });

  it('visita ACS e AD: identidade + autofix st', () => {
    expect(validateVisitaAcsXml(FIXTURE_VISITA_ACS).siapsReady).toBe(true);
    expect(validateAdXml(FIXTURE_AD).siapsReady).toBe(true);

    const v = validateVisitaAcsXml(FIXTURE_VISITA_ACS_NO_ST);
    expect(v.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(true);
    const fixed = fixStNaoPossuiCpf(FIXTURE_AD_NO_ST);
    expect(validateAdXml(fixed.xml).findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
  });

  it('rules engine roteia RulePacks CDS', () => {
    const r = runRulesEngine({
      xml: FIXTURE_CADASTRO_INDIVIDUAL,
      rulePack: 'CADASTRO_INDIVIDUAL',
    });
    expect(r.rulePack).toBe('CADASTRO_INDIVIDUAL');
    expect(r.siapsReady).toBe(true);
  });

  it('gate aceita lote homogêneo tipo 8 e recusa na tela FAI', () => {
    expect(() =>
      assertLoteTipoMatch({
        expectedTipo: 'VISITA_ACS',
        files: [{ name: 'v.xml', xml: FIXTURE_VISITA_ACS }],
      }),
    ).not.toThrow();
    expect(() =>
      assertLoteTipoMatch({
        expectedTipo: 'FAI',
        files: [{ name: 'v.xml', xml: FIXTURE_VISITA_ACS }],
      }),
    ).toThrow(/Visita ACS/);
  });
});
