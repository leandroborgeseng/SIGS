import { BadRequestException } from '@nestjs/common';
import { LediFaoBatchService } from './ledi-fao-batch.service';
import { LEDI_TIPO_MISMATCH } from './ledi-ficha-tipo';

const FAO_XML = `<dadoTransporteTransportXml>
<tipoDadoSerializado>5</tipoDadoSerializado>
<fichaAtendimentoOdontologicoMasterTransport></fichaAtendimentoOdontologicoMasterTransport>
</dadoTransporteTransportXml>`;

const FAI_XML = `<dadoTransporteTransportXml>
<tipoDadoSerializado>4</tipoDadoSerializado>
<fichaAtendimentoIndividualMasterTransport></fichaAtendimentoIndividualMasterTransport>
</dadoTransporteTransportXml>`;

describe('LediFaoBatchService gate de tipo (fail-closed)', () => {
  const create = jest.fn();
  const svc = new LediFaoBatchService(
    { lediFaoBatch: { create }, lediFaoBatchItem: { createMany: jest.fn(), count: jest.fn() } } as never,
    { putXml: jest.fn() } as never,
  );

  beforeEach(() => {
    create.mockReset();
  });

  it('FAO na tela FAI → 400 LEDI_TIPO_MISMATCH e não persiste lote', async () => {
    await expect(
      svc.create({
        name: 'teste',
        expectedTipo: 'FAI',
        files: [{ name: 'odonto.xml', xml: FAO_XML }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    try {
      await svc.create({
        expectedTipo: 'FAI',
        files: [{ name: 'odonto.xml', xml: FAO_XML }],
      });
    } catch (e) {
      const body = (e as BadRequestException).getResponse() as { code?: string; href?: string };
      expect(body.code).toBe(LEDI_TIPO_MISMATCH);
      expect(body.href).toBe('/faturamento/lote/fao');
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('lote misto recusa o ZIP inteiro (não segue as que bateram)', async () => {
    let caught: unknown;
    try {
      await svc.create({
        expectedTipo: 'FAI',
        files: [
          { name: 'ok.xml', xml: FAI_XML },
          { name: 'errado.xml', xml: FAO_XML },
        ],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getStatus()).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
