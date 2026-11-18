// Genera docs/matriz-de-permisos.md a partir de src/config/permisos.js.
// Así la documentación nunca queda distinta de lo que el backend aplica.
// Uso: npm run matriz
import fs from 'node:fs/promises';
import { PERMISOS, ROLES, NOMBRES_ROLES } from '../src/config/permisos.js';

const marca = (regla, rol) => {
  if (regla.acceso === 'publico') return 'Público';
  if (regla.acceso === 'desafio') return 'Desafío MFA';
  return regla.acceso.includes(rol) ? 'Sí' : '—';
};

const lineas = [
  '# Matriz de permisos',
  '',
  'Generada automáticamente con `npm run matriz` desde `backend/src/config/permisos.js`, que es la MISMA lista que usa el middleware `autorizar` en cada petición.',
  '',
  '- **Sí**: el rol puede usar la ruta. **—**: el backend responde **403** (con sesión) o **401** (sin sesión).',
  '- **Público**: no necesita sesión (igual pasa por los límites de peticiones y, si cambia datos, por CSRF).',
  '- **Desafío MFA**: solo con la cookie temporal que se obtiene al pasar la contraseña (5 minutos). No da acceso a nada más.',
  '- Una ruta que no esté aquí responde **404** aunque exista código para ella.',
  '- Además de esta tabla hay reglas por dato: un proveedor solo ve lo suyo, un cliente solo sus compras, el rol ventas solo sus ventas, y el costo unitario solo lo ve la dueña (ver la columna "Restricción").',
  '',
  `| Método | Ruta | ${ROLES.map((r) => NOMBRES_ROLES[r]).join(' | ')} | Descripción | Restricción |`,
  `|---|---|${ROLES.map(() => ':-:').join('|')}|---|---|`
];
for (const regla of PERMISOS) {
  lineas.push(`| ${regla.metodo} | \`${regla.ruta}\` | ${ROLES.map((r) => marca(regla, r)).join(' | ')} | ${regla.descripcion} | ${regla.restriccion ?? ''} |`);
}
lineas.push('', `Total: ${PERMISOS.length} rutas.`, '');

const destino = new URL('../../docs/matriz-de-permisos.md', import.meta.url);
await fs.writeFile(destino, lineas.join('\n'), 'utf8');
console.log(`Matriz escrita en docs/matriz-de-permisos.md (${PERMISOS.length} rutas).`);
