// Auditoría: quién hizo qué, cuándo y desde qué IP (logins, MFA, cuentas,
// roles, ventas, devoluciones, configuración). Nunca guarda contraseñas ni códigos.
import { useState } from 'react';
import { X } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import TablaDatos from '../../components/TablaDatos.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import Boton from '../../components/Boton.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { listarAuditoria } from '../../services/reportesService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { NOMBRES_ROLES } from '../../context/contextoAutenticacion.js';
import { formatearFechaHora } from '../../utils/formato.js';

const VACIO = { accion: '', desde: '', hasta: '' };

export default function AuditoriaPage() {
  const [filtros, setFiltros] = useState(VACIO);
  const { datos, cargando, error, recargar } = useDatos(() => listarAuditoria(filtros), [filtros.accion, filtros.desde, filtros.hasta]);
  const cambiar = (campo, valor) => setFiltros({ ...filtros, [campo]: valor });

  const columnas = [
    { clave: 'creado_en', titulo: 'Fecha', mostrar: (a) => formatearFechaHora(a.creado_en) },
    { clave: 'correo', titulo: 'Cuenta', mostrar: (a) => (a.correo ? `${a.correo} (${NOMBRES_ROLES[a.rol]})` : 'Sin cuenta') },
    { clave: 'accion', titulo: 'Acción', mostrar: (a) => <code>{a.accion}</code> },
    { clave: 'detalle', titulo: 'Detalle' },
    { clave: 'ip', titulo: 'IP' }
  ];

  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Administración', 'Auditoría']} descripcion="Registro de las acciones sensibles. Se muestran las 300 más recientes que cumplen los filtros." />
      <section className="tarjeta">
        <div className="filtros-fecha">
          <CampoFormulario
            id="accion"
            etiqueta="Acción"
            tipo="select"
            valor={filtros.accion}
            alCambiar={cambiar}
            textoOpcionVacia="Todas"
            opciones={(datos?.acciones ?? []).map((a) => ({ valor: a, texto: a }))}
          />
          <CampoFormulario id="desde" etiqueta="Desde" tipo="date" valor={filtros.desde} alCambiar={cambiar} />
          <CampoFormulario id="hasta" etiqueta="Hasta" tipo="date" valor={filtros.hasta} alCambiar={cambiar} />
          {JSON.stringify(filtros) !== JSON.stringify(VACIO) && (
            <Boton variante="fantasma" icono={X} onClick={() => setFiltros(VACIO)}>
              Quitar filtros
            </Boton>
          )}
        </div>
        {cargando && !datos ? (
          <Cargando />
        ) : error ? (
          <ErrorCarga error={error} alReintentar={recargar} />
        ) : datos.registros.length === 0 ? (
          <SinRegistros texto="No hay registros con esos filtros." />
        ) : (
          <TablaDatos columnas={columnas} filas={datos.registros} llave="id_auditoria" />
        )}
      </section>
    </PaginaAnimada>
  );
}
