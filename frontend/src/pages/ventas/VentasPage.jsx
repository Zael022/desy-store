// Ventas y devoluciones.
//   * Rol ventas (/pos/ventas): solo SUS ventas y devoluciones (lo decide el backend).
//   * Administración y dueña (/admin/ventas): todas, para supervisar.
// Una venta confirmada no se edita ni se borra: se corrige con una devolución.
// La devolución pide producto, cantidad (máximo lo vendido menos lo ya devuelto) y motivo.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, Receipt, RotateCcw, Undo2, X } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import Pestanas from '../../components/Pestanas.jsx';
import TablaDatos from '../../components/TablaDatos.jsx';
import Boton from '../../components/Boton.jsx';
import Modal from '../../components/Modal.jsx';
import ModalAccion from '../../components/ModalAccion.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import DetalleVenta from '../../components/DetalleVenta.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { crearDevolucion, listarDevoluciones, listarVentas, obtenerVenta } from '../../services/ventasService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { useAutenticacion } from '../../hooks/useAutenticacion.js';
import { formatearFechaHora, formatearPrecio } from '../../utils/formato.js';

function FormularioDevolucion({ venta, alTerminar, alCancelar }) {
  const [cantidades, setCantidades] = useState({});
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const lineas = venta.detalle.map((l) => ({ ...l, disponible: l.cantidad - l.cantidad_devuelta }));
  const items = lineas
    .map((l) => ({ id_detalle_venta: l.id_detalle_venta, cantidad: Number(cantidades[l.id_detalle_venta] || 0) }))
    .filter((i) => i.cantidad > 0);
  const total = items.reduce((suma, i) => suma + i.cantidad * lineas.find((l) => l.id_detalle_venta === i.id_detalle_venta).precio_unitario, 0);

  async function confirmar() {
    if (items.length === 0) return setError('Indique al menos una unidad a devolver.');
    if (!motivo.trim()) return setError('Escriba el motivo de la devolución.');
    setProcesando(true);
    setError('');
    try {
      const devolucion = await crearDevolucion({ id_venta: venta.id_venta, motivo: motivo.trim(), items });
      toast.success(devolucion.message);
      alTerminar();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
    return undefined;
  }

  return (
    <ModalAccion
      abierto
      titulo={`Devolución de la venta #${venta.id_venta}`}
      mensaje="Las unidades devueltas vuelven al inventario (sin pasar del máximo de 67 por producto)."
      textoConfirmar={`Registrar devolución (${formatearPrecio(total)})`}
      textoProcesando="Registrando..."
      icono={Undo2}
      procesando={procesando}
      error={error}
      deshabilitarConfirmar={items.length === 0}
      alConfirmar={confirmar}
      alCancelar={alCancelar}
    >
      <div className="lista-devolucion">
        {lineas.map((l) => (
          <div key={l.id_detalle_venta} className="linea-devolucion">
            <label htmlFor={`devolver-${l.id_detalle_venta}`}>
              <strong>{l.nombre_producto}</strong>
              <small>
                Vendidas {l.cantidad}, devueltas {l.cantidad_devuelta}. Puede devolver hasta {l.disponible}.
              </small>
            </label>
            <input
              id={`devolver-${l.id_detalle_venta}`}
              type="number"
              min="0"
              max={l.disponible}
              value={cantidades[l.id_detalle_venta] ?? ''}
              placeholder="0"
              disabled={l.disponible === 0 || procesando}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                setCantidades({ ...cantidades, [l.id_detalle_venta]: Number.isNaN(n) ? '' : Math.max(0, Math.min(n, l.disponible)) });
              }}
            />
          </div>
        ))}
      </div>
      <CampoFormulario id="motivo" etiqueta="Motivo" tipo="textarea" valor={motivo} alCambiar={(_c, v) => setMotivo(v)} obligatorio maxLength={255} disabled={procesando} placeholder="Ejemplo: el broche venía flojo" />
    </ModalAccion>
  );
}

function ListaVentas({ esVentas, esDuena }) {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '' });
  const { datos, cargando, error, recargar } = useDatos(() => listarVentas(filtros), [filtros.desde, filtros.hasta]);
  const [detalle, setDetalle] = useState(null);
  const [abriendo, setAbriendo] = useState(null);
  const [devolviendo, setDevolviendo] = useState(false);

  async function abrir(idVenta) {
    setAbriendo(idVenta);
    try {
      setDetalle(await obtenerVenta(idVenta));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAbriendo(null);
    }
  }

  const columnas = [
    { clave: 'id_venta', titulo: 'Venta', mostrar: (v) => `#${v.id_venta}` },
    { clave: 'fecha', titulo: 'Fecha', mostrar: (v) => formatearFechaHora(v.fecha) },
    ...(esVentas ? [] : [{ clave: 'nombre_vendedor', titulo: 'Vendedor' }]),
    { clave: 'nombre_cliente', titulo: 'Cliente', mostrar: (v) => v.nombre_cliente ?? 'Sin cliente' },
    { clave: 'unidades', titulo: 'Artículos' },
    { clave: 'total', titulo: 'Total', mostrar: (v) => <strong>{formatearPrecio(v.total)}</strong> },
    { clave: 'total_devuelto', titulo: 'Devuelto', mostrar: (v) => (v.total_devuelto > 0 ? formatearPrecio(v.total_devuelto) : '—') }
  ];
  const quedaPorDevolver = detalle?.detalle.some((l) => l.cantidad > l.cantidad_devuelta);

  return (
    <>
      <div className="filtros-fecha">
        <CampoFormulario id="desde" etiqueta="Desde" tipo="date" valor={filtros.desde} alCambiar={(c, v) => setFiltros({ ...filtros, [c]: v })} />
        <CampoFormulario id="hasta" etiqueta="Hasta" tipo="date" valor={filtros.hasta} alCambiar={(c, v) => setFiltros({ ...filtros, [c]: v })} />
        {(filtros.desde || filtros.hasta) && (
          <Boton variante="fantasma" icono={X} onClick={() => setFiltros({ desde: '', hasta: '' })}>
            Quitar fechas
          </Boton>
        )}
      </div>
      {cargando ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} alReintentar={recargar} />
      ) : datos.length === 0 ? (
        <SinRegistros texto={esVentas ? 'Todavía no tiene ventas registradas. Use el punto de venta.' : 'No hay ventas en este periodo.'} />
      ) : (
        <TablaDatos
          columnas={columnas}
          filas={datos}
          llave="id_venta"
          acciones={(v) => (
            <Boton variante="fantasma" icono={Eye} onClick={() => abrir(v.id_venta)} cargando={abriendo === v.id_venta} aria-label={`Ver la venta #${v.id_venta}`}>
              Ver
            </Boton>
          )}
        />
      )}

      <Modal abierto={detalle !== null && !devolviendo} alCerrar={() => setDetalle(null)} idTitulo="titulo-venta" className="modal-formulario">
        {detalle && (
          <div className="formulario">
            <h2 id="titulo-venta">Venta #{detalle.id_venta}</h2>
            <p className="texto-secundario">
              {formatearFechaHora(detalle.fecha)} · Vendió {detalle.nombre_vendedor} · {detalle.nombre_cliente ? `Cliente: ${detalle.nombre_cliente}` : 'Sin cliente'}
            </p>
            {detalle.nota && <p className="alerta alerta-info">Nota: {detalle.nota}</p>}
            <DetalleVenta venta={detalle} mostrarCosto={esDuena} />
            {detalle.devoluciones.length > 0 && (
              <div>
                <h3>Devoluciones</h3>
                <ul className="lista-simple">
                  {detalle.devoluciones.map((d) => (
                    <li key={d.id_devolucion}>
                      #{d.id_devolucion} · {formatearFechaHora(d.fecha)} · {d.nombre_empleado} · {d.motivo} · {formatearPrecio(d.total)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="formulario-acciones">
              <Boton icono={Undo2} onClick={() => setDevolviendo(true)} disabled={!quedaPorDevolver}>
                Registrar devolución
              </Boton>
              <Boton variante="secundario" icono={X} onClick={() => setDetalle(null)}>
                Cerrar
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {devolviendo && detalle && (
        <FormularioDevolucion
          venta={detalle}
          alCancelar={() => setDevolviendo(false)}
          alTerminar={async () => {
            setDevolviendo(false);
            setDetalle(await obtenerVenta(detalle.id_venta));
            recargar();
          }}
        />
      )}
    </>
  );
}

function ListaDevoluciones() {
  const { datos, cargando, error, recargar } = useDatos(listarDevoluciones);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;
  if (datos.length === 0) return <SinRegistros texto="No hay devoluciones registradas." />;
  const columnas = [
    { clave: 'id_devolucion', titulo: 'Devolución', mostrar: (d) => `#${d.id_devolucion}` },
    { clave: 'id_venta', titulo: 'Venta', mostrar: (d) => `#${d.id_venta}` },
    { clave: 'fecha', titulo: 'Fecha', mostrar: (d) => formatearFechaHora(d.fecha) },
    { clave: 'nombre_empleado', titulo: 'Registró' },
    { clave: 'unidades', titulo: 'Unidades' },
    { clave: 'total', titulo: 'Monto', mostrar: (d) => formatearPrecio(d.total) },
    { clave: 'motivo', titulo: 'Motivo' }
  ];
  return <TablaDatos columnas={columnas} filas={datos} llave="id_devolucion" />;
}

export default function VentasPage() {
  const { usuario } = useAutenticacion();
  const esVentas = usuario.rol === 'ventas';
  const [pestana, setPestana] = useState('ventas');
  return (
    <PaginaAnimada>
      <EncabezadoPagina
        ruta={esVentas ? ['Ventas', 'Mis ventas'] : ['Tienda', 'Ventas y devoluciones']}
        descripcion={esVentas ? 'Sus ventas confirmadas. Para corregir una venta, registre una devolución.' : 'Supervise todas las ventas y devoluciones de la tienda.'}
      />
      <section className="tarjeta">
        <Pestanas
          opciones={[
            { valor: 'ventas', texto: 'Ventas', icono: Receipt },
            { valor: 'devoluciones', texto: 'Devoluciones', icono: RotateCcw }
          ]}
          valor={pestana}
          alCambiar={setPestana}
          etiqueta="Ventas y devoluciones"
        />
        <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`pestana-${pestana}`} className="panel-pestana">
          {pestana === 'ventas' ? <ListaVentas esVentas={esVentas} esDuena={usuario.rol === 'duena'} /> : <ListaDevoluciones />}
        </div>
      </section>
    </PaginaAnimada>
  );
}
