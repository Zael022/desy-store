// Configuración del sistema (solo la dueña la cambia; queda en auditoría).
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import Boton from '../../components/Boton.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { Cargando, ErrorCarga } from '../../components/EstadoLista.jsx';
import { actualizarConfiguracionSistema, obtenerConfiguracionSistema } from '../../services/configuracionService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { formatearFechaHora } from '../../utils/formato.js';

export default function ConfiguracionPage() {
  const { datos, cargando, error, recargar, setDatos } = useDatos(obtenerConfiguracionSistema);
  const [cambios, setCambios] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');

  if (cargando) return <Cargando />;
  if (error) return <div className="pagina tarjeta"><ErrorCarga error={error} alReintentar={recargar} /></div>;

  const actual = Object.fromEntries(datos.map((d) => [d.clave, d.valor]));
  const valor = (clave) => (clave in cambios ? cambios[clave] : actual[clave]);
  const info = (clave) => datos.find((d) => d.clave === clave);

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');
    const enviar = { ...cambios };
    for (const clave of ['umbral_pocas_unidades', 'horas_pedido_pendiente', 'dias_pedido_confirmado']) {
      if (clave in enviar) enviar[clave] = Number(enviar[clave]);
    }
    try {
      setDatos(await actualizarConfiguracionSistema(enviar));
      setCambios({});
      toast.success('Configuración guardada.');
    } catch (err) {
      setErrorFormulario(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const AYUDAS = {
    umbral_pocas_unidades: 'Con esta cantidad o menos, el catálogo dice “pocas unidades” y el panel muestra una alerta de stock bajo (de 1 a 67).',
    proveedor_ve_stock: 'Si está marcado, cada proveedor ve el stock exacto de sus productos; si no, solo la disponibilidad.',
    mensaje_catalogo: 'Texto que ven los visitantes y clientes en la portada y en el catálogo.',
    horas_pedido_pendiente: 'Si la tienda no confirma un pedido en este tiempo, vence solo y las unidades apartadas se liberan (de 1 a 720 horas).',
    dias_pedido_confirmado: 'Días que el cliente tiene para recoger un pedido confirmado; después vence y las unidades se liberan (de 1 a 60).'
  };
  const pieDe = (clave) => {
    const i = info(clave);
    const cambio = i?.actualizado_en ? ` Último cambio: ${formatearFechaHora(i.actualizado_en)}${i.actualizado_por ? ` por ${i.actualizado_por}` : ''}.` : '';
    return AYUDAS[clave] + cambio;
  };

  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Dueña', 'Configuración']} descripcion="Opciones generales de la tienda. Cada cambio queda registrado en la auditoría." />
      <form className="tarjeta formulario formulario-angosto" onSubmit={guardar} noValidate>
        <MensajeFormulario>{errorFormulario}</MensajeFormulario>
        <CampoFormulario
          id="umbral_pocas_unidades"
          etiqueta="Umbral de “pocas unidades”"
          tipo="number"
          min="1"
          max="67"
          valor={String(valor('umbral_pocas_unidades'))}
          alCambiar={(c, v) => setCambios({ ...cambios, [c]: v })}
          ayuda={pieDe('umbral_pocas_unidades')}
          disabled={guardando}
        />
        <div className="campo campo-casilla">
          <label>
            <input type="checkbox" checked={valor('proveedor_ve_stock')} onChange={(e) => setCambios({ ...cambios, proveedor_ve_stock: e.target.checked })} disabled={guardando} />
            <span>Mostrar el stock exacto a los proveedores en su portal</span>
          </label>
          <small className="campo-ayuda">{pieDe('proveedor_ve_stock')}</small>
        </div>
        <CampoFormulario
          id="mensaje_catalogo"
          etiqueta="Mensaje del catálogo"
          tipo="textarea"
          maxLength={255}
          valor={valor('mensaje_catalogo')}
          alCambiar={(c, v) => setCambios({ ...cambios, [c]: v })}
          ayuda={pieDe('mensaje_catalogo')}
          disabled={guardando}
        />
        <h2 className="subtitulo-formulario">Pedidos de clientes</h2>
        <CampoFormulario
          id="horas_pedido_pendiente"
          etiqueta="Horas para confirmar un pedido"
          tipo="number"
          min="1"
          max="720"
          valor={String(valor('horas_pedido_pendiente') ?? 48)}
          alCambiar={(c, v) => setCambios({ ...cambios, [c]: v })}
          ayuda={pieDe('horas_pedido_pendiente')}
          disabled={guardando}
        />
        <CampoFormulario
          id="dias_pedido_confirmado"
          etiqueta="Días para recoger un pedido confirmado"
          tipo="number"
          min="1"
          max="60"
          valor={String(valor('dias_pedido_confirmado') ?? 7)}
          alCambiar={(c, v) => setCambios({ ...cambios, [c]: v })}
          ayuda={pieDe('dias_pedido_confirmado')}
          disabled={guardando}
        />
        <div className="formulario-acciones">
          <Boton type="submit" icono={Save} cargando={guardando} disabled={Object.keys(cambios).length === 0}>
            {guardando ? 'Guardando...' : 'Guardar configuración'}
          </Boton>
        </div>
      </form>
    </PaginaAnimada>
  );
}
