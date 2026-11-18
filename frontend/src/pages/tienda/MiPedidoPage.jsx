// "Mi pedido" (/pedido): el cliente revisa lo que eligió y lo envía a la tienda.
//   1. Ajusta cantidades (1 a 10 por producto) o quita productos.
//   2. Puede dejar una nota (por ejemplo, cuándo pasa a recogerlo).
//   3. Al enviar, el backend APARTA las unidades y el pedido queda "esperando confirmación".
//      La tienda lo confirma (o lo rechaza) y le avisa por correo. Se paga al recogerlo.
// Un visitante puede armar el pedido, pero para enviarlo debe iniciar sesión como cliente.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { LogIn, Minus, Plus, Send, ShoppingBag, Store, Trash2 } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import Boton from '../../components/Boton.jsx';
import FotoProducto from '../../components/FotoProducto.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import { InsigniaDisponibilidad } from '../../components/Insignias.jsx';
import { usePedido } from '../../hooks/usePedido.js';
import { useAutenticacion } from '../../hooks/useAutenticacion.js';
import { listarCatalogo } from '../../services/catalogoService.js';
import { crearPedido } from '../../services/pedidosService.js';
import { formatearPrecio } from '../../utils/formato.js';
import { MAXIMO_UNIDADES } from '../../context/contextoPedido.js';

export default function MiPedidoPage() {
  const { usuario } = useAutenticacion();
  const { lineas, unidades, total, cambiar, quitar, vaciar, refrescar } = usePedido();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [disponibilidad, setDisponibilidad] = useState({}); // id_producto -> "disponible" | "pocas" | "agotado"
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Clave del pedido: si se pierde la respuesta y se reintenta, el backend no lo duplica.
  const clave = useRef(crypto.randomUUID());

  // Precios y disponibilidad al día (pudieron cambiar desde que se agregó el producto).
  useEffect(() => {
    let activo = true;
    listarCatalogo()
      .then((catalogo) => {
        if (!activo) return;
        refrescar(catalogo);
        setDisponibilidad(Object.fromEntries(catalogo.map((p) => [p.id_producto, p.disponibilidad])));
      })
      .catch(() => {}); // si falla, el backend igual revisa todo al enviar
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir la página
  }, []);

  const esCliente = usuario?.rol === 'cliente';
  const agotados = lineas.filter((l) => disponibilidad[l.id_producto] === 'agotado');

  async function enviar() {
    setEnviando(true);
    setError('');
    try {
      const pedido = await crearPedido({
        clave_idempotencia: clave.current,
        nota: nota.trim() || null,
        items: lineas.map(({ id_producto, cantidad }) => ({ id_producto, cantidad }))
      });
      vaciar();
      toast.success(pedido.message);
      navegar('/cliente/pedidos', { state: { pedidoNuevo: pedido.id_pedido } });
    } catch (err) {
      setError(err.message);
      // 409 = algo ya no está disponible: nueva clave para el siguiente intento ya corregido.
      if (err.status === 409) clave.current = crypto.randomUUID();
    } finally {
      setEnviando(false);
    }
  }

  if (lineas.length === 0) {
    return (
      <PaginaAnimada>
        <EncabezadoPagina ruta={['Tienda', 'Mi pedido']} descripcion="Elija productos en el catálogo y envíe su pedido: la tienda se los aparta." />
        <div className="tarjeta estado-vacio">
          <ShoppingBag size={44} aria-hidden="true" />
          <p>Su pedido está vacío.</p>
          <Link to="/catalogo" className="boton boton-primario">
            <Store size={18} aria-hidden="true" /> Ir al catálogo
          </Link>
          {esCliente && (
            <p className="texto-secundario">
              Vea el estado de sus pedidos enviados en <Link to="/cliente/pedidos">Mis pedidos</Link>.
            </p>
          )}
        </div>
      </PaginaAnimada>
    );
  }

  return (
    <PaginaAnimada>
      <EncabezadoPagina
        ruta={['Tienda', 'Mi pedido']}
        descripcion="Al enviarlo, la tienda le aparta estas unidades y le confirma por correo. Usted lo recoge y lo paga en la tienda."
      />
      <div className="pedido-pagina">
        <section className="tarjeta" aria-labelledby="titulo-lineas">
          <h2 id="titulo-lineas">
            <ShoppingBag size={20} aria-hidden="true" /> {unidades} artículo(s)
          </h2>
          <ul className="pedido-lineas">
            {lineas.map((l) => (
              <li key={l.id_producto} className="pedido-linea">
                <span className="pedido-foto" aria-hidden="true">
                  <FotoProducto archivo={l.foto_principal} alt="" nombreCategoria={l.nombre_categoria} tamanoIcono={26} />
                </span>
                <div className="pedido-linea-texto">
                  <Link to={`/catalogo/${l.id_producto}`} className="pedido-linea-nombre">
                    {l.nombre}
                  </Link>
                  <small>
                    {l.codigo} · {formatearPrecio(l.precio)} c/u
                  </small>
                  {disponibilidad[l.id_producto] && disponibilidad[l.id_producto] !== 'disponible' && <InsigniaDisponibilidad valor={disponibilidad[l.id_producto]} />}
                </div>
                <div className="contador-pedido" role="group" aria-label={`Cantidad de ${l.nombre}`}>
                  <button type="button" onClick={() => cambiar(l.id_producto, l.cantidad - 1)} disabled={l.cantidad <= 1 || enviando} aria-label="Restar uno">
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <span>{l.cantidad}</span>
                  <button type="button" onClick={() => cambiar(l.id_producto, l.cantidad + 1)} disabled={l.cantidad >= MAXIMO_UNIDADES || enviando} aria-label="Sumar uno">
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
                <strong className="pedido-subtotal">{formatearPrecio(l.precio * l.cantidad)}</strong>
                <Boton variante="circulo" className="boton-eliminar" icono={Trash2} onClick={() => quitar(l.id_producto)} disabled={enviando} aria-label={`Quitar ${l.nombre}`} title="Quitar" />
              </li>
            ))}
          </ul>
        </section>

        <aside className="tarjeta pedido-resumen" aria-labelledby="titulo-resumen">
          <h2 id="titulo-resumen">Resumen</h2>
          <p className="pedido-total">
            <span>Total aproximado</span>
            <strong>{formatearPrecio(total)}</strong>
          </p>
          <p className="texto-secundario">Se paga al recogerlo. Si el precio cambia, se respeta el de su pedido.</p>
          <CampoFormulario
            id="nota"
            etiqueta="Nota para la tienda (opcional)"
            tipo="textarea"
            maxLength={255}
            valor={nota}
            alCambiar={(_, v) => setNota(v)}
            ayuda="Por ejemplo: qué día pasa a recogerlo o el color que prefiere."
            disabled={enviando}
          />
          <MensajeFormulario>{error}</MensajeFormulario>
          {agotados.length > 0 && (
            <p className="alerta alerta-advertencia" role="status">
              Ya no hay unidades de: {agotados.map((l) => l.nombre).join(', ')}. Quítelos para poder enviar.
            </p>
          )}
          {esCliente ? (
            <Boton icono={Send} onClick={enviar} cargando={enviando} disabled={agotados.length > 0}>
              {enviando ? 'Enviando...' : 'Enviar pedido'}
            </Boton>
          ) : usuario ? (
            <p className="texto-secundario">Solo las cuentas de cliente pueden hacer pedidos.</p>
          ) : (
            <>
              <Boton icono={LogIn} onClick={() => navegar('/login', { state: { desde: ubicacion.pathname, mensaje: 'Inicie sesión para enviar su pedido.' } })}>
                Iniciar sesión para enviar
              </Boton>
              <p className="texto-secundario">
                ¿No tiene cuenta? <Link to="/registro">Cree una cuenta de cliente</Link>; su pedido se queda guardado aquí.
              </p>
            </>
          )}
          <Link to="/catalogo" className="enlace-secundario">
            Seguir viendo el catálogo
          </Link>
        </aside>
      </div>
    </PaginaAnimada>
  );
}
