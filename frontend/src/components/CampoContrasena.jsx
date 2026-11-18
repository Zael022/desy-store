// Campo de contraseña con botón para mostrarla u ocultarla.
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function CampoContrasena({ id, etiqueta, valor, alCambiar, autoComplete = 'current-password', ayuda, disabled = false, autoFocus = false }) {
  const [visible, setVisible] = useState(false);
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  return (
    <div className="campo">
      <label htmlFor={id}>
        {etiqueta}
        <span className="marca-obligatorio" aria-hidden="true"> *</span>
      </label>
      <div className="campo-contrasena">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          autoComplete={autoComplete}
          aria-describedby={idAyuda}
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={128}
          required
        />
        <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}>
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {ayuda && (
        <small id={idAyuda} className="campo-ayuda">
          {ayuda}
        </small>
      )}
    </div>
  );
}
