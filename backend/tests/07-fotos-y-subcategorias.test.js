// Pruebas de los productos reales de Desy, las fotos y las subcategorías.
import './entorno.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { app, prepararBase, cerrar, pool, Navegador, sesionDe } from './ayudante.js';
import request from 'supertest';
import { configuracion } from '../src/config/env.js';
import { sembrar } from '../database/seed.js';

let admin; // navegador con sesión de administración

before(async () => {
  await fs.rm(configuracion.fotos.carpeta, { recursive: true, force: true });
  await prepararBase();
  admin = (await sesionDe('administrador')).navegador;
});
after(cerrar);

// Imagen de prueba hecha con sharp (no hace falta ningún archivo).
function imagen({ ancho = 400, alto = 500, formato = 'png', conGps = false } = {}) {
  let tuberia = sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 120, g: 180, b: 90 } } });
  if (conGps) tuberia = tuberia.withExif({ IFD0: { Artist: 'Celular de prueba' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '9/1 58/1 0/1' } });
  return tuberia.toFormat(formato).toBuffer();
}

// Sube una foto como lo hace el navegador (multipart/form-data, campo "foto").
async function subir(navegador, idProducto, contenido, nombre = 'foto.png', tipo = 'image/png') {
  if (!navegador.csrf) await navegador.obtenerCsrf();
  return navegador.agente
    .post(`/api/productos/${idProducto}/fotos`)
    .set('X-CSRF-Token', navegador.csrf)
    .attach('foto', contenido, { filename: nombre, contentType: tipo });
}

async function idDe(codigo) {
  const [filas] = await pool.execute('SELECT id_producto FROM productos WHERE codigo = ?', [codigo]);
  return filas[0].id_producto;
}

const existe = (archivo) => fs.access(path.join(configuracion.fotos.carpeta, archivo)).then(() => true, () => false);

test('Seed: carga los 12 productos de Desy con fotos, subcategorías y stock por movimientos', async () => {
  const catalogo = await request(app).get('/api/catalogo');
  const desy = catalogo.body.filter((p) => /^(COL-1|CRO-|LLA-1)/.test(p.codigo));
  assert.equal(desy.length, 12);
  assert.ok(desy.every((p) => p.foto_principal), 'todos tienen foto principal');

  const conejo = desy.find((p) => p.codigo === 'CRO-PEL-001');
  assert.equal(conejo.foto_principal, 'cro-pel-001-1.webp');
  assert.equal(conejo.nombre_categoria, 'Peluches');
  assert.equal(conejo.nombre_categoria_padre, 'Crochet');
  assert.equal(conejo.disponibilidad, 'pocas');
  assert.ok(!('stock' in conejo), 'el catálogo nunca muestra el stock exacto');

  const detalle = await request(app).get(`/api/catalogo/${conejo.id_producto}`);
  assert.deepEqual(detalle.body.fotos, ['cro-pel-001-1.webp', 'cro-pel-001-2.webp']);
  assert.deepEqual(detalle.body.fotos_medidas, ['cro-pel-001-2.webp']);

  // Las fotos con medidas nunca son la principal (Batman y la flor tenían la de medidas como 1.ª en el ZIP).
  assert.equal(desy.find((p) => p.codigo === 'CRO-PEL-003').foto_principal, 'cro-pel-003-2.webp');
  assert.equal(desy.find((p) => p.codigo === 'CRO-DEC-001').foto_principal, 'cro-dec-001-2.webp');
  const [medidas] = await pool.query('SELECT archivo FROM producto_fotos WHERE es_de_medidas = 1');
  assert.equal(medidas.length, 9);
  const archivosMedidas = new Set(medidas.map((m) => m.archivo));
  assert.ok(catalogo.body.every((p) => !archivosMedidas.has(p.foto_principal)), 'ninguna tarjeta usa una foto con medidas');
  const batman = await request(app).get(`/api/catalogo/${desy.find((p) => p.codigo === 'CRO-PEL-003').id_producto}`);
  assert.deepEqual(batman.body.fotos, ['cro-pel-003-2.webp', 'cro-pel-003-1.webp']);

  // El stock inicial entró como un movimiento de entrada, no escrito a mano.
  const [movs] = await pool.execute("SELECT tipo, cantidad FROM movimientos WHERE id_producto = ? AND motivo LIKE 'Inventario inicial%'", [conejo.id_producto]);
  assert.deepEqual(movs, [{ tipo: 'entrada', cantidad: 3 }]);

  const [fotos] = await pool.query('SELECT archivo FROM producto_fotos');
  assert.equal(fotos.length, 29);
  for (const { archivo } of fotos) assert.ok(await existe(archivo), `falta el archivo ${archivo}`);

  const filtros = await request(app).get('/api/catalogo/filtros');
  const crochet = filtros.body.categorias.find((c) => c.nombre === 'Crochet');
  const hijas = filtros.body.categorias.filter((c) => c.id_categoria_padre === crochet.id_categoria).map((c) => c.nombre).sort();
  assert.deepEqual(hijas, ['Decoración', 'Llaveros de crochet', 'Peluches']);
});

test('Seed otra vez: no duplica productos, fotos ni movimientos; repone fotos que falten en la carpeta', async () => {
  const contar = async () => {
    const [[p]] = await pool.query('SELECT COUNT(*) AS n FROM productos');
    const [[f]] = await pool.query('SELECT COUNT(*) AS n FROM producto_fotos');
    const [[m]] = await pool.query('SELECT COUNT(*) AS n FROM movimientos');
    return [p.n, f.n, m.n];
  };
  const antes = await contar();
  await fs.unlink(path.join(configuracion.fotos.carpeta, 'lla-102-1.webp'));
  await sembrar({ silencioso: true });
  assert.deepEqual(await contar(), antes);
  assert.ok(await existe('lla-102-1.webp'), 'la foto que faltaba se volvió a copiar');
});

test('GET /api/fotos: sirve la imagen y rechaza nombres raros o inexistentes', async () => {
  const bien = await request(app).get('/api/fotos/cro-pel-001-1.webp');
  assert.equal(bien.status, 200);
  assert.match(bien.headers['content-type'], /image\/webp/);
  assert.match(bien.headers['cache-control'], /public/);
  for (const malo of ['..%2F..%2F.env', '..%2Fseed.js', 'CRO.webp', 'foto.png', 'no-existe.webp', '.webp']) {
    assert.equal((await request(app).get(`/api/fotos/${malo}`)).status, 404, malo);
  }
});

test('Subir foto: se convierte a WebP, se quitan los datos GPS y queda al final', async () => {
  const id = await idDe('ARE-001');
  const r = await subir(admin, id, await imagen({ formato: 'jpeg', conGps: true }), 'celular.jpg', 'image/jpeg');
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.length, 1);
  const { archivo } = r.body[0];
  assert.match(archivo, /^[a-f0-9]{32}\.webp$/, 'el nombre lo inventa el servidor');
  const guardada = await sharp(path.join(configuracion.fotos.carpeta, archivo)).metadata();
  assert.equal(guardada.format, 'webp');
  assert.equal(guardada.exif, undefined, 'sin EXIF ni GPS');

  const producto = await admin.get(`/api/productos/${id}`);
  assert.equal(producto.body.foto_principal, archivo);
  assert.equal(producto.body.total_fotos, 1);
  const [[auditoria]] = await pool.query("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'foto_agregada'");
  assert.equal(auditoria.n, 1);
});

test('Subir foto: rechaza archivos que no son imagen, muy pequeños, muy pesados o sin foto', async () => {
  const id = await idDe('ARE-002');
  const texto = await subir(admin, id, Buffer.from('<script>alert(1)</script>'), 'virus.png', 'image/png');
  assert.equal(texto.status, 400);
  const chica = await subir(admin, id, await imagen({ ancho: 50, alto: 50 }));
  assert.equal(chica.status, 400);
  assert.match(chica.body.message, /pequeña/);
  const gif = await subir(admin, id, await imagen({ formato: 'gif' }), 'animada.gif', 'image/gif');
  assert.equal(gif.status, 400);
  const pesada = await subir(admin, id, Buffer.alloc(5 * 1024 * 1024 + 10, 1), 'enorme.png');
  assert.equal(pesada.status, 413);
  if (!admin.csrf) await admin.obtenerCsrf();
  const sinFoto = await admin.agente.post(`/api/productos/${id}/fotos`).set('X-CSRF-Token', admin.csrf).field('otro', 'x');
  assert.equal(sinFoto.status, 400);
  const otroCampo = await admin.agente.post(`/api/productos/${id}/fotos`).set('X-CSRF-Token', admin.csrf).attach('archivo', await imagen(), 'x.png');
  assert.equal(otroCampo.status, 400);
  const [[n]] = await pool.execute('SELECT COUNT(*) AS n FROM producto_fotos WHERE id_producto = ?', [id]);
  assert.equal(n.n, 0, 'no se guardó nada');
  assert.equal((await subir(admin, 999999, await imagen())).status, 404);
});

test('Subir foto: máximo 8 por producto', async () => {
  const id = await idDe('ARE-002');
  for (let i = 0; i < 8; i++) assert.equal((await subir(admin, id, await imagen())).status, 201);
  const novena = await subir(admin, id, await imagen());
  assert.equal(novena.status, 409);
  assert.match(novena.body.message, /máximo 8/);
});

test('Foto principal y borrar: cambia el orden, borra el archivo y no toca fotos de otro producto', async () => {
  const id = await idDe('LLA-101'); // llaveros corazón: 4 fotos normales
  const fotos = (await admin.get(`/api/productos/${id}/fotos`)).body;
  assert.deepEqual(fotos.map((f) => f.orden), [1, 2, 3, 4]);
  const tercera = fotos[2];

  const principal = await admin.patch(`/api/productos/${id}/fotos/${tercera.id_foto}/principal`);
  assert.equal(principal.status, 200);
  assert.equal(principal.body[0].id_foto, tercera.id_foto);
  const catalogo = await request(app).get(`/api/catalogo/${id}`);
  assert.equal(catalogo.body.foto_principal, tercera.archivo);

  // Una foto de otro producto no se puede borrar desde este (404).
  const otro = await idDe('CRO-PEL-003');
  assert.equal((await admin.delete(`/api/productos/${otro}/fotos/${tercera.id_foto}`)).status, 404);

  const borrar = await admin.delete(`/api/productos/${id}/fotos/${tercera.id_foto}`);
  assert.equal(borrar.status, 200);
  assert.deepEqual(borrar.body.map((f) => f.orden), [1, 2, 3]);
  assert.equal(await existe(tercera.archivo), false, 'el archivo se borró del disco');
  assert.equal((await request(app).get(`/api/fotos/${tercera.archivo}`)).status, 404);
});

test('Fotos con medidas: nunca son la principal y siempre van al final', async () => {
  const id = await idDe('CRO-PEL-004'); // Snoopy: 2 normales + 1 con medidas
  const al = async () => (await admin.get(`/api/productos/${id}/fotos`)).body;
  const alFinal = (lista) => {
    const primeraMedida = lista.findIndex((f) => f.es_de_medidas);
    return primeraMedida === -1 || lista.slice(primeraMedida).every((f) => f.es_de_medidas);
  };
  let fotos = await al();
  assert.deepEqual(fotos.map((f) => [f.archivo, f.es_de_medidas]), [['cro-pel-004-1.webp', false], ['cro-pel-004-2.webp', false], ['cro-pel-004-3.webp', true]]);

  // Una foto con medidas no puede ser la principal.
  const conMedidas = fotos[2];
  const principal = await admin.patch(`/api/productos/${id}/fotos/${conMedidas.id_foto}/principal`);
  assert.equal(principal.status, 409);
  assert.match(principal.body.message, /medidas/);

  // Marcar la principal como "medidas": se va al final y la siguiente pasa a ser la principal.
  const marcar = await admin.patch(`/api/productos/${id}/fotos/${fotos[0].id_foto}/medidas`, { es_de_medidas: true });
  assert.equal(marcar.status, 200);
  assert.deepEqual(marcar.body.map((f) => f.archivo), ['cro-pel-004-2.webp', 'cro-pel-004-1.webp', 'cro-pel-004-3.webp']);
  assert.ok(alFinal(marcar.body));
  assert.deepEqual(marcar.body.map((f) => f.orden), [1, 2, 3]);
  assert.equal((await request(app).get(`/api/catalogo/${id}`)).body.foto_principal, 'cro-pel-004-2.webp');

  // Subir una foto marcada con medidas (campo del formulario) y otra normal: la normal queda antes.
  if (!admin.csrf) await admin.obtenerCsrf();
  const subidaMedidas = await admin.agente.post(`/api/productos/${id}/fotos`).set('X-CSRF-Token', admin.csrf).field('es_de_medidas', 'true').attach('foto', await imagen(), 'medidas.png');
  assert.equal(subidaMedidas.status, 201);
  assert.equal(subidaMedidas.body.at(-1).es_de_medidas, true);
  const normal = await subir(admin, id, await imagen());
  assert.equal(normal.status, 201);
  fotos = normal.body;
  assert.ok(alFinal(fotos), JSON.stringify(fotos));
  assert.equal(fotos.filter((f) => !f.es_de_medidas).length, 2);

  // Quitar la marca: vuelve al grupo de las normales.
  const desmarcar = await admin.patch(`/api/productos/${id}/fotos/${conMedidas.id_foto}/medidas`, { es_de_medidas: false });
  assert.equal(desmarcar.status, 200);
  assert.equal(desmarcar.body.find((f) => f.id_foto === conMedidas.id_foto).es_de_medidas, false);
  assert.ok(alFinal(desmarcar.body));

  // Datos inválidos y foto de otro producto.
  assert.equal((await admin.patch(`/api/productos/${id}/fotos/${conMedidas.id_foto}/medidas`, { es_de_medidas: 'quizás' })).status, 400);
  assert.equal((await admin.patch(`/api/productos/${id}/fotos/${conMedidas.id_foto}/medidas`, {})).status, 400);
  assert.equal((await admin.patch(`/api/productos/${await idDe('LLA-102')}/fotos/${conMedidas.id_foto}/medidas`, { es_de_medidas: true })).status, 404);
  const { navegador: ventas } = await sesionDe('ventas');
  assert.equal((await ventas.patch(`/api/productos/${id}/fotos/${conMedidas.id_foto}/medidas`, { es_de_medidas: true })).status, 403);

  // Un producto que solo tiene fotos con medidas no muestra foto en la tarjeta.
  const nuevo = await admin.post('/api/productos', { codigo: 'ZZ-MEDIDAS', nombre: 'Solo medidas', precio: 1000, id_categoria: 1, id_proveedor: 1, id_material: 1 });
  await admin.agente.post(`/api/productos/${nuevo.body.id_producto}/fotos`).set('X-CSRF-Token', admin.csrf).field('es_de_medidas', 'true').attach('foto', await imagen(), 'm.png');
  const soloMedidas = await admin.get(`/api/productos/${nuevo.body.id_producto}`);
  assert.equal(soloMedidas.body.total_fotos, 1);
  assert.equal(soloMedidas.body.foto_principal, null);
});

test('Fotos: ventas, cliente y proveedor no pueden subir ni borrar (403); sin sesión 401; sin CSRF 403', async () => {
  const id = await idDe('LLA-101');
  for (const rol of ['ventas', 'cliente', 'proveedor']) {
    const { navegador } = await sesionDe(rol);
    assert.equal((await subir(navegador, id, await imagen())).status, 403, rol);
    assert.equal((await navegador.get(`/api/productos/${id}/fotos`)).status, 403, rol);
  }
  const anonimo = new Navegador();
  assert.equal((await subir(anonimo, id, await imagen())).status, 401);
  const sinCsrf = await admin.agente.post(`/api/productos/${id}/fotos`).attach('foto', await imagen(), 'x.png');
  assert.equal(sinCsrf.status, 403);
  const { navegador: duena } = await sesionDe('duena');
  assert.equal((await subir(duena, id, await imagen())).status, 201, 'la dueña sí puede');
});

test('Borrar un producto sin movimientos borra también sus fotos (base y disco)', async () => {
  const nuevo = await admin.post('/api/productos', { codigo: 'ZZ-FOTO', nombre: 'Producto con fotos', precio: 1000, id_categoria: 1, id_proveedor: 1, id_material: 1 });
  assert.equal(nuevo.status, 201);
  const subida = await subir(admin, nuevo.body.id_producto, await imagen());
  const { archivo } = subida.body[0];
  assert.equal((await admin.delete(`/api/productos/${nuevo.body.id_producto}`)).status, 200);
  assert.equal(await existe(archivo), false);
  const [[n]] = await pool.execute('SELECT COUNT(*) AS n FROM producto_fotos WHERE archivo = ?', [archivo]);
  assert.equal(n.n, 0);
});

test('Subcategorías: solo dos niveles, sin ciclos, y no se borra una categoría con subcategorías', async () => {
  const lista = (await admin.get('/api/categorias')).body;
  const crochet = lista.find((c) => c.nombre === 'Crochet');
  const peluches = lista.find((c) => c.nombre === 'Peluches');
  assert.equal(peluches.id_categoria_padre, crochet.id_categoria);
  assert.equal(peluches.nombre_padre, 'Crochet');
  assert.equal(crochet.total_subcategorias, 3);

  const nueva = await admin.post('/api/categorias', { nombre: 'Bolsos tejidos', id_categoria_padre: crochet.id_categoria });
  assert.equal(nueva.status, 201);
  assert.equal(nueva.body.nombre_padre, 'Crochet');

  // Dentro de una subcategoría -> 400 (solo dos niveles).
  assert.equal((await admin.post('/api/categorias', { nombre: 'Nieta', id_categoria_padre: peluches.id_categoria })).status, 400);
  // Dentro de sí misma -> 400.
  assert.equal((await admin.put(`/api/categorias/${crochet.id_categoria}`, { nombre: 'Crochet', id_categoria_padre: crochet.id_categoria })).status, 400);
  // Una categoría con subcategorías no puede quedar dentro de otra -> 400.
  assert.equal((await admin.put(`/api/categorias/${crochet.id_categoria}`, { nombre: 'Crochet', id_categoria_padre: 1 })).status, 400);
  // Padre que no existe -> 400.
  assert.equal((await admin.post('/api/categorias', { nombre: 'Huérfana', id_categoria_padre: 999999 })).status, 400);

  // Editar sin enviar id_categoria_padre conserva la categoría principal.
  const editada = await admin.put(`/api/categorias/${nueva.body.id_categoria}`, { nombre: 'Bolsos de crochet' });
  assert.equal(editada.body.id_categoria_padre, crochet.id_categoria);
  // Enviar null la vuelve principal.
  const principal = await admin.put(`/api/categorias/${nueva.body.id_categoria}`, { nombre: 'Bolsos de crochet', id_categoria_padre: null });
  assert.equal(principal.body.id_categoria_padre, null);

  const borrar = await admin.delete(`/api/categorias/${crochet.id_categoria}`);
  assert.equal(borrar.status, 409);
  assert.match(borrar.body.message, /subcategoría/);
});
