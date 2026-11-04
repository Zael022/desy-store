// Página de Movimientos de inventario (entradas y salidas).
// Aquí es el ÚNICO lugar donde cambia el stock de un producto.
// La página muestra el stock actual, el máximo permitido y cómo quedaría el
// stock al guardar. La decisión final la toma el backend (409 si no se puede).
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDownToLine, ArrowUpFromLine, Plus, Save, TriangleAlert, X } from 'lucide-react';
import PaginaAnimada from '../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../components/EncabezadoPagina.jsx';
import CampoFormulario from '../components/CampoFormulario.jsx';
import Boton from '../components/Boton.jsx';
import TablaDatos from '../components/TablaDatos.jsx';
import ModalConfirmacion from '../components/ModalConfirmacion.jsx';
import IndicadorStock from '../components/IndicadorStock.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../components/EstadoLista.jsx';
import { listarMovimientos, crearMovimiento, actualizarMovimiento, eliminarMovimiento } from '../services/movimientosService.js';
import { listarProductos } from '../services/productosService.js';
import { listarEmpleados } from '../services/empleadosService.js';
import { obtenerConfiguracion } from '../services/configuracionService.js';
import { aNumero, fechaDeHoy, formatearFecha } from '../utils/formato.js';

const OPCIONES_TIPO = [
  { valor: 'entrada', texto: 'Entrada (suma al stock)' },
  { valor: 'salida', texto: 'Salida (resta del stock)' }
];

function formularioVacio() {
  return { id_producto: '', id_empleado: '', tipo: 'entrada', cantidad: '', fecha: fechaDeHoy(), motivo: '' };
}

// Una entrada suma y una salida resta (la misma regla que usa el backend).
function efecto(tipo, cantidad) {
  return tipo === 'entrada' ? cantidad : -cantidad;
}

function EtiquetaTipo({ tipo }) {
  const esEntrada = tipo === 'entrada';
  const Icono = esEntrada ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <span className={`etiqueta ${esEntrada ? 'etiqueta-entrada' : 'etiqueta-salida'}`}>
      <Icono size={14} aria-hidden="true" />
      {esEntrada ? 'Entrada' : 'Salida'}
    </span>
  );
}

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [stockMaximo, setStockMaximo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [recarga, setRecarga] = useState(0);

  const [formulario, setFormulario] = useState(formularioVacio);
  const [idEditando, setIdEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const refFormulario = useRef(null);

  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const ocupado = guardando || eliminando;

  // Se piden también los productos para mostrar su stock actualizado después de cada cambio.
  useEffect(() => {
    let activo = true;
    Promise.all([listarMovimientos(), listarProductos(), listarEmpleados(), obtenerConfiguracion()])
      .then(([listaMovimientos, listaProductos, listaEmpleados, configuracion]) => {
        if (!activo) return;
        setMovimientos(listaMovimientos);
        setProductos(listaProductos);
        setEmpleados(listaEmpleados);
        setStockMaximo(configuracion.stock_maximo);
        setErrorCarga(null);
      })
      .catch((error) => activo && setErrorCarga(error))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [recarga]);

  const recargarLista = () => setRecarga((n) => n + 1);

  function reintentar() {
    setCargando(true);
    recargarLista();
  }

  function cambiarCampo(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function empezarEdicion(movimiento) {
    setIdEditando(movimiento.id_movimiento);
    setFormulario({
      id_producto: String(movimiento.id_producto),
      id_empleado: String(movimiento.id_empleado),
      tipo: movimiento.tipo,
      cantidad: String(movimiento.cantidad),
      fecha: movimiento.fecha,
      motivo: movimiento.motivo ?? ''
    });
    setErrorFormulario('');
    refFormulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelarEdicion() {
    setIdEditando(null);
    setFormulario(formularioVacio());
    setErrorFormulario('');
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');
    const datos = {
      id_producto: aNumero(formulario.id_producto),
      id_empleado: aNumero(formulario.id_empleado),
      tipo: formulario.tipo,
      cantidad: aNumero(formulario.cantidad),
      fecha: formulario.fecha,
      motivo: formulario.motivo
    };
    try {
      let guardado;
      if (idEditando) {
        guardado = await actualizarMovimiento(idEditando, datos);
        toast.success(`Movimiento actualizado. Stock de "${guardado.nombre_producto}": ${guardado.stock_actual}.`);
      } else {
        guardado = await crearMovimiento(datos);
        toast.success(`${guardado.tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada. Stock de "${guardado.nombre_producto}": ${guardado.stock_actual}.`);
      }
      cancelarEdicion();
      recargarLista();
    } catch (error) {
      setErrorFormulario(error.message);
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminacion() {
    setEliminando(true);
    try {
      const respuesta = await eliminarMovimiento(porEliminar.id_movimiento);
      toast.success(respuesta.message);
      if (idEditando === porEliminar.id_movimiento) cancelarEdicion();
      recargarLista();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  }

  // ----- Vista previa del stock (solo informativa) -----
  const productoElegido = productos.find((p) => String(p.id_producto) === formulario.id_producto);
  const movimientoOriginal = idEditando ? movimientos.find((m) => m.id_movimiento === idEditando) : null;
  const cantidad = Number(formulario.cantidad);
  let stockResultante = null;
  if (productoElegido && Number.isInteger(cantidad) && cantidad > 0) {
    let base = productoElegido.stock;
    // Si se edita un movimiento del mismo producto, primero se "devuelve" su efecto anterior.
    if (movimientoOriginal && movimientoOriginal.id_producto === productoElegido.id_producto) {
      base -= efecto(movimientoOriginal.tipo, movimientoOriginal.cantidad);
    }
    stockResultante = base + efecto(formulario.tipo, cantidad);
  }
  const fueraDeRango = stockResultante !== null && stockMaximo !== null && (stockResultante < 0 || stockResultante > stockMaximo);

  const opcionesProductos = productos.map((p) => ({
    valor: String(p.id_producto),
    texto: `${p.codigo} · ${p.nombre} (stock ${p.stock}${stockMaximo !== null ? ` de ${stockMaximo}` : ''})`
  }));
  const opcionesEmpleados = empleados.map((e) => ({ valor: String(e.id_empleado), texto: `${e.nombre} (${e.puesto})` }));

  const columnas = [
    { clave: 'fecha', titulo: 'Fecha', mostrar: (m) => formatearFecha(m.fecha) },
    { clave: 'nombre_producto', titulo: 'Producto', mostrar: (m) => `${m.codigo_producto} · ${m.nombre_producto}` },
    { clave: 'tipo', titulo: 'Tipo', mostrar: (m) => <EtiquetaTipo tipo={m.tipo} /> },
    { clave: 'cantidad', titulo: 'Cantidad', mostrar: (m) => <strong className={m.tipo === 'entrada' ? 'texto-entrada' : 'texto-salida'}>{m.tipo === 'entrada' ? `+${m.cantidad}` : `−${m.cantidad}`}</strong> },
    { clave: 'nombre_empleado', titulo: 'Registró' },
    { clave: 'motivo', titulo: 'Motivo' },
    { clave: 'stock_actual', titulo: 'Stock actual', mostrar: (m) => <IndicadorStock stock={m.stock_actual} maximo={stockMaximo} /> }
  ];

  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Inventario', 'Movimientos']} descripcion="Registre las entradas (compras, devoluciones) y salidas (ventas, daños) de mercadería." />

      <div className="disposicion-crud">
        <form ref={refFormulario} className="tarjeta formulario" onSubmit={guardar} noValidate>
          <h2>{idEditando ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
          {errorFormulario && (
            <p className="alerta alerta-error" role="alert">
              {errorFormulario}
            </p>
          )}
          <CampoFormulario id="id_producto" etiqueta="Producto" tipo="select" valor={formulario.id_producto} alCambiar={cambiarCampo} opciones={opcionesProductos} textoOpcionVacia="Seleccione un producto" obligatorio />

          {/* Panel con el stock del producto elegido y el máximo permitido. */}
          <div className="panel-stock" aria-live="polite">
            <div>
              <span className="panel-etiqueta">Stock actual</span>
              <strong>{productoElegido ? productoElegido.stock : '—'}</strong>
            </div>
            <div>
              <span className="panel-etiqueta">Máximo permitido</span>
              <strong>{stockMaximo ?? '—'}</strong>
            </div>
            <div>
              <span className="panel-etiqueta">Quedaría en</span>
              <strong className={fueraDeRango ? 'texto-salida' : ''}>{stockResultante ?? '—'}</strong>
            </div>
          </div>
          {fueraDeRango && (
            <p className="alerta alerta-advertencia">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>
                {stockResultante > stockMaximo
                  ? `Con esta cantidad el stock pasaría de ${stockMaximo}. El sistema rechazará la operación.`
                  : 'Con esta cantidad el stock quedaría en negativo. El sistema rechazará la operación.'}
              </span>
            </p>
          )}

          <div className="fila-campos">
            <CampoFormulario id="tipo" etiqueta="Tipo" tipo="select" valor={formulario.tipo} alCambiar={cambiarCampo} opciones={OPCIONES_TIPO} textoOpcionVacia="Seleccione el tipo" obligatorio />
            <CampoFormulario id="cantidad" etiqueta="Cantidad" tipo="number" min="1" max={stockMaximo ?? undefined} step="1" valor={formulario.cantidad} alCambiar={cambiarCampo} obligatorio />
          </div>
          <div className="fila-campos">
            <CampoFormulario id="fecha" etiqueta="Fecha" tipo="date" valor={formulario.fecha} alCambiar={cambiarCampo} obligatorio />
            <CampoFormulario id="id_empleado" etiqueta="Registrado por" tipo="select" valor={formulario.id_empleado} alCambiar={cambiarCampo} opciones={opcionesEmpleados} textoOpcionVacia="Seleccione un empleado" obligatorio />
          </div>
          <CampoFormulario id="motivo" etiqueta="Motivo" valor={formulario.motivo} alCambiar={cambiarCampo} maxLength={255} placeholder="Ejemplo: Venta en tienda" />
          <div className="formulario-acciones">
            <Boton type="submit" icono={idEditando ? Save : Plus} cargando={guardando} disabled={eliminando || cargando}>
              {guardando ? 'Guardando...' : idEditando ? 'Guardar cambios' : 'Registrar movimiento'}
            </Boton>
            {idEditando && (
              <Boton variante="secundario" icono={X} onClick={cancelarEdicion} disabled={guardando}>
                Cancelar
              </Boton>
            )}
          </div>
        </form>

        <section className="tarjeta" aria-labelledby="titulo-lista">
          <h2 id="titulo-lista">Historial de movimientos</h2>
          {cargando ? (
            <Cargando />
          ) : errorCarga ? (
            <ErrorCarga error={errorCarga} alReintentar={reintentar} />
          ) : movimientos.length === 0 ? (
            <SinRegistros texto="Todavía no hay movimientos. Registre la primera entrada de un producto." />
          ) : (
            <TablaDatos
              columnas={columnas}
              filas={movimientos}
              llave="id_movimiento"
              idEditando={idEditando}
              ocupado={ocupado}
              nombreFila={(m) => `${m.tipo} de ${m.cantidad} de ${m.nombre_producto}`}
              alEditar={empezarEdicion}
              alEliminar={setPorEliminar}
            />
          )}
        </section>
      </div>

      <ModalConfirmacion
        abierto={porEliminar !== null}
        titulo="¿Eliminar este movimiento?"
        mensaje={
          porEliminar &&
          `Se eliminará la ${porEliminar.tipo} de ${porEliminar.cantidad} unidad(es) de "${porEliminar.nombre_producto}" y su efecto se revertirá en el stock (${porEliminar.tipo === 'entrada' ? 'se restarán' : 'se sumarán'} ${porEliminar.cantidad}).`
        }
        procesando={eliminando}
        alConfirmar={confirmarEliminacion}
        alCancelar={() => setPorEliminar(null)}
      />
    </PaginaAnimada>
  );
}
