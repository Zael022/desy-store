// Bandeja de pedidos de clientes (ventas, administración y dueña).
//   - Pendientes: confirmar (queda "listo para recoger") o rechazar con un motivo.
//   - Listos para recoger: "Entregar y cobrar" registra la venta; o cancelar con motivo.
//   - Historial: entregados, rechazados, cancelados y vencidos.
// Al confirmar o rechazar, el backend le avisa al cliente por correo.
// Mientras un pedido está pendiente o listo, sus unidades están apartadas.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { CheckCircle2, ClipboardCheck, History, PackageCheck, RefreshCw, XCircle } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import Pestanas from '../../components/Pestanas.jsx';
import TarjetaPedido from '../../components/TarjetaPedido.jsx';
import Boton from '../../components/Boton.jsx';
import ModalAccion from '../../components/ModalAccion.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { confirmarPedido, entregarPedido, listarPedidos, rechazarPedido, resumenPedidos } from '../../services/pedidosService.js';
import { useAutenticacion } from '../../hooks/useAutenticacion.js';
import { formatearPrecio } from '../../utils/formato.js';

const FILTRO_DE_PESTANA = { pendientes: 'pendientes', listos: 'confirmados', historial: 'historial' };

const VACIOS = {
  pendientes: 'No hay pedidos esperando confirmación.',
  listos: 'No hay pedidos listos para recoger.',
  historial: 'Todavía no hay pedidos cerrados.'
};

export default function PedidosPage() {
  const { usuario } = useAutenticacion();
  const [pestana, setPestana] = useState('pendientes');
  const [estado, setEstado] = useState({ pedidos: [], cargando: true, error: null });
  const [resumen, setResumen] = useState({ pendientes: 0, confirmados: 0 });
  const [accion, setAccion] = useState(null); // { tipo: 'confirmar' | 'rechazar' | 'entregar', pedido }
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const cargar = useCallback(async (cual) => {
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const [pedidos, cuantos] = await Promise.all([listarPedidos(FILTRO_DE_PESTANA[cual]), resumenPedidos()]);
      setEstado({ pedidos, cargando: false, error: null });
      setResumen(cuantos);
    } catch (error) {
      setEstado({ pedidos: [], cargando: false, error });
    }
  }, []);

  useEffect(() => {
    cargar(pestana); // eslint-disable-line react-hooks/set-state-in-effect -- carga datos del servidor
  }, [pestana, cargar]);

  function abrir(tipo, pedido) {
    setAccion({ tipo, pedido });
    setMotivo('');
    setErrorAccion('');
  }

  async function ejecutar() {
    const { tipo, pedido } = accion;
    setProcesando(true);
    setErrorAccion('');
    try {
      const respuesta =
        tipo === 'confirmar' ? await confirmarPedido(pedido.id_pedido) : tipo === 'rechazar' ? await rechazarPedido(pedido.id_pedido, motivo) : await entregarPedido(pedido.id_pedido);
      toast.success(respuesta.message, { duration: 6000 });
      setAccion(null);
      await cargar(pestana);
    } catch (err) {
      setErrorAccion(err.message);
      if (err.status === 409) cargar(pestana); // el pedido cambió (por ejemplo, venció): se refresca la lista
    } finally {
      setProcesando(false);
    }
  }

  const rutaVentas = usuario.rol === 'ventas' ? '/pos/ventas' : '/admin/ventas';

  function botones(pedido) {
    if (pedido.estado === 'pendiente') {
      return (
        <>
          <Boton icono={CheckCircle2} onClick={() => abrir('confirmar', pedido)}>
            Confirmar
          </Boton>
          <Boton variante="secundario" className="boton-eliminar" icono={XCircle} onClick={() => abrir('rechazar', pedido)}>
            Rechazar
          </Boton>
        </>
      );
    }
    if (pedido.estado === 'confirmado') {
      return (
        <>
          <Boton icono={PackageCheck} onClick={() => abrir('entregar', pedido)}>
            Entregar y cobrar
          </Boton>
          <Boton variante="secundario" className="boton-eliminar" icono={XCircle} onClick={() => abrir('rechazar', pedido)}>
            Cancelar
          </Boton>
        </>
      );
    }
    if (pedido.estado === 'entregado' && pedido.id_venta) {
      return (
        <Link to={rutaVentas} className="enlace-secundario">
          Ver en ventas (venta #{pedido.id_venta})
        </Link>
      );
    }
    return null;
  }

  const textos = accion && {
    confirmar: {
      titulo: `¿Confirmar el pedido #${accion.pedido.id_pedido}?`,
      mensaje: `Quedará listo para recoger y se le avisará a ${accion.pedido.nombre_cliente} por correo. Las unidades siguen apartadas hasta que lo recoja.`,
      boton: 'Sí, confirmar',
      icono: CheckCircle2,
      variante: 'primario'
    },
    rechazar: {
      titulo: `¿${accion.pedido.estado === 'pendiente' ? 'Rechazar' : 'Cancelar'} el pedido #${accion.pedido.id_pedido}?`,
      mensaje: 'Las unidades dejarán de estar apartadas. El cliente recibirá el motivo por correo.',
      boton: accion.pedido.estado === 'pendiente' ? 'Rechazar pedido' : 'Cancelar pedido',
      icono: XCircle,
      variante: 'peligro'
    },
    entregar: {
      titulo: `¿Entregar el pedido #${accion.pedido.id_pedido}?`,
      mensaje: `Cobre ${formatearPrecio(accion.pedido.total)} a ${accion.pedido.nombre_cliente}. Se registrará la venta y se descontará el stock.`,
      boton: 'Entregado y cobrado',
      icono: PackageCheck,
      variante: 'primario'
    }
  }[accion.tipo];

  return (
    <PaginaAnimada>
      <EncabezadoPagina
        ruta={['Ventas', 'Pedidos de clientes']}
        descripcion="Confirme o rechace los pedidos de la tienda en línea. Al entregarlos se registra la venta. Mientras están en curso, sus unidades están apartadas."
      />
      <div className="barra-pedidos">
        <Pestanas
          etiqueta="Pedidos"
          valor={pestana}
          alCambiar={setPestana}
          opciones={[
            { valor: 'pendientes', texto: 'Por confirmar', icono: ClipboardCheck, contador: resumen.pendientes },
            { valor: 'listos', texto: 'Listos para recoger', icono: PackageCheck, contador: resumen.confirmados },
            { valor: 'historial', texto: 'Historial', icono: History }
          ]}
        />
        <Boton variante="fantasma" icono={RefreshCw} onClick={() => cargar(pestana)} disabled={estado.cargando}>
          Actualizar
        </Boton>
      </div>

      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`pestana-${pestana}`} className="panel-pestana">
        {estado.cargando ? (
          <Cargando texto="Cargando pedidos..." />
        ) : estado.error ? (
          <ErrorCarga error={estado.error} alReintentar={() => cargar(pestana)} />
        ) : estado.pedidos.length === 0 ? (
          <SinRegistros texto={VACIOS[pestana]} />
        ) : (
          <div className="grilla-pedidos">
            {estado.pedidos.map((p) => (
              <TarjetaPedido key={p.id_pedido} pedido={p} paraTienda acciones={botones(p)} />
            ))}
          </div>
        )}
      </div>

      <ModalAccion
        abierto={accion !== null}
        titulo={textos?.titulo}
        mensaje={textos?.mensaje}
        textoConfirmar={textos?.boton}
        textoProcesando="Guardando..."
        variante={textos?.variante}
        icono={textos?.icono}
        procesando={procesando}
        error={errorAccion}
        deshabilitarConfirmar={accion?.tipo === 'rechazar' && motivo.trim().length < 3}
        alConfirmar={ejecutar}
        alCancelar={() => setAccion(null)}
      >
        {accion?.tipo === 'rechazar' && (
          <CampoFormulario
            id="motivo"
            etiqueta="Motivo para el cliente"
            tipo="textarea"
            maxLength={255}
            obligatorio
            valor={motivo}
            alCambiar={(_, v) => setMotivo(v)}
            ayuda="Por ejemplo: «El producto se dañó» o «No pudimos contactarle». Se le envía por correo."
            disabled={procesando}
          />
        )}
      </ModalAccion>
    </PaginaAnimada>
  );
}
