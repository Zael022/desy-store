// Tabla reutilizable con botones de Editar y Eliminar en cada fila.
// columnas: [{ clave, titulo, mostrar?(fila) }]
//   - "clave" es el nombre del campo a mostrar.
//   - "mostrar" (opcional) permite dar formato, por ejemplo un precio.
// Acciones de cada fila:
//   - alEditar / alEliminar: botones de lápiz y basurero (si se pasan).
//   - acciones(fila): botones propios (por ejemplo "Ver detalle").
//   - puedeModificar(fila): si devuelve false, esa fila no muestra lápiz ni basurero.
// Las filas aparecen con una animación escalonada (una detrás de otra).
import { AnimatePresence, motion } from 'motion/react';
import { Pencil, Trash2 } from 'lucide-react';
import Boton from './Boton.jsx';

export default function TablaDatos({
  columnas,
  filas,
  llave,
  alEditar,
  alEliminar,
  acciones,
  puedeModificar = () => true,
  ocupado = false,
  idEditando,
  nombreFila = (fila) => String(fila[llave])
}) {
  const conAcciones = Boolean(alEditar || alEliminar || acciones);

  return (
    <div className="tabla-contenedor">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.clave} scope="col">
                {columna.titulo}
              </th>
            ))}
            {conAcciones && (
              <th scope="col" className="columna-acciones">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={true}>
            {filas.map((fila, indice) => (
              <motion.tr
                key={fila[llave]}
                layout="position"
                className={fila[llave] === idEditando ? 'fila-editando' : ''}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0, transition: { delay: Math.min(indice * 0.04, 0.4) } }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
              >
                {columnas.map((columna) => (
                  <td key={columna.clave} data-titulo={columna.titulo}>
                    {columna.mostrar ? columna.mostrar(fila) : (fila[columna.clave] ?? '—')}
                  </td>
                ))}
                {conAcciones && (
                  <td className="columna-acciones">
                    <div className="acciones-fila">
                      {acciones?.(fila)}
                      {alEditar && puedeModificar(fila) && (
                        <Boton
                          variante="fantasma"
                          icono={Pencil}
                          onClick={() => alEditar(fila)}
                          disabled={ocupado}
                          aria-label={`Editar ${nombreFila(fila)}`}
                          title="Editar"
                        />
                      )}
                      {alEliminar && puedeModificar(fila) && (
                        <Boton
                          variante="fantasma"
                          className="boton-eliminar"
                          icono={Trash2}
                          onClick={() => alEliminar(fila)}
                          disabled={ocupado}
                          aria-label={`Eliminar ${nombreFila(fila)}`}
                          title="Eliminar"
                        />
                      )}
                    </div>
                  </td>
                )}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
