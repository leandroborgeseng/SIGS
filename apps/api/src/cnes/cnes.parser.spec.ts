import {
  mapApiEstablishment,
  padCnes,
  padIne,
  parseCnesSnapshot,
  parseCnesWebEquipesHtml,
  parseCnesWebEquipesListHtml,
} from './cnes.parser';

describe('cnes.parser', () => {
  it('padCnes / padIne', () => {
    expect(padCnes(9647198)).toBe('9647198');
    expect(padCnes('7198')).toBe('0007198');
    expect(padIne('1667653')).toBe('0001667653');
  });

  it('mapApiEstablishment marca desabilitado', () => {
    const row = mapApiEstablishment(
      {
        codigo_cnes: 9644687,
        nome_fantasia: 'X',
        codigo_tipo_unidade: 22,
        codigo_motivo_desabilitacao_estabelecimento: '08',
        endereco_estabelecimento: 'RUA A',
        numero_estabelecimento: '10',
        bairro_estabelecimento: 'CENTRO',
        codigo_cep_estabelecimento: '14400000',
      },
      '3516200',
    );
    expect(row.active).toBe(false);
    expect(row.cnes).toBe('9644687');
    expect(row.address?.city).toBe('Franca');
  });

  it('parseCnesSnapshot normalizado', () => {
    const snap = parseCnesSnapshot({
      meta: { ibgeCode: '3516200' },
      establishments: [
        {
          cnes: '9647198',
          name: 'UBS SANTA CLARA',
          typeId: '2',
          active: true,
          ibgeCode: '3516200',
          address: { street: 'RUA X', city: 'Franca', state: 'SP' },
        },
      ],
      teams: [{ cnes: '9647198', ine: '0001667653', name: 'ESF', teamTypeId: '70' }],
    });
    expect(snap.establishments).toHaveLength(1);
    expect(snap.teams[0].ine).toBe('0001667653');
  });

  it('parseCnesWebEquipesListHtml', () => {
    const html = `
      <a href="Mod_Equipes.asp?VCo_Unidade=3516209647198">UBS SANTA CLARA</a>
      <a href="Mod_Equipes.asp?VCo_Unidade=3516202049074">UBS ESTACAO</a>
    `;
    const rows = parseCnesWebEquipesListHtml(html);
    expect(rows).toHaveLength(2);
    expect(rows[0].cnes).toBe('9647198');
  });

  it('parseCnesWebEquipesHtml', () => {
    const html = `
      <a href="Mod_Equipes_Profisssional.asp?VUnidade=3516209647198&Varea=0016&VTipo=70&VMunicipio=351620&VSeqEq=1667653">ESF - EQUIPE DE SAUDE DA FAMILIA</a></font></td>
      <td align=center><font size=1>0001667653</font></td>
      <td align=center><font size=1>EQUIPE SANTA CLARA</font></td>
      <td align=center><font size=1>0016</font></td>
    `;
    const teams = parseCnesWebEquipesHtml('9647198', html);
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({
      cnes: '9647198',
      ine: '0001667653',
      teamTypeId: '70',
      name: 'EQUIPE SANTA CLARA',
    });
  });
});
