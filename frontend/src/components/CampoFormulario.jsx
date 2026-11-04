// Campo de formulario con su etiqueta (<label>).
// tipo puede ser: text, email, tel, number, date, textarea o select.
// Para "select" se pasan las opciones como [{ valor, texto }].
export default function CampoFormulario({
  id,
  etiqueta,
  tipo = 'text',
  valor,
  alCambiar,
  opciones = [],
  textoOpcionVacia = 'Seleccione una opción',
  obligatorio = false,
  ayuda,
  ...resto
}) {
  // Todos los campos avisan el cambio con (nombreDelCampo, nuevoValor).
  const manejarCambio = (evento) => alCambiar(id, evento.target.value);
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;

  let control;
  if (tipo === 'textarea') {
    control = <textarea id={id} name={id} value={valor} onChange={manejarCambio} rows={3} aria-describedby={idAyuda} {...resto} />;
  } else if (tipo === 'select') {
    control = (
      <select id={id} name={id} value={valor} onChange={manejarCambio} aria-describedby={idAyuda} {...resto}>
        <option value="">{textoOpcionVacia}</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    );
  } else {
    control = <input id={id} name={id} type={tipo} value={valor} onChange={manejarCambio} aria-describedby={idAyuda} {...resto} />;
  }

  return (
    <div className="campo">
      <label htmlFor={id}>
        {etiqueta}
        {obligatorio && <span className="marca-obligatorio" aria-hidden="true"> *</span>}
      </label>
      {control}
      {ayuda && (
        <small id={idAyuda} className="campo-ayuda">
          {ayuda}
        </small>
      )}
    </div>
  );
}
