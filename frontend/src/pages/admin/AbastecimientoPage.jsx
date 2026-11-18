// Solicitudes de abastecimiento (administración y dueña).
//   1. "Nueva solicitud": elegir proveedor, sus productos y cantidades.
//   2. El proveedor la acepta o rechaza desde su portal.
//   3. Cuando llega la mercadería: "Marcar como recibida" -> el backend registra
//      una ENTRADA por producto (si alguno pasaría de 67, no entra nada).
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { Ban, Eye, PackageCheck, Plus, Send, X } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import TablaDatos from '../../components/TablaDatos.jsx';
import Boton from '../../components/Boton.jsx';
import Modal from '../../components/Modal.jsx';
import ModalAccion from '../../components/ModalAccion.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { InsigniaEstado } from '../../components/Insignias.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { cancelarSolicitud, crearSolicitud, listarSolicitudes, obtenerSolicitud, recibirSolicitud } from '../../services/abastecimientoService.js';
import { listarProveedores } from '../../services/proveedoresService.js';
import { listarProductos } from '../../services/productosService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { formatearFechaHora } from '../../utils/formato.js';

const ESTADOS = ['pendiente', 'aceptada', 'rechazada', 'recibida', 'cancelada'];

function NuevaSolicitud({ proveedorInicial, alCerrar, alCrear }) {
  const { datos, cargando, error, recargar } = useDatos(() => Promise.all([listarProveedores(), listarProductos()]));
  const [idProveedor, setIdProveedor] = useState(proveedorInicial ?? '');
  const [cantidades, setCantidades] = useState({});
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');

  const [proveedores, productos] = datos ?? [[], []];
  const deProveedor = productos.filter((p) => String(p.id_proveedor) === String(idProveedor));
  const items = deProveedor.map((p) => ({ id_producto: p.id_producto, cantidad: Number(cantidades[p.id_producto] || 0) })).filter((i) => i.cantidad > 0);

  async function guardar(evento) {
    evento.preventDefault();
    if (!idProveedor) return setErrorFormulario('Seleccione un proveedor.');
    if (items.length === 0) return setErrorFormulario('Escriba la cantidad de al menos un producto.');
    setGuardando(true);
    setErrorFormulario('');
    try {
      const solicitud = await crearSolicitud({ id_proveedor: Number(idProveedor), nota: nota.trim() || null, items });
      toast.success(`Solicitud #${solicitud.id_solicitud} enviada al proveedor.`);
      alCrear();
    } catch (err) {
      setErrorFormulario(err.message);
    } finally {
      setGuardando(false);
    }
    return undefined;
  }

  return (
    <Modal abierto alCerrar={alCerrar} bloqueado={guardando} idTitulo="titulo-nueva" className="modal-formulario">
      <form className="formulario" onSubmit={guardar} noValidate>
        <h2 id="titulo-nueva">Nueva solicitud de abastecimiento</h2>
        {cargando ? (
          <Cargando />
        ) : error ? (
          <ErrorCarga error={error} alReintentar={recargar} />
        ) : (
          <>
            <MensajeFormulario>{errorFormulario}</MensajeFormulario>
            <CampoFormulario
              id="id_proveedor"
              etiqueta="Proveedor"
              tipo="select"
              valor={String(idProveedor)}
              alCambiar={(_c, v) => {
                setIdProveedor(v);
                setCantidades({});
              }}
              opciones={proveedores.map((p) => ({ valor: String(p.id_proveedor), texto: p.nombre }))}
              textoOpcionVacia="Seleccione un proveedor"
              obligatorio
              disabled={guardando}
            />
            {idProveedor && deProveedor.length === 0 && <p className="texto-secundario">Este proveedor no tiene productos registrados.</p>}
            {deProveedor.length > 0 && (
              <div className="lista-devolucion">
                {deProveedor.map((p) => (
                  <div key={p.id_producto} className="linea-devolucion">
                    <label htmlFor={`pedir-${p.id_producto}`}>
                      <strong>{p.nombre}</strong>
                      <small>
                        {p.codigo} · stock actual {p.stock} de 67 · caben {67 - p.stock}
                      </small>
                    </label>
                    <input
                      id={`pedir-${p.id_producto}`}
                      type="number"
                      min="0"
                      max={67}
                      placeholder="0"
                      value={cantidades[p.id_producto] ?? ''}
                      disabled={guardando}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        setCantidades({ ...cantidades, [p.id_producto]: Number.isNaN(n) ? '' : Math.max(0, Math.min(n, 67)) });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <CampoFormulario id="nota" etiqueta="Nota para el proveedor (opcional)" tipo="textarea" valor={nota} alCambiar={(_c, v) => setNota(v)} maxLength={255} disabled={guardando} />
            <div className="formulario-acciones">
              <Boton type="submit" icono={Send} cargando={guardando} disabled={items.length === 0}>
                {guardando ? 'Enviando...' : 'Enviar solicitud'}
              </Boton>
              <Boton variante="secundario" icono={X} onClick={alCerrar} disabled={guardando}>
                Cancelar
              </Boton>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

export default function AbastecimientoPage() {
  const [parametros, setParametros] = useSearchParams();
  const proveedorInicial = parametros.get('proveedor');
  const [estado, setEstado] = useState('');
  const { datos, cargando, error, recargar } = useDatos(() => listarSolicitudes({ estado }), [estado]);
  const [nueva, setNueva] = useState(Boolean(proveedorInicial));
  const [detalle, setDetalle] = useState(null);
  const [abriendo, setAbriendo] = useState(null);
  const [accion, setAccion] = useState(null); // 'recibir' | 'cancelar'
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  async function abrir(id) {
    setAbriendo(id);
    try {
      setDetalle(await obtenerSolicitud(id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAbriendo(null);
    }
  }

  async function confirmarAccion() {
    setProcesando(true);
    setErrorAccion('');
    try {
      const actualizada = accion === 'recibir' ? await recibirSolicitud(detalle.id_solicitud) : await cancelarSolicitud(detalle.id_solicitud);
      toast.success(actualizada.message);
      setDetalle(actualizada);
      setAccion(null);
      recargar();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  const columnas = [
    { clave: 'id_solicitud', titulo: 'Solicitud', mostrar: (s) => `#${s.id_solicitud}` },
    { clave: 'creada_en', titulo: 'Fecha', mostrar: (s) => formatearFechaHora(s.creada_en) },
    { clave: 'nombre_proveedor', titulo: 'Proveedor' },
    { clave: 'unidades', titulo: 'Unidades', mostrar: (s) => `${s.unidades} (${s.productos} producto/s)` },
    { clave: 'estado', titulo: 'Estado', mostrar: (s) => <InsigniaEstado estado={s.estado} /> },
    { clave: 'creada_por', titulo: 'Creó' }
  ];

  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Inventario', 'Abastecimiento']} descripcion="Pida mercadería a los proveedores. Al recibirla, las entradas de inventario se registran solas." />
      <section className="tarjeta">
        <div className="barra-acciones">
          <CampoFormulario
            id="estado"
            etiqueta="Estado"
            tipo="select"
            valor={estado}
            alCambiar={(_c, v) => setEstado(v)}
            textoOpcionVacia="Todos"
            opciones={ESTADOS.map((e) => ({ valor: e, texto: e[0].toUpperCase() + e.slice(1) }))}
          />
          <Boton icono={Plus} onClick={() => setNueva(true)}>
            Nueva solicitud
          </Boton>
        </div>
        {cargando && !datos ? (
          <Cargando />
        ) : error ? (
          <ErrorCarga error={error} alReintentar={recargar} />
        ) : datos.length === 0 ? (
          <SinRegistros texto="No hay solicitudes con ese estado." />
        ) : (
          <TablaDatos
            columnas={columnas}
            filas={datos}
            llave="id_solicitud"
            acciones={(s) => (
              <Boton variante="fantasma" icono={Eye} onClick={() => abrir(s.id_solicitud)} cargando={abriendo === s.id_solicitud} aria-label={`Ver la solicitud #${s.id_solicitud}`}>
                Ver
              </Boton>
            )}
          />
        )}
      </section>

      {nueva && (
        <NuevaSolicitud
          proveedorInicial={proveedorInicial}
          alCerrar={() => {
            setNueva(false);
            setParametros({});
          }}
          alCrear={() => {
            setNueva(false);
            setParametros({});
            recargar();
          }}
        />
      )}

      <Modal abierto={detalle !== null && accion === null} alCerrar={() => setDetalle(null)} idTitulo="titulo-detalle-solicitud" className="modal-formulario">
        {detalle && (
          <div className="formulario">
            <h2 id="titulo-detalle-solicitud">
              Solicitud #{detalle.id_solicitud} · {detalle.nombre_proveedor}
            </h2>
            <p className="texto-secundario">
              Creada {formatearFechaHora(detalle.creada_en)} por {detalle.creada_por} · <InsigniaEstado estado={detalle.estado} />
            </p>
            {detalle.nota_tienda && <p className="alerta alerta-info">Nota: {detalle.nota_tienda}</p>}
            {detalle.comentario_proveedor && <p className="alerta alerta-advertencia">Proveedor: {detalle.comentario_proveedor}</p>}
            <ul className="lista-simple">
              {detalle.detalle.map((l) => (
                <li key={l.id_detalle_solicitud}>
                  <strong>{l.cantidad}</strong> × {l.codigo} · {l.nombre_producto} <small>(stock actual {l.stock_actual})</small>
                </li>
              ))}
            </ul>
            {detalle.recibida_en && (
              <p className="texto-secundario">
                Recibida {formatearFechaHora(detalle.recibida_en)} por {detalle.recibida_por}
              </p>
            )}
            <div className="formulario-acciones">
              {detalle.estado === 'aceptada' && (
                <Boton icono={PackageCheck} onClick={() => setAccion('recibir')}>
                  Marcar como recibida
                </Boton>
              )}
              {['pendiente', 'aceptada'].includes(detalle.estado) && (
                <Boton variante="peligro" icono={Ban} onClick={() => setAccion('cancelar')}>
                  Cancelar solicitud
                </Boton>
              )}
              <Boton variante="secundario" icono={X} onClick={() => setDetalle(null)}>
                Cerrar
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      <ModalAccion
        abierto={accion !== null}
        titulo={accion === 'recibir' ? '¿Marcar como recibida?' : '¿Cancelar la solicitud?'}
        mensaje={
          accion === 'recibir'
            ? 'Se registrará una entrada de inventario por cada producto. Hágalo solo cuando la mercadería ya esté en la tienda.'
            : 'El proveedor verá la solicitud como cancelada. No se registra ninguna entrada.'
        }
        textoConfirmar={accion === 'recibir' ? 'Sí, registrar entradas' : 'Sí, cancelar'}
        variante={accion === 'recibir' ? 'primario' : 'peligro'}
        icono={accion === 'recibir' ? PackageCheck : Ban}
        procesando={procesando}
        error={errorAccion}
        alConfirmar={confirmarAccion}
        alCancelar={() => {
          setAccion(null);
          setErrorAccion('');
        }}
      />
    </PaginaAnimada>
  );
}
