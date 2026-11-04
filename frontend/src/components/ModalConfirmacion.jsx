// Modal para confirmar antes de eliminar (en lugar de window.confirm).
// Usa el componente Modal, que ya maneja Escape, clic afuera y el foco del teclado.
// Al abrirse, el foco queda en "Cancelar" (la opción segura).
import { useRef } from 'react';
import { TriangleAlert, Trash2, X } from 'lucide-react';
import Modal from './Modal.jsx';
import Boton from './Boton.jsx';

export default function ModalConfirmacion({
  abierto,
  titulo = '¿Desea eliminar este registro?',
  mensaje,
  textoConfirmar = 'Sí, eliminar',
  procesando = false,
  alConfirmar,
  alCancelar
}) {
  const refCancelar = useRef(null);

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCancelar}
      bloqueado={procesando}
      rol="alertdialog"
      idTitulo="modal-titulo"
      idDescripcion="modal-mensaje"
      refFocoInicial={refCancelar}
      className="modal-confirmacion"
    >
      <div className="modal-icono" aria-hidden="true">
        <TriangleAlert size={28} />
      </div>
      <h2 id="modal-titulo">{titulo}</h2>
      <p id="modal-mensaje">{mensaje}</p>
      <div className="modal-acciones">
        <Boton ref={refCancelar} variante="secundario" icono={X} onClick={alCancelar} disabled={procesando}>
          Cancelar
        </Boton>
        <Boton variante="peligro" icono={Trash2} onClick={alConfirmar} cargando={procesando}>
          {procesando ? 'Eliminando...' : textoConfirmar}
        </Boton>
      </div>
    </Modal>
  );
}
