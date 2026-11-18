// Ficha de un producto del inventario (/admin/productos/:id), con el estilo de la página de producto de una tienda:
//   - Ruta de enlaces, fotos (con el botón "Administrar fotos"), código, nombre, precio y stock disponible.
//   - En lugar de "Agregar al carrito": Cantidad (− 1 +) y los botones
//     "Registrar entrada" y "Registrar salida", que crean un movimiento real en la API.
//   - Pestañas "Descripción" y "Movimientos" (historial de este producto).
//   - "Productos similares" (misma categoría).
// El movimiento lo registra la persona con la sesión abierta (el backend lo toma de la sesión).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { ArrowDownToLine, ArrowUpFromLine, Images, Layers, Minus, PackageX, Plus, ShieldCheck, Truck } from 'lucide-react';
import PaginaAnimada from '../components/PaginaAnimada.jsx';
import MigasDePan from '../components/MigasDePan.jsx';
import Boton from '../components/Boton.jsx';
import IndicadorStock from '../components/IndicadorStock.jsx';
import TarjetaProducto from '../components/TarjetaProducto.jsx';
import FilaDeslizable from '../components/FilaDeslizable.jsx';
import { Cargando, ErrorCarga } from '../components/EstadoLista.jsx';
import { obtenerProducto, listarProductos, listarFotos } from '../services/productosService.js';
import GaleriaProducto from '../components/GaleriaProducto.jsx';
import ModalFotos from '../components/ModalFotos.jsx';
import { listarMovimientos, crearMovimiento } from '../services/movimientosService.js';
import { useAutenticacion } from '../hooks/useAutenticacion.js';
import { listarMateriales } from '../services/materialesService.js';
import { obtenerConfiguracion } from '../services/configuracionService.js';
import { fechaDeHoy, formatearFecha, formatearPrecio } from '../utils/formato.js';

const PESTANAS = [
  { id: 'descripcion', texto: 'Descripción' },
  { id: 'movimientos', texto: 'Movimientos' }
];

export default function ProductoDetallePage() {
  const { id } = useParams(); // el :id de la dirección

  const [producto, setProducto] = useState(null);
  const [similares, setSimilares] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [fotos, setFotos] = useState([]); // { archivo, es_de_medidas }: las de medidas siempre al final
  const [fotosAbierto, setFotosAbierto] = useState(false);
  const { usuario } = useAutenticacion();
  const [material, setMaterial] = useState(null);
  const [stockMaximo, setStockMaximo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [recarga, setRecarga] = useState(0);

  // Formulario rápido de entrada/salida.
  const [cantidad, setCantidad] = useState(1);
  const [registrando, setRegistrando] = useState(null); // 'entrada' | 'salida' | null
  const [errorMovimiento, setErrorMovimiento] = useState('');
  const [pestana, setPestana] = useState('descripcion');

  useEffect(() => {
    let activo = true;
    Promise.all([obtenerProducto(id), listarProductos(), listarMovimientos(), listarMateriales(), obtenerConfiguracion(), listarFotos(id)])
      .then(([datosProducto, listaProductos, listaMovimientos, listaMateriales, configuracion, listaFotos]) => {
        if (!activo) return;
        setProducto(datosProducto);
        setFotos(listaFotos);
        // Similares: misma categoría primero; si hay pocos, se completan con otros productos.
        const otros = listaProductos.filter((p) => p.id_producto !== datosProducto.id_producto);
        const mismaCategoria = otros.filter((p) => p.id_categoria === datosProducto.id_categoria);
        const resto = otros.filter((p) => p.id_categoria !== datosProducto.id_categoria);
        setSimilares([...mismaCategoria, ...resto].slice(0, 8));
        setMovimientos(listaMovimientos.filter((m) => m.id_producto === datosProducto.id_producto));
        setMaterial(listaMateriales.find((m) => m.id_material === datosProducto.id_material) ?? null);
        setStockMaximo(configuracion.stock_maximo);
        setErrorCarga(null);
      })
      .catch((error) => activo && setErrorCarga(error))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [id, recarga]);

  function reintentar() {
    setCargando(true);
    setRecarga((n) => n + 1);
  }

  // El selector de cantidad va de 1 al máximo permitido.
  function cambiarCantidad(nueva) {
    const numero = Number.parseInt(nueva, 10);
    if (Number.isNaN(numero)) return setCantidad('');
    setCantidad(Math.min(Math.max(numero, 1), stockMaximo ?? 1));
  }

  async function registrar(tipo) {
    setRegistrando(tipo);
    setErrorMovimiento('');
    try {
      const guardado = await crearMovimiento({
        id_producto: producto.id_producto,
        tipo,
        cantidad: cantidad === '' ? null : cantidad,
        fecha: fechaDeHoy(),
        motivo: 'Registrado desde la ficha del producto'
      });
      toast.success(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${guardado.cantidad} registrada. Stock: ${guardado.stock_actual}.`);
      setCantidad(1);
      setRecarga((n) => n + 1); // vuelve a pedir el producto con su stock nuevo
    } catch (error) {
      setErrorMovimiento(error.message);
      toast.error(error.message);
    } finally {
      setRegistrando(null);
    }
  }

  if (cargando) {
    return (
      <PaginaAnimada>
        <div className="tarjeta">
          <Cargando texto="Cargando el producto..." />
        </div>
      </PaginaAnimada>
    );
  }

  if (errorCarga) {
    const noExiste = errorCarga.message === 'El producto no existe.' || errorCarga.message.startsWith('El ID');
    return (
      <PaginaAnimada>
        <MigasDePan pasos={[{ texto: 'Panel', ruta: '/admin' }, { texto: 'Productos', ruta: '/admin/productos' }, { texto: 'No encontrado' }]} />
        <div className="tarjeta">
          {noExiste ? (
            <div className="estado">
              <PackageX size={34} aria-hidden="true" />
              <p>
                <strong>Este producto no existe o fue eliminado.</strong>
              </p>
              <Link to="/admin/productos">Volver a productos</Link>
            </div>
          ) : (
            <ErrorCarga error={errorCarga} alReintentar={reintentar} />
          )}
        </div>
      </PaginaAnimada>
    );
  }

  const ocupado = registrando !== null;

  return (
    <PaginaAnimada>
      <MigasDePan
        pasos={[
          { texto: 'Panel', ruta: '/admin' },
          { texto: 'Productos', ruta: '/admin/productos' },
          ...(producto.id_categoria_padre ? [{ texto: producto.nombre_categoria_padre, ruta: `/admin/productos?categoria=${producto.id_categoria_padre}` }] : []),
          { texto: producto.nombre_categoria, ruta: `/admin/productos?categoria=${producto.id_categoria}` },
          { texto: producto.nombre }
        ]}
      />

      <div className="ficha">
        <GaleriaProducto
          key={producto.id_producto}
          producto={producto}
          fotos={fotos.map((f) => f.archivo)}
          medidas={fotos.filter((f) => f.es_de_medidas).map((f) => f.archivo)}
          agotado={producto.stock === 0}
          acciones={
            <Boton variante="secundario" icono={Images} onClick={() => setFotosAbierto(true)} className="galeria-administrar">
              Administrar fotos ({fotos.length})
            </Boton>
          }
        />

        <div className="ficha-info">
          <p className="ficha-codigo">Código: {producto.codigo}</p>
          <h1 className="ficha-nombre">{producto.nombre}</h1>
          <p className="ficha-precio">{formatearPrecio(producto.precio)}</p>

          <div className="ficha-caja">
            <p>
              <Layers size={18} aria-hidden="true" /> {producto.nombre_material}
              {material?.es_hipoalergenico && (
                <span className="etiqueta etiqueta-si">
                  <ShieldCheck size={14} aria-hidden="true" /> Hipoalergénico
                </span>
              )}
            </p>
            <p>
              <Truck size={18} aria-hidden="true" /> Proveedor: {producto.nombre_proveedor}
            </p>
            {/* El costo solo llega del backend si la sesión es de la dueña. */}
            {'costo_unitario' in producto && (
              <p>
                <ShieldCheck size={18} aria-hidden="true" /> Costo unitario: {producto.costo_unitario === null ? 'sin registrar' : formatearPrecio(producto.costo_unitario)}
              </p>
            )}
          </div>

          <div className="ficha-movimiento">
            <span className="ficha-etiqueta" id="etiqueta-cantidad">
              Cantidad
            </span>
            <div className="selector-cantidad" role="group" aria-labelledby="etiqueta-cantidad">
              <button type="button" onClick={() => cambiarCantidad((cantidad || 1) - 1)} disabled={ocupado || cantidad <= 1} aria-label="Restar uno">
                <Minus size={20} aria-hidden="true" />
              </button>
              <input
                type="number"
                min="1"
                max={stockMaximo}
                value={cantidad}
                onChange={(evento) => cambiarCantidad(evento.target.value)}
                aria-label="Cantidad de unidades"
                disabled={ocupado}
              />
              <button type="button" onClick={() => cambiarCantidad((cantidad || 0) + 1)} disabled={ocupado || cantidad >= stockMaximo} aria-label="Sumar uno">
                <Plus size={20} aria-hidden="true" />
              </button>
            </div>
            <p className="ficha-disponible">
              {producto.stock} unidades disponibles en stock (máximo {stockMaximo})
              {producto.apartado > 0 && (
                <>
                  {' · '}
                  <Link to="/pos/pedidos" className="texto-apartado">
                    {producto.apartado} apartadas en pedidos de clientes
                  </Link>{' '}
                  (se pueden sacar {Math.max(producto.stock - producto.apartado, 0)})
                </>
              )}
            </p>
            <IndicadorStock stock={producto.stock} maximo={stockMaximo} />

            <p className="ficha-registra">
              Registrado por: <strong>{usuario?.nombre}</strong>
            </p>

            {errorMovimiento && (
              <p className="alerta alerta-error" role="alert">
                {errorMovimiento}
              </p>
            )}

            <div className="ficha-botones">
              <Boton icono={ArrowDownToLine} onClick={() => registrar('entrada')} cargando={registrando === 'entrada'} disabled={ocupado}>
                {registrando === 'entrada' ? 'Registrando...' : 'Registrar entrada'}
              </Boton>
              <Boton variante="secundario" icono={ArrowUpFromLine} onClick={() => registrar('salida')} cargando={registrando === 'salida'} disabled={ocupado}>
                {registrando === 'salida' ? 'Registrando...' : 'Registrar salida'}
              </Boton>
            </div>
            <p className="ficha-nota">
              Para editar o eliminar movimientos use la página <Link to="/admin/movimientos">Movimientos</Link>. Para editar el producto, use el lápiz de su tarjeta en{' '}
              <Link to="/admin/productos">Productos</Link>.
            </p>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <section className="tarjeta pestanas">
        <div className="pestanas-lista" role="tablist" aria-label="Información del producto">
          {PESTANAS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`pestana-${item.id}`}
              aria-selected={pestana === item.id}
              aria-controls={`panel-${item.id}`}
              className={pestana === item.id ? 'pestana activa' : 'pestana'}
              onClick={() => setPestana(item.id)}
            >
              {item.texto}
              {item.id === 'movimientos' && ` (${movimientos.length})`}
              {pestana === item.id && <motion.span layoutId="subrayado-pestana" className="pestana-subrayado" />}
            </button>
          ))}
        </div>

        {pestana === 'descripcion' ? (
          <div role="tabpanel" id="panel-descripcion" aria-labelledby="pestana-descripcion" className="pestana-panel">
            <p>{producto.descripcion || 'Este producto no tiene descripción.'}</p>
            <dl className="ficha-datos">
              <dt>Categoría</dt>
              <dd>{producto.nombre_categoria}</dd>
              <dt>Material</dt>
              <dd>{producto.nombre_material}</dd>
              <dt>Proveedor</dt>
              <dd>{producto.nombre_proveedor}</dd>
              <dt>Movimientos registrados</dt>
              <dd>{movimientos.length}</dd>
            </dl>
          </div>
        ) : (
          <div role="tabpanel" id="panel-movimientos" aria-labelledby="pestana-movimientos" className="pestana-panel">
            {movimientos.length === 0 ? (
              <p className="texto-secundario">Todavía no hay movimientos de este producto.</p>
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Cantidad</th>
                      <th scope="col">Registró</th>
                      <th scope="col">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={m.id_movimiento}>
                        <td data-titulo="Fecha">{formatearFecha(m.fecha)}</td>
                        <td data-titulo="Tipo">
                          <span className={`etiqueta ${m.tipo === 'entrada' ? 'etiqueta-entrada' : 'etiqueta-salida'}`}>{m.tipo === 'entrada' ? 'Entrada' : 'Salida'}</span>
                        </td>
                        <td data-titulo="Cantidad">
                          <strong className={m.tipo === 'entrada' ? 'texto-entrada' : 'texto-salida'}>{m.tipo === 'entrada' ? `+${m.cantidad}` : `−${m.cantidad}`}</strong>
                        </td>
                        <td data-titulo="Registró">{m.nombre_empleado}</td>
                        <td data-titulo="Motivo">{m.motivo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {similares.length > 0 && (
        <FilaDeslizable titulo="Productos similares">
          {similares.map((p, indice) => (
            <TarjetaProducto key={p.id_producto} producto={p} stockMaximo={stockMaximo} indice={indice} compacta />
          ))}
        </FilaDeslizable>
      )}
      <ModalFotos producto={fotosAbierto ? producto : null} alCerrar={() => setFotosAbierto(false)} alCambiar={setFotos} />
    </PaginaAnimada>
  );
}
