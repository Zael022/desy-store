// Pantalla 7: Portal del proveedor.
//   * Mis productos: solo los que él suministra (con disponibilidad; el stock
//     exacto solo si la dueña lo permitió).
//   * Solicitudes: pedidos de la tienda; puede aceptarlos o rechazarlos.
//   * Mis datos: contacto, teléfono, correo y dirección.
// El backend toma el proveedor de la sesión: aquí nunca se envía su id.
import { useState } from 'react';
import { Check, ClipboardList, Eye, Package, Save, Truck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import Pestanas from '../../components/Pestanas.jsx';
import TablaDatos from '../../components/TablaDatos.jsx';
import Boton from '../../components/Boton.jsx';
import Modal from '../../components/Modal.jsx';
import ModalAccion from '../../components/ModalAccion.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { InsigniaDisponibilidad, InsigniaEstado } from '../../components/Insignias.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import {
  actualizarMisDatos,
  listarMisProductos,
  listarMisSolicitudes,
  obtenerMiSolicitud,
  obtenerMisDatos,
  responderSolicitud
} from '../../services/portalProveedorService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { formatearFechaHora } from '../../utils/formato.js';

function MisProductos() {
  const { datos, cargando, error, recargar } = useDatos(listarMisProductos);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;
  if (datos.length === 0) return <SinRegistros texto="La tienda todavía no tiene productos suyos registrados." />;
  const conStock = datos.some((p) => 'stock' in p);
  const columnas = [
    { clave: 'codigo', titulo: 'Código' },
    { clave: 'nombre', titulo: 'Producto' },
    { clave: 'nombre_categoria', titulo: 'Categoría' },
    { clave: 'nombre_material', titulo: 'Material' },
    { clave: 'disponibilidad', titulo: 'Disponibilidad', mostrar: (p) => <InsigniaDisponibilidad valor={p.disponibilidad} /> },
    ...(conStock ? [{ clave: 'stock', titulo: 'Stock' }] : [])
  ];
  return <TablaDatos columnas={columnas} filas={datos} llave="id_producto" />;
}

function Solicitudes() {
  const { datos, cargando, error, recargar } = useDatos(listarMisSolicitudes);
  const [detalle, setDetalle] = useState(null);
  const [respuesta, setRespuesta] = useState(null); // 'aceptada' | 'rechazada'
  const [comentario, setComentario] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const [abriendo, setAbriendo] = useState(null);

  async function abrir(solicitud) {
    setAbriendo(solicitud.id_solicitud);
    try {
      setDetalle(await obtenerMiSolicitud(solicitud.id_solicitud));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAbriendo(null);
    }
  }

  async function confirmar() {
    if (respuesta === 'rechazada' && !comentario.trim()) {
      setErrorAccion('Escriba el motivo del rechazo.');
      return;
    }
    setProcesando(true);
    setErrorAccion('');
    try {
      const actualizada = await responderSolicitud(detalle.id_solicitud, respuesta, comentario.trim() || null);
      toast.success(actualizada.message);
      setDetalle(actualizada);
      setRespuesta(null);
      setComentario('');
      recargar();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;

  const columnas = [
    { clave: 'id_solicitud', titulo: 'Solicitud', mostrar: (s) => `#${s.id_solicitud}` },
    { clave: 'creada_en', titulo: 'Fecha', mostrar: (s) => formatearFechaHora(s.creada_en) },
    { clave: 'productos', titulo: 'Productos' },
    { clave: 'unidades', titulo: 'Unidades' },
    { clave: 'estado', titulo: 'Estado', mostrar: (s) => <InsigniaEstado estado={s.estado} /> }
  ];

  return (
    <>
      {datos.length === 0 ? (
        <SinRegistros texto="No tiene solicitudes de abastecimiento." />
      ) : (
        <TablaDatos
          columnas={columnas}
          filas={datos}
          llave="id_solicitud"
          acciones={(s) => (
            <Boton variante="fantasma" icono={Eye} onClick={() => abrir(s)} cargando={abriendo === s.id_solicitud} aria-label={`Ver la solicitud #${s.id_solicitud}`}>
              Ver
            </Boton>
          )}
        />
      )}

      <Modal abierto={detalle !== null && respuesta === null} alCerrar={() => setDetalle(null)} idTitulo="titulo-solicitud" className="modal-formulario">
        {detalle && (
          <div className="formulario">
            <h2 id="titulo-solicitud">Solicitud #{detalle.id_solicitud}</h2>
            <p className="texto-secundario">
              {formatearFechaHora(detalle.creada_en)} · <InsigniaEstado estado={detalle.estado} />
            </p>
            {detalle.nota_tienda && <p className="alerta alerta-info">Nota de la tienda: {detalle.nota_tienda}</p>}
            <ul className="lista-simple">
              {detalle.detalle.map((linea) => (
                <li key={linea.id_detalle_solicitud}>
                  <strong>{linea.cantidad}</strong> × {linea.codigo} · {linea.nombre_producto}
                </li>
              ))}
            </ul>
            {detalle.comentario_proveedor && <p>Su comentario: {detalle.comentario_proveedor}</p>}
            <div className="formulario-acciones">
              {detalle.estado === 'pendiente' && (
                <>
                  <Boton icono={Check} onClick={() => setRespuesta('aceptada')}>
                    Aceptar
                  </Boton>
                  <Boton variante="peligro" icono={X} onClick={() => setRespuesta('rechazada')}>
                    Rechazar
                  </Boton>
                </>
              )}
              <Boton variante="secundario" onClick={() => setDetalle(null)}>
                Cerrar
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      <ModalAccion
        abierto={respuesta !== null}
        titulo={respuesta === 'aceptada' ? `¿Aceptar la solicitud #${detalle?.id_solicitud}?` : `¿Rechazar la solicitud #${detalle?.id_solicitud}?`}
        mensaje={respuesta === 'aceptada' ? 'La tienda verá que usted enviará estos productos.' : 'Explique a la tienda por qué no puede atenderla.'}
        textoConfirmar={respuesta === 'aceptada' ? 'Sí, aceptar' : 'Sí, rechazar'}
        variante={respuesta === 'aceptada' ? 'primario' : 'peligro'}
        procesando={procesando}
        error={errorAccion}
        alConfirmar={confirmar}
        alCancelar={() => {
          setRespuesta(null);
          setErrorAccion('');
        }}
      >
        <CampoFormulario
          id="comentario"
          etiqueta={respuesta === 'rechazada' ? 'Motivo del rechazo' : 'Comentario (opcional)'}
          tipo="textarea"
          valor={comentario}
          alCambiar={(_c, v) => setComentario(v)}
          maxLength={255}
          obligatorio={respuesta === 'rechazada'}
        />
      </ModalAccion>
    </>
  );
}

function MisDatos() {
  const { datos, cargando, error, recargar, setDatos } = useDatos(obtenerMisDatos);
  const [formulario, setFormulario] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');

  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;
  const valores = formulario ?? {
    contacto: datos.contacto ?? '',
    telefono: datos.telefono ?? '',
    correo: datos.correo ?? '',
    direccion: datos.direccion ?? ''
  };
  const cambiar = (campo, valor) => setFormulario({ ...valores, [campo]: valor });

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');
    try {
      const actualizado = await actualizarMisDatos(valores);
      setDatos(actualizado);
      setFormulario(null);
      toast.success('Datos actualizados.');
    } catch (err) {
      setErrorFormulario(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="formulario formulario-angosto" onSubmit={guardar} noValidate>
      <div className="campo">
        <span className="campo-etiqueta-fija">Proveedor</span>
        <p className="campo-valor-fijo">{datos.nombre}</p>
        <small className="campo-ayuda">El nombre lo cambia la tienda.</small>
      </div>
      <MensajeFormulario>{errorFormulario}</MensajeFormulario>
      <CampoFormulario id="contacto" etiqueta="Persona de contacto" valor={valores.contacto} alCambiar={cambiar} maxLength={100} disabled={guardando} />
      <CampoFormulario id="telefono" etiqueta="Teléfono" tipo="tel" valor={valores.telefono} alCambiar={cambiar} obligatorio maxLength={20} disabled={guardando} />
      <CampoFormulario id="correo" etiqueta="Correo de contacto" tipo="email" valor={valores.correo} alCambiar={cambiar} maxLength={100} disabled={guardando} />
      <CampoFormulario id="direccion" etiqueta="Dirección" tipo="textarea" valor={valores.direccion} alCambiar={cambiar} maxLength={255} disabled={guardando} />
      <div className="formulario-acciones">
        <Boton type="submit" icono={Save} cargando={guardando} disabled={!formulario}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </Boton>
      </div>
    </form>
  );
}

const PESTANAS = [
  { valor: 'productos', texto: 'Mis productos', icono: Package },
  { valor: 'solicitudes', texto: 'Solicitudes', icono: ClipboardList },
  { valor: 'datos', texto: 'Mis datos', icono: Truck }
];

export default function ProveedorPortalPage() {
  const [pestana, setPestana] = useState('solicitudes');
  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Proveedor', 'Mi portal']} descripcion="Consulte sus productos en Desy, responda los pedidos de la tienda y mantenga al día sus datos de contacto." />
      <section className="tarjeta">
        <Pestanas opciones={PESTANAS} valor={pestana} alCambiar={setPestana} etiqueta="Secciones del portal" />
        <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`pestana-${pestana}`} className="panel-pestana">
          {pestana === 'productos' && <MisProductos />}
          {pestana === 'solicitudes' && <Solicitudes />}
          {pestana === 'datos' && <MisDatos />}
        </div>
      </section>
    </PaginaAnimada>
  );
}
