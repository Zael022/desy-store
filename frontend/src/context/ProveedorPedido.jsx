// Guarda el pedido en armado y lo comparte con todas las páginas.
// Cada línea: { id_producto, cantidad, nombre, codigo, precio, foto_principal, nombre_categoria }.
// El precio y la disponibilidad se vuelven a revisar en la página "Mi pedido" y,
// sobre todo, en el backend al enviarlo: lo guardado aquí es solo una ayuda.
import { useEffect, useMemo, useState } from 'react';
import { ContextoPedido, MAXIMO_PRODUCTOS, MAXIMO_UNIDADES } from './contextoPedido.js';

const LLAVE = 'desy_pedido';

function leer() {
  try {
    const guardado = JSON.parse(localStorage.getItem(LLAVE) ?? '[]');
    return Array.isArray(guardado) ? guardado.filter((l) => Number.isInteger(l?.id_producto) && Number.isInteger(l?.cantidad)) : [];
  } catch {
    return []; // navegador sin almacenamiento o dato dañado: se empieza vacío
  }
}

const limitar = (cantidad) => Math.min(Math.max(Math.trunc(cantidad) || 1, 1), MAXIMO_UNIDADES);

export default function ProveedorPedido({ children }) {
  const [lineas, setLineas] = useState(leer);

  useEffect(() => {
    try {
      localStorage.setItem(LLAVE, JSON.stringify(lineas));
    } catch {
      // sin almacenamiento: el pedido vive solo mientras la página esté abierta
    }
  }, [lineas]);

  const valor = useMemo(() => {
    // Devuelve false si no se pudo agregar (ya hay 20 productos distintos).
    function agregar(producto, cantidad = 1) {
      const existe = lineas.some((l) => l.id_producto === producto.id_producto);
      if (!existe && lineas.length >= MAXIMO_PRODUCTOS) return false;
      setLineas((actuales) => {
        if (actuales.some((l) => l.id_producto === producto.id_producto)) {
          return actuales.map((l) => (l.id_producto === producto.id_producto ? { ...l, cantidad: limitar(l.cantidad + cantidad) } : l));
        }
        const { id_producto, nombre, codigo, precio, foto_principal = null, nombre_categoria = '' } = producto;
        return [...actuales, { id_producto, nombre, codigo, precio: Number(precio), foto_principal, nombre_categoria, cantidad: limitar(cantidad) }];
      });
      return true;
    }
    const cambiar = (idProducto, cantidad) => setLineas((actuales) => actuales.map((l) => (l.id_producto === idProducto ? { ...l, cantidad: limitar(cantidad) } : l)));
    const quitar = (idProducto) => setLineas((actuales) => actuales.filter((l) => l.id_producto !== idProducto));
    const vaciar = () => setLineas([]);
    // Actualiza precio, nombre y foto con los datos del catálogo (por si cambiaron).
    const refrescar = (catalogo) =>
      setLineas((actuales) =>
        actuales.map((l) => {
          const p = catalogo.find((c) => c.id_producto === l.id_producto);
          return p ? { ...l, nombre: p.nombre, codigo: p.codigo, precio: Number(p.precio), foto_principal: p.foto_principal ?? null, nombre_categoria: p.nombre_categoria } : l;
        })
      );
    const unidades = lineas.reduce((suma, l) => suma + l.cantidad, 0);
    const total = lineas.reduce((suma, l) => suma + l.cantidad * l.precio, 0);
    return { lineas, unidades, total, agregar, cambiar, quitar, vaciar, refrescar };
  }, [lineas]);

  return <ContextoPedido.Provider value={valor}>{children}</ContextoPedido.Provider>;
}
