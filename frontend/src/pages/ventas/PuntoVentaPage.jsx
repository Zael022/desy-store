// Pantalla 8: Punto de venta (rol ventas; administración y dueña también pueden usarlo).
//   1. Buscar productos (precio y stock) y agregarlos a la venta.
//   2. Ajustar cantidades: si piden más de lo que hay, se avisa al momento.
//   3. Opcional: asociar un cliente registrado (para que vea la compra en su cuenta).
//   4. Confirmar en un modal. El backend guarda todo en UNA transacción.
//
// Idempotencia: cada venta lleva una "clave" única (crypto.randomUUID). Si la
// conexión falla y se vuelve a enviar, el backend reconoce la clave y no cobra
// dos veces. Además el botón se deshabilita mientras se envía.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { CircleCheck, Minus, Plus, Search, ShoppingBag, Trash2, TriangleAlert, UserRound, X } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import Boton from '../../components/Boton.jsx';
import ModalAccion from '../../components/ModalAccion.jsx';
import Modal from '../../components/Modal.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import { InsigniaDisponibilidad } from '../../components/Insignias.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { buscarClientesPos, buscarProductosPos, crearVenta } from '../../services/ventasService.js';
import { formatearPrecio } from '../../utils/formato.js';

const nuevaClave = () => crypto.randomUUID();

export default function PuntoVentaPage() {
  // ----- Búsqueda de productos -----
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(true);
  const [errorBusqueda, setErrorBusqueda] = useState(null);
  const [recarga, setRecarga] = useState(0);

  // ----- Venta actual -----
  const [lineas, setLineas] = useState([]); // [{ producto, cantidad }]
  const [clave, setClave] = useState(nuevaClave);
  const [cliente, setCliente] = useState(null);
  const [nota, setNota] = useState('');

  // ----- Búsqueda de clientes -----
  const [textoCliente, setTextoCliente] = useState('');
  const [clientes, setClientes] = useState([]);

  // ----- Confirmación -----
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorVenta, setErrorVenta] = useState('');
  const [comprobante, setComprobante] = useState(null);

  // Busca productos 300 ms después de dejar de escribir.
  useEffect(() => {
    let activo = true;
    const temporizador = setTimeout(() => {
      setBuscando(true);
      buscarProductosPos(texto.trim())
        .then((lista) => {
          if (!activo) return;
          setResultados(lista);
          setErrorBusqueda(null);
          // Actualiza el stock de lo que ya está en la venta (puede haber cambiado).
          setLineas((anteriores) => anteriores.map((l) => ({ ...l, producto: lista.find((p) => p.id_producto === l.producto.id_producto) ?? l.producto })));
        })
        .catch((error) => activo && setErrorBusqueda(error))
        .finally(() => activo && setBuscando(false));
    }, 300);
    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [texto, recarga]);

  useEffect(() => {
    if (textoCliente.trim().length < 2) return undefined;
    let activo = true;
    const temporizador = setTimeout(() => {
      buscarClientesPos(textoCliente.trim())
        .then((lista) => activo && setClientes(lista))
        .catch(() => activo && setClientes([]));
    }, 300);
    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [textoCliente]);

  // Cualquier cambio en los productos es una venta distinta: clave nueva.
  function cambiarLineas(funcion) {
    setLineas(funcion);
    setClave(nuevaClave());
    setErrorVenta('');
  }

  function agregar(producto) {
    cambiarLineas((anteriores) => {
      const existente = anteriores.find((l) => l.producto.id_producto === producto.id_producto);
      if (existente) return anteriores.map((l) => (l === existente ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...anteriores, { producto, cantidad: 1 }];
    });
  }

  function cambiarCantidad(idProducto, cantidad) {
    const numero = Number.parseInt(cantidad, 10);
    cambiarLineas((anteriores) => anteriores.map((l) => (l.producto.id_producto === idProducto ? { ...l, cantidad: Number.isNaN(numero) ? '' : Math.max(1, Math.min(numero, 67)) } : l)));
  }

  function quitar(idProducto) {
    cambiarLineas((anteriores) => anteriores.filter((l) => l.producto.id_producto !== idProducto));
  }

  const total = useMemo(() => lineas.reduce((suma, l) => suma + (Number(l.cantidad) || 0) * l.producto.precio, 0), [lineas]);
  const faltantes = lineas.filter((l) => Number(l.cantidad) > l.producto.stock);
  const ventaInvalida = lineas.length === 0 || faltantes.length > 0 || lineas.some((l) => !Number(l.cantidad));

  async function confirmarVenta() {
    setEnviando(true);
    setErrorVenta('');
    try {
      const venta = await crearVenta({
        clave_idempotencia: clave,
        id_cliente: cliente?.id_cliente ?? null,
        nota: nota.trim() || null,
        items: lineas.map((l) => ({ id_producto: l.producto.id_producto, cantidad: Number(l.cantidad) }))
      });
      toast.success(venta.message);
      setComprobante(venta);
      setConfirmando(false);
      setLineas([]);
      setCliente(null);
      setNota('');
      setClave(nuevaClave());
      setRecarga((n) => n + 1);
    } catch (error) {
      setErrorVenta(error.message);
      // 409 = el stock cambió (otra venta se adelantó): se refrescan los productos.
      if (error.status === 409) setRecarga((n) => n + 1);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Ventas', 'Punto de venta']} descripcion="Busque productos, arme la venta y confírmela. El stock se descuenta al confirmar." />
      <div className="pos">
        <section className="tarjeta pos-productos" aria-labelledby="titulo-buscar">
          <h2 id="titulo-buscar">Productos</h2>
          <div className="pos-busqueda">
            <Search size={20} aria-hidden="true" />
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nombre o código" aria-label="Buscar productos para la venta" autoFocus />
          </div>
          {buscando && resultados.length === 0 ? (
            <Cargando texto="Buscando..." />
          ) : errorBusqueda ? (
            <ErrorCarga error={errorBusqueda} alReintentar={() => setRecarga((n) => n + 1)} />
          ) : resultados.length === 0 ? (
            <SinRegistros texto={`No hay productos con “${texto}”.`} />
          ) : (
            <ul className="pos-lista">
              {resultados.map((p) => {
                const enVenta = lineas.find((l) => l.producto.id_producto === p.id_producto)?.cantidad ?? 0;
                return (
                  <li key={p.id_producto} className="pos-producto">
                    <span className="pos-producto-info">
                      <strong>{p.nombre}</strong>
                      <small>
                        {p.codigo} · {p.nombre_categoria}
                      </small>
                    </span>
                    <span className="pos-producto-precio">{formatearPrecio(p.precio)}</span>
                    <span className="pos-producto-stock">
                      <InsigniaDisponibilidad valor={p.disponibilidad} />
                      <small>
                        {p.stock} disponibles
                        {p.apartado > 0 && <span className="pos-apartado"> · {p.apartado} apartadas en pedidos</span>}
                      </small>
                    </span>
                    <Boton variante="secundario" icono={Plus} onClick={() => agregar(p)} disabled={p.stock === 0 || enVenta >= p.stock || enviando} aria-label={`Agregar ${p.nombre}`}>
                      Agregar
                    </Boton>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="tarjeta pos-venta" aria-labelledby="titulo-venta">
          <h2 id="titulo-venta">
            <ShoppingBag size={20} aria-hidden="true" /> Venta actual
          </h2>
          {lineas.length === 0 ? (
            <SinRegistros texto="Agregue productos desde la lista." />
          ) : (
            <ul className="pos-lineas">
              {lineas.map(({ producto, cantidad }) => {
                const falta = Number(cantidad) > producto.stock;
                return (
                  <li key={producto.id_producto} className={falta ? 'pos-linea con-alerta' : 'pos-linea'}>
                    <span className="pos-linea-nombre">
                      <strong>{producto.nombre}</strong>
                      <small>{formatearPrecio(producto.precio)} c/u</small>
                    </span>
                    <div className="selector-cantidad selector-pequeno" role="group" aria-label={`Cantidad de ${producto.nombre}`}>
                      <button type="button" onClick={() => cambiarCantidad(producto.id_producto, Number(cantidad) - 1)} disabled={enviando || cantidad <= 1} aria-label="Restar uno">
                        <Minus size={16} aria-hidden="true" />
                      </button>
                      <input type="number" min="1" max={producto.stock} value={cantidad} onChange={(e) => cambiarCantidad(producto.id_producto, e.target.value)} aria-label="Cantidad" disabled={enviando} />
                      <button type="button" onClick={() => cambiarCantidad(producto.id_producto, Number(cantidad) + 1)} disabled={enviando || cantidad >= producto.stock} aria-label="Sumar uno">
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <strong className="pos-linea-subtotal">{formatearPrecio((Number(cantidad) || 0) * producto.precio)}</strong>
                    <Boton variante="fantasma" className="boton-eliminar" icono={Trash2} onClick={() => quitar(producto.id_producto)} disabled={enviando} aria-label={`Quitar ${producto.nombre}`} />
                    {falta && (
                      <p className="alerta alerta-advertencia pos-alerta" role="alert">
                        <TriangleAlert size={16} aria-hidden="true" />
                        <span>Solo quedan {producto.stock} unidad(es) de este producto.</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="pos-cliente">
            <span className="campo-etiqueta-fija">Cliente (opcional)</span>
            {cliente ? (
              <span className="chip">
                <UserRound size={16} aria-hidden="true" /> {cliente.nombre} · {cliente.correo}
                <button type="button" onClick={() => setCliente(null)} aria-label="Quitar cliente" disabled={enviando}>
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            ) : (
              <div className="pos-buscar-cliente">
                <input type="search" value={textoCliente} onChange={(e) => setTextoCliente(e.target.value)} placeholder="Nombre o correo del cliente registrado" aria-label="Buscar cliente registrado" disabled={enviando} />
                {textoCliente.trim().length >= 2 && (
                  <ul className="sugerencias sugerencias-clientes">
                    {clientes.length === 0 ? (
                      <li className="sugerencia-vacia">No hay clientes registrados con “{textoCliente.trim()}”.</li>
                    ) : (
                      clientes.map((c) => (
                        <li key={c.id_cliente}>
                          <button
                            type="button"
                            className="sugerencia"
                            onClick={() => {
                              setCliente(c);
                              setTextoCliente('');
                              setClientes([]);
                            }}
                          >
                            <span className="sugerencia-nombre">{c.nombre}</span>
                            <span className="sugerencia-detalle">{c.correo}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
          <CampoFormulario id="nota" etiqueta="Nota (opcional)" valor={nota} alCambiar={(_c, v) => setNota(v)} maxLength={255} disabled={enviando} />

          <div className="pos-total">
            <span>Total</span>
            <strong>{formatearPrecio(total)}</strong>
          </div>
          {errorVenta && !confirmando && (
            <p className="alerta alerta-error" role="alert">
              {errorVenta}
            </p>
          )}
          <Boton icono={CircleCheck} onClick={() => setConfirmando(true)} disabled={ventaInvalida || enviando} className="boton-ancho">
            Confirmar venta
          </Boton>
          <p className="texto-secundario texto-pequeno">
            ¿Necesita ver o devolver una venta? Vaya a <Link to="/pos/ventas">Mis ventas</Link>.
          </p>
        </section>
      </div>

      <ModalAccion
        abierto={confirmando}
        titulo="¿Confirmar la venta?"
        mensaje={`${lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0)} artículo(s) por ${formatearPrecio(total)}${cliente ? `, a nombre de ${cliente.nombre}` : ''}. Al confirmar se descuenta el stock.`}
        textoConfirmar="Sí, confirmar venta"
        textoProcesando="Registrando venta..."
        icono={CircleCheck}
        procesando={enviando}
        error={errorVenta}
        alConfirmar={confirmarVenta}
        alCancelar={() => setConfirmando(false)}
      >
        <ul className="lista-simple">
          {lineas.map((l) => (
            <li key={l.producto.id_producto}>
              {l.cantidad} × {l.producto.nombre} = {formatearPrecio(l.cantidad * l.producto.precio)}
            </li>
          ))}
        </ul>
      </ModalAccion>

      <Modal abierto={comprobante !== null} alCerrar={() => setComprobante(null)} idTitulo="titulo-comprobante" className="modal-confirmacion">
        {comprobante && (
          <>
            <div className="modal-icono modal-icono-exito" aria-hidden="true">
              <CircleCheck size={28} />
            </div>
            <h2 id="titulo-comprobante">Venta #{comprobante.id_venta} registrada</h2>
            <p>
              Total: <strong>{formatearPrecio(comprobante.total)}</strong>
              {comprobante.nombre_cliente ? ` · Cliente: ${comprobante.nombre_cliente}` : ''}
            </p>
            <div className="modal-acciones">
              <Boton onClick={() => setComprobante(null)}>Nueva venta</Boton>
            </div>
          </>
        )}
      </Modal>
    </PaginaAnimada>
  );
}
