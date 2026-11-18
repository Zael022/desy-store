// Campo para escribir un código de 6 dígitos (MFA y verificaciones).
// Solo acepta números; en el celular abre el teclado numérico.
export default function CampoCodigo({ id = 'codigo', valor, alCambiar, etiqueta = 'Código de 6 dígitos', disabled = false, autoFocus = false }) {
  return (
    <div className="campo campo-codigo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        name={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value.replace(/\D/g, '').slice(0, 6))}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-describedby={`${id}-ayuda`}
        placeholder="••••••"
      />
      <small id={`${id}-ayuda`} className="campo-ayuda">
        No comparta este código con nadie. La tienda nunca se lo pedirá por teléfono.
      </small>
    </div>
  );
}
