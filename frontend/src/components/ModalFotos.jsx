// Ventana para administrar las fotos de un producto (administración y dueña).
//   - Subir una o varias fotos (JPG, PNG o WebP, hasta 5 MB cada una, máximo 8 por producto).
//     Antes de elegirlas se puede marcar "Son fotos con medidas".
//   - Elegir la foto principal (la que se ve en el catálogo).
//   - Marcar o quitar la marca de "medidas" (botón con la regla en cada foto).
//   - Borrar una foto (pide confirmar).
// Regla de Desy: una foto con medidas NUNCA es la principal. El backend la deja siempre
// al final y no la usa en las tarjetas; aquí solo se muestra así y se esconde la estrella.
// El backend revisa cada foto de nuevo y la convierte a WebP sin datos ocultos (como el GPS):
// lo que se revisa aquí es solo para avisar antes y no esperar en vano.
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, ImagePlus, Ruler, Star, Trash2, X } from 'lucide-react';
import Modal from './Modal.jsx';
import Boton from './Boton.jsx';
import MensajeFormulario from './MensajeFormulario.jsx';
import { Cargando } from './EstadoLista.jsx';
import { urlFoto } from '../services/api.js';
import { eliminarFoto, hacerFotoPrincipal, listarFotos, marcarFotoMedidas, subirFoto } from '../services/productosService.js';
import { fotoPrincipalDe } from '../utils/fotos.js';

const MAXIMO_FOTOS = 8;
const TAMANO_MAXIMO = 5 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

export default function ModalFotos({ producto, alCerrar, alCambiar }) {
  const [ocupado, setOcupado] = useState(false);
  const refCerrar = useRef(null);
  // Se recuerda el último producto para que el contenido no desaparezca durante la animación de cierre.
  const [mostrado, setMostrado] = useState(producto);
  if (producto !== null && producto !== mostrado) setMostrado(producto);
  return (
    <Modal abierto={producto !== null} alCerrar={alCerrar} bloqueado={ocupado} idTitulo="fotos-titulo" idDescripcion="fotos-ayuda" refFocoInicial={refCerrar} className="modal-fotos">
      {/* "key": cada producto empieza con su propio estado (sin fotos del anterior). */}
      {mostrado && (
        <ContenidoFotos key={mostrado.id_producto} producto={mostrado} alCerrar={alCerrar} alCambiar={alCambiar} ocupado={ocupado} setOcupado={setOcupado} refCerrar={refCerrar} />
      )}
    </Modal>
  );
}

function ContenidoFotos({ producto, alCerrar, alCambiar, ocupado, setOcupado, refCerrar }) {
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [progreso, setProgreso] = useState('');
  const [error, setError] = useState('');
  const [porBorrar, setPorBorrar] = useState(null); // id_foto que espera confirmación
  const [subirComoMedidas, setSubirComoMedidas] = useState(false);
  const refArchivo = useRef(null);

  const idProducto = producto.id_producto;
  useEffect(() => {
    let activo = true;
    listarFotos(idProducto)
      .then((lista) => activo && setFotos(lista))
      .catch((e) => activo && setError(e.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [idProducto]);

  function actualizar(lista) {
    setFotos(lista);
    alCambiar?.(lista);
  }

  async function subirSeleccion(evento) {
    const archivos = [...evento.target.files];
    evento.target.value = ''; // permite volver a elegir el mismo archivo
    if (archivos.length === 0) return;
    const espacio = MAXIMO_FOTOS - fotos.length;
    const problemas = [];
    const validos = archivos.filter((archivo) => {
      if (!TIPOS.includes(archivo.type)) problemas.push(`"${archivo.name}" no es JPG, PNG ni WebP.`);
      else if (archivo.size > TAMANO_MAXIMO) problemas.push(`"${archivo.name}" pesa más de 5 MB.`);
      else return true;
      return false;
    });
    if (validos.length > espacio) problemas.push(`Solo caben ${espacio} foto(s) más (máximo ${MAXIMO_FOTOS} por producto).`);
    const aSubir = validos.slice(0, Math.max(espacio, 0));

    setOcupado(true);
    setError('');
    let lista = fotos;
    let subidas = 0;
    for (const [i, archivo] of aSubir.entries()) {
      setProgreso(`Subiendo ${i + 1} de ${aSubir.length}...`);
      try {
        lista = await subirFoto(idProducto, archivo, subirComoMedidas);
        subidas++;
      } catch (e) {
        problemas.push(`"${archivo.name}": ${e.message}`);
        if (e.status === 401 || e.status === 403 || e.esDeConexion) break;
      }
    }
    actualizar(lista);
    setProgreso('');
    setOcupado(false);
    if (subidas > 0) {
      const texto = subidas === 1 ? 'Foto agregada' : `${subidas} fotos agregadas`;
      toast.success(subirComoMedidas ? `${texto} como fotos con medidas (al final).` : `${texto}.`);
    }
    if (problemas.length > 0) setError(problemas.join(' '));
  }

  // Ejecuta una acción sobre una foto y actualiza la lista con lo que devuelve el backend.
  async function accion(promesa, mensaje) {
    setOcupado(true);
    setError('');
    try {
      actualizar(await promesa());
      toast.success(mensaje);
    } catch (e) {
      setError(e.message);
    } finally {
      setPorBorrar(null);
      setOcupado(false);
    }
  }

  const principal = (foto) => accion(() => hacerFotoPrincipal(idProducto, foto.id_foto), 'Foto principal actualizada.');
  const medidas = (foto) =>
    accion(
      () => marcarFotoMedidas(idProducto, foto.id_foto, !foto.es_de_medidas),
      foto.es_de_medidas ? 'Se quitó la marca de medidas.' : 'Marcada como foto con medidas: queda al final y nunca será la principal.'
    );
  const borrar = (foto) => accion(() => eliminarFoto(idProducto, foto.id_foto), 'Foto eliminada.');

  const lleno = fotos.length >= MAXIMO_FOTOS;
  const archivoPrincipal = fotoPrincipalDe(fotos);

  return (
    <>
      <div className="fotos-encabezado">
        <div>
          <h2 id="fotos-titulo">Fotos de {producto.nombre}</h2>
          <p id="fotos-ayuda" className="texto-secundario">
            La primera es la foto principal del catálogo. Las fotos con medidas nunca son la principal: van siempre al final. JPG, PNG o WebP de hasta 5 MB; máximo {MAXIMO_FOTOS} fotos.
          </p>
        </div>
        <Boton ref={refCerrar} variante="circulo" icono={X} onClick={alCerrar} disabled={ocupado} aria-label="Cerrar" title="Cerrar" />
      </div>

      <MensajeFormulario>{error}</MensajeFormulario>

      {cargando ? (
        <Cargando texto="Cargando fotos..." />
      ) : (
        <ul className="fotos-lista">
          {fotos.map((foto, indice) => {
            const numero = indice + 1;
            const esPrincipal = foto.archivo === archivoPrincipal;
            return (
              <li key={foto.id_foto} className={`foto-item${esPrincipal ? ' es-principal' : ''}${foto.es_de_medidas ? ' es-medidas' : ''}`}>
                <img src={urlFoto(foto.archivo)} alt={`Foto ${numero} de ${producto.nombre}${foto.es_de_medidas ? ' (con medidas)' : ''}`} width="160" height="200" loading="lazy" />
                {esPrincipal && (
                  <span className="foto-insignia">
                    <Star size={14} aria-hidden="true" /> Principal
                  </span>
                )}
                {foto.es_de_medidas && (
                  <span className="foto-insignia insignia-medidas">
                    <Ruler size={14} aria-hidden="true" /> Medidas
                  </span>
                )}
                <div className="foto-acciones">
                  {porBorrar === foto.id_foto ? (
                    <>
                      <span className="foto-pregunta">¿Borrar?</span>
                      <Boton variante="peligro" icono={Check} onClick={() => borrar(foto)} cargando={ocupado} aria-label={`Sí, borrar la foto ${numero}`}>
                        Sí
                      </Boton>
                      <Boton variante="secundario" icono={X} onClick={() => setPorBorrar(null)} disabled={ocupado} aria-label="No borrar">
                        No
                      </Boton>
                    </>
                  ) : (
                    <>
                      {!esPrincipal && !foto.es_de_medidas && (
                        <Boton variante="secundario" icono={Star} onClick={() => principal(foto)} disabled={ocupado} aria-label={`Hacer principal la foto ${numero}`} title="Hacer principal" />
                      )}
                      <Boton
                        variante="secundario"
                        className={foto.es_de_medidas ? 'boton-medidas activo' : 'boton-medidas'}
                        icono={Ruler}
                        onClick={() => medidas(foto)}
                        disabled={ocupado}
                        aria-pressed={foto.es_de_medidas}
                        aria-label={foto.es_de_medidas ? `Quitar la marca de medidas a la foto ${numero}` : `Marcar la foto ${numero} como foto con medidas`}
                        title={foto.es_de_medidas ? 'Quitar marca de medidas' : 'Es una foto con medidas'}
                      />
                      <Boton variante="secundario" className="boton-eliminar" icono={Trash2} onClick={() => setPorBorrar(foto.id_foto)} disabled={ocupado} aria-label={`Borrar la foto ${numero}`} title="Borrar" />
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {!lleno && (
            <li>
              <button type="button" className="foto-agregar" onClick={() => refArchivo.current?.click()} disabled={ocupado}>
                <ImagePlus size={30} aria-hidden="true" />
                <span>{progreso || (subirComoMedidas ? 'Agregar fotos con medidas' : 'Agregar fotos')}</span>
              </button>
            </li>
          )}
        </ul>
      )}
      {fotos.length === 0 && !cargando && <p className="texto-secundario">Este producto todavía no tiene fotos; en el catálogo se ve un ícono.</p>}
      {fotos.length > 0 && !archivoPrincipal && !cargando && (
        <p className="texto-secundario">Todas las fotos tienen medidas, así que en el catálogo se ve un ícono. Agregue una foto normal para que sea la principal.</p>
      )}

      {!lleno && !cargando && (
        <label className="casilla-medidas">
          <input type="checkbox" checked={subirComoMedidas} onChange={(e) => setSubirComoMedidas(e.target.checked)} disabled={ocupado} />
          <span>Las fotos que voy a agregar tienen medidas</span>
        </label>
      )}

      <input ref={refArchivo} type="file" accept={TIPOS.join(',')} multiple hidden onChange={subirSeleccion} tabIndex={-1} aria-hidden="true" />
      <p className="texto-secundario" role="status" aria-live="polite">
        {progreso}
      </p>
    </>
  );
}
