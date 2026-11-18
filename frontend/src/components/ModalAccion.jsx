// Modal genérico para confirmar una acción (no solo eliminar): título, mensaje,
// contenido opcional (por ejemplo, un campo de comentario) y dos botones.
import { useRef } from 'react';
import { Check, X } from 'lucide-react';
import Modal from './Modal.jsx';
import Boton from './Boton.jsx';
import MensajeFormulario from './MensajeFormulario.jsx';

export default function ModalAccion({
  abierto,
  titulo,
  mensaje,
  children,
  textoConfirmar = 'Confirmar',
  textoProcesando = 'Guardando...',
  variante = 'primario',
  icono = Check,
  procesando = false,
  error = '',
  deshabilitarConfirmar = false,
  alConfirmar,
  alCancelar
}) {
  const refCancelar = useRef(null);
  return (
    <Modal abierto={abierto} alCerrar={alCancelar} bloqueado={procesando} idTitulo="accion-titulo" idDescripcion="accion-mensaje" refFocoInicial={refCancelar} className="modal-accion">
      <h2 id="accion-titulo">{titulo}</h2>
      {mensaje && <p id="accion-mensaje">{mensaje}</p>}
      {children}
      <MensajeFormulario>{error}</MensajeFormulario>
      <div className="modal-acciones">
        <Boton ref={refCancelar} variante="secundario" icono={X} onClick={alCancelar} disabled={procesando}>
          Cancelar
        </Boton>
        <Boton variante={variante} icono={icono} onClick={alConfirmar} cargando={procesando} disabled={deshabilitarConfirmar}>
          {procesando ? textoProcesando : textoConfirmar}
        </Boton>
      </div>
    </Modal>
  );
}
