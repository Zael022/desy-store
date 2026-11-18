// "Mis pedidos" del cliente: en curso arriba (con su plazo) e historial abajo.
// Puede cancelar un pedido que todavía no recogió (las unidades se liberan).
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import toast from 'react-hot-toast';
import { ShoppingBag, XCircle } from 'lucide-react';
import TarjetaPedido from '../../components/TarjetaPedido.jsx';
import Boton from '../../components/Boton.jsx';
import ModalAccion from '../../components/ModalAccion.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { cancelarMiPedido, listarMisPedidos } from '../../services/pedidosService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { usePedido } from '../../hooks/usePedido.js';

export default function MisPedidos() {
  const { datos: pedidos, cargando, error, recargar, setDatos } = useDatos(listarMisPedidos);
  const { unidades } = usePedido();
  const ubicacion = useLocation();
  const [porCancelar, setPorCancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState('');

  async function cancelar() {
    setCancelando(true);
    setErrorCancelar('');
    try {
      const actualizado = await cancelarMiPedido(porCancelar.id_pedido);
      setDatos(pedidos.map((p) => (p.id_pedido === actualizado.id_pedido ? actualizado : p)));
      toast.success(actualizado.message);
      setPorCancelar(null);
    } catch (err) {
      setErrorCancelar(err.message);
    } finally {
      setCancelando(false);
    }
  }

  if (cargando) return <Cargando texto="Cargando sus pedidos..." />;
  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;

  const enCurso = pedidos.filter((p) => p.activo);
  const historial = pedidos.filter((p) => !p.activo);

  return (
    <div className="lista-pedidos-cliente">
      {unidades > 0 && (
        <p className="alerta alerta-info">
          Tiene {unidades} artículo(s) sin enviar. <Link to="/pedido">Revise y envíe su pedido</Link>.
        </p>
      )}
      <section aria-labelledby="titulo-en-curso">
        <h2 id="titulo-en-curso">
          <ShoppingBag size={20} aria-hidden="true" /> Pedidos en curso
        </h2>
        {enCurso.length === 0 ? (
          <SinRegistros texto="No tiene pedidos en curso. Elija productos en el catálogo y envíe su pedido: la tienda se los aparta." />
        ) : (
          <div className="grilla-pedidos">
            {enCurso.map((p) => (
              <TarjetaPedido
                key={p.id_pedido}
                pedido={p}
                destacado={ubicacion.state?.pedidoNuevo === p.id_pedido}
                acciones={
                  <Boton variante="secundario" className="boton-eliminar" icono={XCircle} onClick={() => setPorCancelar(p)}>
                    Cancelar pedido
                  </Boton>
                }
              />
            ))}
          </div>
        )}
      </section>
      {historial.length > 0 && (
        <section aria-labelledby="titulo-historial-pedidos">
          <h2 id="titulo-historial-pedidos">Historial de pedidos</h2>
          <div className="grilla-pedidos">
            {historial.map((p) => (
              <TarjetaPedido key={p.id_pedido} pedido={p} />
            ))}
          </div>
        </section>
      )}

      <ModalAccion
        abierto={porCancelar !== null}
        titulo={`¿Cancelar el pedido #${porCancelar?.id_pedido}?`}
        mensaje="Las unidades dejarán de estar apartadas y otra persona las podrá comprar. Esto no se puede deshacer."
        textoConfirmar="Sí, cancelar"
        textoProcesando="Cancelando..."
        variante="peligro"
        icono={XCircle}
        procesando={cancelando}
        error={errorCancelar}
        alConfirmar={cancelar}
        alCancelar={() => {
          setPorCancelar(null);
          setErrorCancelar('');
        }}
      />
    </div>
  );
}
