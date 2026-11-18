// Pantalla 6: Portal del cliente, con dos pestañas:
//   - Mis pedidos (/cliente/pedidos): pedidos en curso con su plazo e historial.
//   - Mis compras (/cliente): compras hechas en la tienda.
// Solo ve lo suyo: el backend toma el cliente de la sesión.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Eye, Receipt, ShieldCheck, ShoppingBag, Store, X } from 'lucide-react';
import Pestanas from '../../components/Pestanas.jsx';
import MisPedidos from './MisPedidos.jsx';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import TablaDatos from '../../components/TablaDatos.jsx';
import Modal from '../../components/Modal.jsx';
import Boton from '../../components/Boton.jsx';
import DetalleVenta from '../../components/DetalleVenta.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { listarMisCompras, obtenerMiCompra } from '../../services/ventasService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { useAutenticacion } from '../../hooks/useAutenticacion.js';
import { formatearFechaHora, formatearPrecio } from '../../utils/formato.js';

export default function ClientePortalPage() {
  const { usuario } = useAutenticacion();
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const pestana = pathname === '/cliente/pedidos' ? 'pedidos' : 'compras';
  return (
    <PaginaAnimada>
      <EncabezadoPagina
        ruta={['Mi cuenta', pestana === 'pedidos' ? 'Mis pedidos' : 'Mis compras']}
        descripcion={`Hola, ${usuario.nombre}. Aquí están sus pedidos y las compras que hizo en la tienda con su cuenta.`}
      />
      <div className="accesos-portal">
        <Link to="/catalogo" className="tarjeta acceso-portal">
          <Store size={26} aria-hidden="true" />
          <span><strong>Catálogo</strong><small>Elija productos y haga su pedido</small></span>
        </Link>
        <Link to="/perfil" className="tarjeta acceso-portal">
          <ShieldCheck size={26} aria-hidden="true" />
          <span><strong>Perfil y seguridad</strong><small>Datos, correo, teléfono y contraseña</small></span>
        </Link>
      </div>
      <Pestanas
        etiqueta="Pedidos y compras"
        valor={pestana}
        alCambiar={(v) => navegar(v === 'pedidos' ? '/cliente/pedidos' : '/cliente')}
        opciones={[
          { valor: 'pedidos', texto: 'Mis pedidos', icono: ShoppingBag },
          { valor: 'compras', texto: 'Mis compras', icono: Receipt }
        ]}
      />
      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`pestana-${pestana}`} className="panel-pestana">
        {pestana === 'pedidos' ? <MisPedidos /> : <MisCompras />}
      </div>
    </PaginaAnimada>
  );
}

function MisCompras() {
  const { datos: compras, cargando, error, recargar } = useDatos(listarMisCompras);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(null);
  const [errorDetalle, setErrorDetalle] = useState('');

  async function verDetalle(compra) {
    setCargandoDetalle(compra.id_venta);
    setErrorDetalle('');
    try {
      setDetalle(await obtenerMiCompra(compra.id_venta));
    } catch (err) {
      setErrorDetalle(err.message);
    } finally {
      setCargandoDetalle(null);
    }
  }

  const columnas = [
    { clave: 'id_venta', titulo: 'Compra', mostrar: (c) => `#${c.id_venta}` },
    { clave: 'fecha', titulo: 'Fecha', mostrar: (c) => formatearFechaHora(c.fecha) },
    { clave: 'unidades', titulo: 'Artículos' },
    { clave: 'total', titulo: 'Total', mostrar: (c) => <strong>{formatearPrecio(c.total)}</strong> },
    { clave: 'total_devuelto', titulo: 'Devuelto', mostrar: (c) => (c.total_devuelto > 0 ? formatearPrecio(c.total_devuelto) : '—') }
  ];

  return (
    <>
      <section className="tarjeta" aria-labelledby="titulo-compras">
        <h2 id="titulo-compras">
          <Receipt size={20} aria-hidden="true" /> Historial de compras
        </h2>
        {errorDetalle && <p className="alerta alerta-error" role="alert">{errorDetalle}</p>}
        {cargando ? (
          <Cargando />
        ) : error ? (
          <ErrorCarga error={error} alReintentar={recargar} />
        ) : compras.length === 0 ? (
          <SinRegistros texto="Todavía no hay compras asociadas a su cuenta. Cuando recoja un pedido o compre en la tienda con su correo, aparecerá aquí." />
        ) : (
          <TablaDatos
            columnas={columnas}
            filas={compras}
            llave="id_venta"
            acciones={(c) => (
              <Boton variante="fantasma" icono={Eye} onClick={() => verDetalle(c)} cargando={cargandoDetalle === c.id_venta} aria-label={`Ver la compra #${c.id_venta}`}>
                Ver
              </Boton>
            )}
          />
        )}
      </section>

      <Modal abierto={detalle !== null} alCerrar={() => setDetalle(null)} idTitulo="titulo-detalle" className="modal-formulario">
        {detalle && (
          <div className="formulario">
            <h2 id="titulo-detalle">Compra #{detalle.id_venta}</h2>
            <p className="texto-secundario">
              {formatearFechaHora(detalle.fecha)} · Le atendió {detalle.nombre_vendedor}
            </p>
            <DetalleVenta venta={detalle} />
            {detalle.devoluciones.length > 0 && (
              <div>
                <h3>Devoluciones</h3>
                <ul className="lista-simple">
                  {detalle.devoluciones.map((d) => (
                    <li key={d.id_devolucion}>
                      {formatearFechaHora(d.fecha)} · {d.motivo} · {formatearPrecio(d.total)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="formulario-acciones">
              <Boton variante="secundario" icono={X} onClick={() => setDetalle(null)}>
                Cerrar
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
