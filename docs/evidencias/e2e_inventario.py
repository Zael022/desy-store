"""Registro de cómo se probó el inventario original en la versión 2 (ver docs/pruebas.md).
Uso: python3 e2e_inventario.py <contraseña del administrador Andrés>. Las rutas de LOG,
CARPETA_BACKEND y CAP son las del entorno de prueba; ajústelas si lo ejecuta en otro equipo.

(Versión 2: con sesión de administrador y MFA) Prueba de punta a punta en Chromium (Playwright) del frontend con diseño de tienda, contra el backend real y MySQL 8."""
import json
import re
import subprocess
import sys
import urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:5173'
API = BASE + '/api'
CAP = '/home/claude/e2e2/capturas'
CARPETA_BACKEND = '/home/claude/mini-proyecto-1/backend'
CORREO_ADMIN = 'andres.vargas@example.com'
CLAVE_ADMIN = sys.argv[1]
LOG = '/tmp/backend.log'
resultados = []
errores_consola = []


def ok(desc, cond, det=''):
    resultados.append((desc, bool(cond), det))
    print(('OK    ' if cond else 'FALLA ') + desc + ('' if cond else f'  ({det})'), flush=True)


def api(pg, metodo, ruta):
    # Usa las cookies de la sesión del navegador y el token CSRF.
    token = pg.request.get(API + '/auth/csrf').json()['csrfToken']
    r = pg.request.fetch(API + ruta, method=metodo, headers={'X-CSRF-Token': token})
    return r.json()


def login_admin(pg):
    pg.goto(BASE + '/login')
    pg.get_by_label('Correo').fill(CORREO_ADMIN)
    pg.get_by_label(re.compile(r'^Contraseña\s*\*?$')).fill(CLAVE_ADMIN)
    pg.get_by_role('button', name='Continuar').click()
    expect(pg.get_by_role('heading', name='Verificación en dos pasos')).to_be_visible()
    previos = open(LOG, encoding='utf-8').read().count(f'Correo para {CORREO_ADMIN}')
    pg.get_by_role('button', name='Enviar código').click()
    for _ in range(40):
        texto = open(LOG, encoding='utf-8').read()
        if texto.count(f'Correo para {CORREO_ADMIN}') > previos:
            break
        pg.wait_for_timeout(200)
    bloque = texto.split(f'Correo para {CORREO_ADMIN}')[-1]
    pg.get_by_label('Código de 6 dígitos').fill(re.search(r'\b(\d{6})\b', bloque).group(1))
    pg.get_by_role('button', name='Verificar y entrar').click()
    pg.wait_for_url('**/admin')


def esperar_toast(pg, patron, timeout=6000):
    loc = pg.locator('[role="status"]').filter(has_text=re.compile(patron))
    try:
        loc.first.wait_for(timeout=timeout)
        return loc.first.inner_text()
    except Exception:
        return None


def fila(pg, texto):
    return pg.locator('tbody tr').filter(has_text=texto)


def tarjeta(pg, texto):
    return pg.locator('article.tarjeta-producto').filter(has_text=texto)


def confirmar_modal(pg):
    pg.get_by_role('alertdialog').get_by_role('button', name=re.compile('Sí, eliminar')).click()


def eliminar_con_modal(pg, contenedor, nombre):
    """Abre el modal, prueba foco, Tab, Escape y Cancelar; luego confirma."""
    boton = contenedor.get_by_role('button', name=re.compile('^Eliminar'))
    boton.click()
    modal = pg.get_by_role('alertdialog')
    expect(modal).to_be_visible()
    foco = pg.evaluate('document.activeElement.textContent')
    ok(f'{nombre}: al abrir el modal el foco está en "Cancelar"', 'Cancelar' in foco, foco)
    pg.keyboard.press('Tab')
    pg.keyboard.press('Tab')
    ok(f'{nombre}: Tab no se sale del modal', pg.evaluate('document.querySelector("[role=alertdialog]").contains(document.activeElement)'))
    pg.keyboard.press('Escape')
    expect(modal).to_be_hidden()
    ok(f'{nombre}: Escape cierra el modal sin eliminar', contenedor.count() == 1)
    boton.click()
    pg.get_by_role('alertdialog').get_by_role('button', name='Cancelar').click()
    expect(pg.get_by_role('alertdialog')).to_be_hidden()
    ok(f'{nombre}: Cancelar cierra el modal sin eliminar', contenedor.count() == 1)
    boton.click()
    confirmar_modal(pg)
    t = esperar_toast(pg, 'eliminad')
    ok(f'{nombre}: confirmar elimina y muestra toast de éxito', t, t)
    expect(contenedor).to_have_count(0, timeout=5000)
    ok(f'{nombre}: desaparece de la lista sin recargar la página', contenedor.count() == 0)


def crud_simple(pg, nombre, ruta, campos, campo_editar, valor_editado, texto_nuevo, duplicado):
    pg.goto(BASE + ruta)
    pg.locator('tbody tr').first.wait_for()
    filas_antes = pg.locator('tbody tr').count()
    for campo, valor in campos.items():
        pg.fill(f'#{campo}', valor)
    pg.locator('form.formulario button[type=submit]').click()
    t = esperar_toast(pg, 'cread[oa]')
    ok(f'{nombre}: crear desde el formulario muestra toast de éxito', t, t)
    expect(fila(pg, texto_nuevo)).to_have_count(1, timeout=5000)
    ok(f'{nombre}: la fila nueva aparece sin recargar', pg.locator('tbody tr').count() == filas_antes + 1)
    ok(f'{nombre}: el formulario se limpia después de guardar', pg.input_value(f'#{list(campos)[0]}') == '')
    for campo, valor in duplicado.items():
        pg.fill(f'#{campo}', valor)
    pg.locator('form.formulario button[type=submit]').click()
    t = esperar_toast(pg, 'Ya existe')
    ok(f'{nombre}: duplicado muestra el error 409 del backend', t, t)
    ok(f'{nombre}: el error también se ve dentro del formulario', pg.locator('form.formulario .alerta-error').count() == 1)
    ok(f'{nombre}: el formulario conserva lo escrito tras el error', pg.input_value(f'#{list(duplicado)[0]}') == list(duplicado.values())[0])
    for campo in duplicado:
        pg.fill(f'#{campo}', '')
    primer = list(campos)[0]
    pg.fill(f'#{primer}', '   ')
    pg.locator('form.formulario button[type=submit]').click()
    t = esperar_toast(pg, 'obligatorio')
    ok(f'{nombre}: campo con solo espacios muestra el 400 del backend', t, t)
    pg.fill(f'#{primer}', '')
    fila(pg, texto_nuevo).get_by_role('button', name=re.compile('^Editar')).click()
    ok(f'{nombre}: Editar carga los datos en el formulario', pg.input_value(f'#{campo_editar}') == campos[campo_editar])
    pg.fill(f'#{campo_editar}', valor_editado)
    pg.locator('form.formulario button[type=submit]').click()
    t = esperar_toast(pg, 'actualizad[oa]')
    ok(f'{nombre}: editar muestra toast de éxito', t, t)
    expect(fila(pg, valor_editado)).to_have_count(1, timeout=5000)
    ok(f'{nombre}: la fila muestra el valor editado sin recargar', fila(pg, valor_editado).count() == 1)


with sync_playwright() as p:
    nav = p.chromium.launch()
    pg = nav.new_page(viewport={'width': 1440, 'height': 900})
    pg.on('console', lambda m: errores_consola.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and 'status of 4' not in m.text and 'ERR_CONNECTION_REFUSED' not in m.text and 'WebSocket' not in m.text else None)
    pg.on('pageerror', lambda e: errores_consola.append(f'pageerror: {e}'))

    login_admin(pg)
    ok('Inicio de sesión como administrador con MFA lleva a /admin', True)

    # ---------- Cabecera, menú lateral y pie ----------
    pg.goto(BASE + '/admin')
    pg.locator('.carrusel').wait_for()
    ok('Cabecera: muestra el logo de Desy (imagen cargada) y el rol', pg.evaluate('(() => { const i = document.querySelector(".cabecera .logo img"); return i.complete && i.naturalWidth > 0; })()') and pg.get_by_role('link', name='Desy, ir al inicio').count() == 1)
    ok('Ícono de la pestaña: la flor de Desy (favicon.png)', pg.evaluate('document.querySelector("link[rel=icon]").getAttribute("href")') == '/favicon.png' and urllib.request.urlopen(BASE + '/favicon.png').status == 200)
    ok('Pie de página: logo de Desy sobre fondo blanco', pg.locator('.pie-logo img').count() == 1)
    ok('Título de la pestaña: "Desy · Inventario"', pg.title().startswith('Desy'), pg.title())
    ok('Pie de página visible con accesos', pg.locator('footer.pie a').count() >= 7)
    pg.get_by_role('button', name='Abrir menú').click()
    menu = pg.get_by_role('dialog')
    expect(menu).to_be_visible()
    caja = pg.locator('.modal-lateral').bounding_box()
    ok('Menú ☰: se abre pegado a la izquierda', caja and caja['x'] < 5, str(caja))
    pg.keyboard.press('Escape')
    expect(menu).to_be_hidden()
    ok('Menú ☰: Escape lo cierra', True)
    pg.get_by_role('button', name='Abrir menú').click()
    pg.get_by_role('dialog').get_by_role('link', name='Categorías').click()
    pg.wait_for_url('**/admin/categorias')
    expect(pg.get_by_role('dialog')).to_have_count(0, timeout=3000)
    ok('Menú ☰: un enlace navega y cierra el menú', pg.get_by_role('dialog').count() == 0)

    # ---------- Inicio: carrusel, categorías, poco stock y gráfico ----------
    pg.goto(BASE + '/admin')
    pg.locator('.anuncio').wait_for()
    primero = pg.locator('.anuncio-titulo').inner_text()
    pg.get_by_role('button', name='Anuncio siguiente').click()
    pg.wait_for_timeout(900)
    segundo = pg.locator('.anuncio-titulo').inner_text()
    ok('Carrusel: la flecha cambia de anuncio', primero != segundo, f'{primero} -> {segundo}')
    ok('Carrusel: el anuncio usa datos reales (agotados)', 'agotado' in segundo.lower(), segundo)
    ok('Inicio: fila "Nuestras categorías" con las 7 categorías principales', pg.locator('.tarjeta-categoria').count() == 7)
    ok('Inicio: fila "Productos con poco stock" empieza por el agotado', 'Collar de conchas' in pg.locator('.fila-deslizable').filter(has_text='Productos con poco stock').locator('article').first.inner_text())
    pg.locator('.recharts-bar-rectangle').first.wait_for()
    pg.wait_for_timeout(1300)
    ok('Gráfico: 20 barras con stock (COL-002 tiene 0) y línea "Máximo: 67"', pg.locator('.recharts-bar-rectangle').count() == 20 and 'Máximo: 67' in pg.locator('.recharts-wrapper').text_content())
    pg.locator('.tarjeta-categoria').filter(has_text='Aretes').click()
    pg.wait_for_url('**/admin/productos?categoria=1')
    pg.locator('article.tarjeta-producto').first.wait_for()
    pg.wait_for_timeout(800)
    ok('Categoría desde Inicio: abre el catálogo filtrado (2 aretes)', pg.locator('article.tarjeta-producto').count() == 2 and '2 de 21' in pg.locator('#titulo-resultados').inner_text())

    # ---------- Catálogo: filtros, orden, búsqueda ----------
    pg.goto(BASE + '/admin/productos')
    pg.locator('article.tarjeta-producto').first.wait_for()
    ok('Catálogo: 21 tarjetas de producto con precio en colones', pg.locator('article.tarjeta-producto').count() == 21 and '₡' in pg.locator('.producto-precio').first.inner_text())
    ok('Catálogo: las secciones de filtros empiezan cerradas', pg.locator('.seccion-filtro-titulo[aria-expanded="true"]').count() == 0)
    pg.get_by_role('button', name=re.compile('^Categoría')).click()
    pg.get_by_role('checkbox', name=re.compile(r'^Collares \d')).check()
    pg.wait_for_timeout(500)
    ok('Filtro Categoría "Collares": quedan 3 productos', pg.locator('article.tarjeta-producto').count() == 3, str(pg.locator('article.tarjeta-producto').count()))
    pg.get_by_role('button', name=re.compile('^Disponibilidad')).click()
    pg.get_by_label('Agotados').check()
    pg.wait_for_timeout(500)
    ok('Filtro Disponibilidad "Agotados" + Collares: solo COL-002', pg.locator('article.tarjeta-producto').count() == 1 and 'COL-002' in pg.locator('article.tarjeta-producto').inner_text())
    pg.get_by_role('button', name=re.compile('^Precio')).click()
    pg.get_by_label('Desde (₡)').fill('7000')
    pg.wait_for_timeout(500)
    ok('Sin coincidencias: aparece el aviso amarillo', pg.locator('.alerta-sin-resultados').count() == 1 and 'No encontramos productos' in pg.locator('.alerta-sin-resultados').inner_text())
    pg.get_by_role('button', name=re.compile('Limpiar filtros')).click()
    pg.wait_for_timeout(500)
    ok('"Limpiar filtros" vuelve a mostrar los 21', pg.locator('article.tarjeta-producto').count() == 21)
    pg.select_option('#orden', 'precio-desc')
    pg.wait_for_timeout(500)
    ok('Ordenar por "Precio: mayor a menor": primero el más caro (₡15 000)', 'CRO-PEL-003' in pg.locator('article.tarjeta-producto').first.inner_text())
    pg.select_option('#orden', 'stock-desc')
    pg.wait_for_timeout(500)
    ok('Ordenar por "Stock: mayor a menor": primero PUL-002 (59)', 'PUL-002' in pg.locator('article.tarjeta-producto').first.inner_text())

    # Buscador con sugerencias
    pg.goto(BASE + '/admin/movimientos')
    pg.locator('tbody tr').first.wait_for()
    pg.fill('.buscador input', 'pul')
    pg.locator('#sugerencias-busqueda').wait_for()
    pg.wait_for_timeout(400)
    ok('Buscador: muestra 2 sugerencias para "pul"', pg.locator('#sugerencias-busqueda a.sugerencia').count() == 2)
    pg.keyboard.press('Enter')
    pg.wait_for_url('**/admin/productos?buscar=pul')
    pg.locator('article.tarjeta-producto').first.wait_for()
    ok('Enter abre "Resultados de búsqueda para: \'pul\'" con 2 encontrados', "Resultados de búsqueda para: 'pul'" in pg.locator('.migas').inner_text() and '2 producto(s) encontrado(s)' in pg.locator('.resultados-encontrados').inner_text())
    pg.get_by_role('button', name=re.compile('Quitar la búsqueda')).click()
    pg.wait_for_timeout(600)
    ok('Quitar la búsqueda vuelve al catálogo completo', pg.locator('article.tarjeta-producto').count() == 21)
    pg.fill('.buscador input', 'anillo')
    pg.locator('#sugerencias-busqueda a.sugerencia').first.click()
    pg.wait_for_url('**/admin/productos/7')
    pg.locator('.ficha-nombre').wait_for()
    ok('Clic en una sugerencia abre la ficha del producto', pg.locator('.ficha-nombre').inner_text() == 'Anillo ajustable minimalista')

    # ---------- Ficha de producto: registrar entrada y salida ----------
    pg.goto(BASE + '/admin/productos/5')
    pg.locator('.ficha-nombre').wait_for()
    ok('Ficha: migas Inicio > Productos > categoría > producto', pg.locator('.migas li').count() == 4 and 'Pulseras' in pg.locator('.migas').inner_text())
    ok('Ficha: "12 unidades disponibles en stock (máximo 67)" (14 menos 2 vendidas en el seed)', '12 unidades disponibles en stock (máximo 67)' in pg.locator('.ficha-disponible').inner_text())
    ok('Ficha: "Registrado por" es la persona de la sesión', 'Andrés Vargas' in pg.locator('.ficha-registra').inner_text())
    pg.get_by_role('button', name='Sumar uno').click()
    pg.get_by_role('button', name='Sumar uno').click()
    ok('Ficha: los botones + suben la cantidad a 3', pg.input_value('[aria-label="Cantidad de unidades"]') == '3')
    pg.get_by_role('button', name='Registrar entrada').click()
    t = esperar_toast(pg, 'Entrada de 3 registrada')
    ok('Ficha: "Registrar entrada" crea el movimiento (stock 15)', t and 'Stock: 15' in t, t)
    expect(pg.locator('.ficha-disponible')).to_contain_text('15 unidades', timeout=5000)
    ok('Ficha: el stock se actualiza sin recargar', True)
    pg.get_by_role('button', name='Sumar uno').click()
    pg.get_by_role('button', name='Sumar uno').click()
    pg.get_by_role('button', name='Registrar salida').click()
    t = esperar_toast(pg, 'Salida de 3 registrada')
    ok('Ficha: "Registrar salida" deja el stock en 12 otra vez', t and 'Stock: 12' in t, t)
    pg.get_by_role('tab', name=re.compile('Movimientos')).click()
    ok('Ficha: pestaña Movimientos muestra el historial (5, con la venta del seed)', pg.locator('#panel-movimientos tbody tr').count() == 5)
    ok('Ficha: "Productos similares" con tarjetas', pg.locator('.fila-deslizable article.tarjeta-producto').count() >= 1)
    pg.goto(BASE + '/admin/productos/6')
    pg.locator('.ficha-nombre').wait_for()
    pg.locator('[aria-label="Cantidad de unidades"]').fill('9')
    pg.get_by_role('button', name='Registrar entrada').click()
    t = esperar_toast(pg, 'supera el stock máximo de 67')
    ok('Ficha: entrada de 9 a PUL-002 (59) muestra el 409 "supera el stock máximo de 67"', t, t)
    ok('Ficha: el mensaje de error se ve también en la ficha', pg.locator('.ficha .alerta-error').count() == 1)
    pg.goto(BASE + '/admin/productos/99999')
    pg.wait_for_timeout(1200)
    ok('Ficha: un producto inexistente muestra "no existe"', pg.get_by_text('Este producto no existe').count() == 1)

    # ---------- Animaciones ----------
    pg.goto(BASE + '/admin/categorias')
    pg.wait_for_selector('.pagina', state='attached')
    o1 = float(pg.evaluate('getComputedStyle(document.querySelector(".pagina")).opacity'))
    pg.wait_for_timeout(900)
    o2 = float(pg.evaluate('getComputedStyle(document.querySelector(".pagina")).opacity'))
    ok('Animación de entrada de la página', o1 < 1 and o2 == 1, f'{o1} -> {o2}')
    pg.goto(BASE + '/admin/movimientos')
    pg.locator('tbody tr').first.wait_for()
    opacidades = pg.evaluate('[...document.querySelectorAll("tbody tr")].slice(-3).map(f => getComputedStyle(f).opacity)')
    ok('Animación escalonada de filas', any(float(o) < 1 for o in opacidades), str(opacidades))
    pg.goto(BASE + '/admin/productos')
    pg.locator('article.tarjeta-producto').first.wait_for()
    pg.wait_for_timeout(900)
    t0 = pg.evaluate('getComputedStyle(document.querySelector("article.tarjeta-producto")).transform')
    pg.locator('article.tarjeta-producto').first.hover()
    pg.wait_for_timeout(500)
    t1 = pg.evaluate('getComputedStyle(document.querySelector("article.tarjeta-producto")).transform')
    ok('Animación hover de la tarjeta de producto (se eleva)', t0 != t1, f'{t0} -> {t1}')
    b0 = pg.evaluate('getComputedStyle(document.querySelector(".catalogo-controles .boton")).transform')
    pg.locator('.catalogo-controles .boton').hover()
    pg.wait_for_timeout(400)
    b1 = pg.evaluate('getComputedStyle(document.querySelector(".catalogo-controles .boton")).transform')
    ok('Animación hover del botón', b0 != b1, f'{b0} -> {b1}')

    # ---------- CRUD de entidades con tabla ----------
    crud_simple(pg, 'Categorías', '/admin/categorias', {'nombre': 'ZZ Tobilleras', 'descripcion': 'Para el tobillo'}, 'nombre', 'ZZ Tobilleras de playa', 'ZZ Tobilleras', {'nombre': 'aretes'})
    crud_simple(pg, 'Proveedores', '/admin/proveedores', {'nombre': 'ZZ Proveedor Prueba', 'telefono': '2661-1234', 'correo': 'zz@example.com'}, 'telefono', '2661-5678', 'ZZ Proveedor Prueba', {'nombre': 'Distribuidora Encanto', 'telefono': '2661-0000'})
    crud_simple(pg, 'Materiales', '/admin/materiales', {'nombre': 'ZZ Cuarzo rosa'}, 'nombre', 'ZZ Cuarzo rosa natural', 'ZZ Cuarzo rosa', {'nombre': 'Resina'})
    crud_simple(pg, 'Empleados', '/admin/empleados', {'nombre': 'ZZ Karla Mora', 'puesto': 'Vendedora', 'correo': 'zz.karla@example.com'}, 'puesto', 'Cajera', 'ZZ Karla Mora', {'nombre': 'Otra', 'puesto': 'X', 'correo': 'mariana.solis@example.com'})
    pg.goto(BASE + '/admin/categorias')
    pg.locator('tbody tr').first.wait_for()
    fila(pg, 'Anillos').get_by_role('button', name=re.compile('^Eliminar')).click()
    confirmar_modal(pg)
    t = esperar_toast(pg, 'No se puede eliminar')
    ok('Categorías: eliminar una con productos muestra el 409', t, t)

    # ---------- Productos: CRUD en el modal ----------
    pg.goto(BASE + '/admin/productos')
    pg.locator('article.tarjeta-producto').first.wait_for()
    pg.get_by_role('button', name='Nuevo producto').click()
    formulario = pg.get_by_role('dialog')
    expect(formulario).to_be_visible()
    ok('Productos: "Nuevo producto" abre el formulario en un modal con foco en Código', pg.evaluate('document.activeElement.id') == 'codigo')
    ok('Productos: el formulario no tiene campo de stock', formulario.locator('#stock').count() == 0)
    ok('Productos: el aviso muestra el máximo de la API (67)', 'máximo 67' in formulario.locator('.alerta-info').inner_text())
    pg.fill('#codigo', 'zz-001')
    pg.fill('#nombre', 'ZZ Tobillera de conchas')
    pg.select_option('#id_categoria', label='ZZ Tobilleras de playa')
    pg.select_option('#id_material', label='ZZ Cuarzo rosa natural')
    pg.select_option('#id_proveedor', label='ZZ Proveedor Prueba')
    pg.get_by_role('button', name='Agregar producto').click()
    t = esperar_toast(pg, 'precio')
    ok('Productos: precio vacío muestra el 400 y el modal sigue abierto', t and formulario.is_visible(), t)
    ok('Productos: el modal conserva lo escrito', pg.input_value('#codigo') == 'zz-001')
    pg.fill('#precio', '6500')
    pg.get_by_role('button', name='Agregar producto').click()
    t = esperar_toast(pg, 'creado')
    # Después de crear, se abre la ventana de fotos del producto nuevo; se cierra con "Cerrar".
    fotos_abiertas = pg.get_by_role('dialog', name=re.compile('Fotos de ZZ Tobillera')).is_visible()
    pg.get_by_role('dialog').get_by_role('button', name='Cerrar').click()
    expect(pg.get_by_role('dialog')).to_have_count(0, timeout=3000)
    ok('Productos: crear muestra toast, cierra el formulario y ofrece agregar fotos', t and fotos_abiertas and pg.get_by_role('dialog').count() == 0, f'{t} {fotos_abiertas}')
    expect(tarjeta(pg, 'ZZ-001')).to_have_count(1, timeout=5000)
    ok('Productos: la tarjeta nueva aparece con código en mayúsculas y 0 / 67', '0 / 67' in tarjeta(pg, 'ZZ-001').inner_text())
    tarjeta(pg, 'ZZ-001').get_by_role('button', name=re.compile('^Editar')).click()
    ok('Productos: Editar abre el modal con los datos', pg.input_value('#codigo') == 'ZZ-001' and pg.locator('#id_categoria option:checked').inner_text() == 'ZZ Tobilleras de playa')
    pg.fill('#precio', '7000')
    pg.get_by_role('button', name='Guardar cambios').click()
    t = esperar_toast(pg, 'actualizado')
    ok('Productos: editar muestra toast', t, t)
    expect(tarjeta(pg, 'ZZ-001')).to_contain_text(re.compile(r'7\s000'), timeout=5000)
    ok('Productos: la tarjeta muestra el precio editado', True)
    pg.get_by_role('button', name='Nuevo producto').click()
    pg.keyboard.press('Escape')
    expect(pg.get_by_role('dialog')).to_be_hidden()
    ok('Productos: Escape cierra el modal del formulario', True)

    # ---------- Movimientos y reglas del stock ----------
    pg.goto(BASE + '/admin/movimientos')
    pg.locator('tbody tr').first.wait_for()
    opcion = pg.locator('#id_producto option').filter(has_text='ZZ-001').get_attribute('value')
    pg.select_option('#id_producto', opcion)
    ok('Movimientos: el panel muestra stock 0 y máximo 67', re.search(r'Stock actual\s+0\s+Máximo permitido\s+67', pg.locator('.panel-stock').inner_text()))
    pg.fill('#cantidad', '60')
    pg.fill('#motivo', 'ZZ compra')
    pg.locator('form.formulario button[type=submit]').click()
    t = esperar_toast(pg, 'Entrada registrada')
    ok('Movimientos: entrada de 60 (stock 60)', t and '60' in t, t)
    pg.select_option('#id_producto', opcion)
    pg.fill('#cantidad', '10')
    ok('Movimientos: la vista previa avisa que pasaría de 67', pg.locator('.alerta-advertencia').count() == 1)
    pg.locator('form.formulario button[type=submit]').click()
    t = esperar_toast(pg, 'supera el stock máximo de 67')
    ok('Movimientos: entrada 60+10 muestra el 409', t, t)
    pg.select_option('#tipo', 'salida')
    pg.fill('#cantidad', '61')
    pg.locator('form.formulario button[type=submit]').click()
    t = esperar_toast(pg, 'negativo')
    ok('Movimientos: salida que deja negativo muestra el 409', t, t)
    pg.fill('#cantidad', '15')
    pg.fill('#motivo', 'ZZ venta')
    pg.locator('form.formulario button[type=submit]').click()
    t = esperar_toast(pg, 'Salida registrada')
    ok('Movimientos: salida de 15 (stock 45)', t and '45' in t, t)
    fila(pg, 'ZZ venta').get_by_role('button', name=re.compile('^Editar')).click()
    pg.fill('#cantidad', '20')
    pg.locator('form.formulario button[type=submit]').click()
    t = esperar_toast(pg, 'actualizado')
    ok('Movimientos: editar salida 15 -> 20 deja 40', t and '40' in t, t)
    fila(pg, 'ZZ compra').get_by_role('button', name=re.compile('^Eliminar')).click()
    confirmar_modal(pg)
    t = esperar_toast(pg, 'No se puede eliminar esta entrada')
    ok('Movimientos: eliminar una entrada ya vendida muestra el 409', t, t)
    eliminar_con_modal(pg, fila(pg, 'ZZ venta'), 'Movimientos')
    pg.goto(BASE + '/admin/productos')
    pg.locator('article.tarjeta-producto').first.wait_for()
    ok('Movimientos: tras eliminar la salida el producto vuelve a 60 / 67', '60 / 67' in tarjeta(pg, 'ZZ-001').inner_text())
    tarjeta(pg, 'ZZ-001').get_by_role('button', name=re.compile('^Eliminar')).click()
    confirmar_modal(pg)
    t = esperar_toast(pg, 'movimiento')
    ok('Productos: eliminar un producto con movimientos muestra el 409', t, t)

    # ---------- Estados ----------
    pg.route('**/api/empleados', lambda r: (pg.wait_for_timeout(1500), r.continue_()))
    pg.goto(BASE + '/admin/empleados')
    pg.wait_for_timeout(400)
    ok('Estado "Cargando datos..."', pg.get_by_text('Cargando datos...').count() == 1)
    pg.wait_for_timeout(1800)
    pg.unroute('**/api/empleados')
    pg.route('**/api/proveedores', lambda r: r.fulfill(status=200, content_type='application/json', body='[]'))
    pg.goto(BASE + '/admin/proveedores')
    pg.wait_for_timeout(700)
    ok('Estado "sin registros"', pg.get_by_text('Todavía no hay registros').count() == 1)
    pg.unroute('**/api/proveedores')
    pg.goto(BASE + '/admin/categorias')
    pg.locator('tbody tr').first.wait_for()
    pg.route('**/api/categorias', lambda r: (pg.wait_for_timeout(1200), r.continue_()) if r.request.method == 'POST' else r.continue_())
    pg.fill('#nombre', 'ZZ Estado guardando')
    pg.locator('form.formulario button[type=submit]').click()
    pg.wait_for_timeout(300)
    ok('Estado "Guardando...": botón deshabilitado', 'Guardando' in pg.locator('form.formulario button[type=submit]').inner_text() and pg.locator('form.formulario button[type=submit]').is_disabled())
    ok('Mientras guarda, Editar/Eliminar de la tabla están deshabilitados', pg.locator('tbody tr').first.get_by_role('button', name=re.compile('^Editar')).is_disabled())
    esperar_toast(pg, 'creada')
    pg.unroute('**/api/categorias')
    pg.route('**/api/categorias/*', lambda r: (pg.wait_for_timeout(1200), r.continue_()) if r.request.method == 'DELETE' else r.continue_())
    expect(fila(pg, 'ZZ Estado guardando')).to_have_count(1)
    fila(pg, 'ZZ Estado guardando').get_by_role('button', name=re.compile('^Eliminar')).click()
    confirmar_modal(pg)
    pg.wait_for_timeout(300)
    ok('Estado "Eliminando...": Cancelar se deshabilita', 'Eliminando' in pg.get_by_role('alertdialog').inner_text() and pg.get_by_role('alertdialog').get_by_role('button', name='Cancelar').is_disabled())
    esperar_toast(pg, 'eliminad')
    pg.unroute('**/api/categorias/*')

    # ---------- Limpieza desde la interfaz ----------
    pg.goto(BASE + '/admin/movimientos')
    pg.locator('tbody tr').first.wait_for()
    fila(pg, 'ZZ compra').get_by_role('button', name=re.compile('^Eliminar')).click()
    confirmar_modal(pg)
    ok('Limpieza: eliminar la entrada de 60 (stock 0)', esperar_toast(pg, 'quedó en 0'))
    pg.goto(BASE + '/admin/productos')
    pg.locator('article.tarjeta-producto').first.wait_for()
    eliminar_con_modal(pg, tarjeta(pg, 'ZZ-001'), 'Productos')
    pg.goto(BASE + '/admin/categorias'); pg.locator('tbody tr').first.wait_for()
    eliminar_con_modal(pg, fila(pg, 'ZZ Tobilleras de playa'), 'Categorías')
    pg.goto(BASE + '/admin/proveedores'); pg.locator('tbody tr').first.wait_for()
    eliminar_con_modal(pg, fila(pg, 'ZZ Proveedor Prueba'), 'Proveedores')
    pg.goto(BASE + '/admin/materiales'); pg.locator('tbody tr').first.wait_for()
    eliminar_con_modal(pg, fila(pg, 'ZZ Cuarzo rosa natural'), 'Materiales')
    pg.goto(BASE + '/admin/empleados'); pg.locator('tbody tr').first.wait_for()
    eliminar_con_modal(pg, fila(pg, 'ZZ Karla Mora'), 'Empleados')

    # ---------- Error de conexión con el backend apagado ----------
    subprocess.run('kill $(lsof -t -i:3000)', shell=True)
    pg.wait_for_timeout(800)
    pg.goto(BASE + '/admin/materiales')
    pg.wait_for_timeout(1200)
    ok('Estado "Error de conexión" con el backend apagado', pg.get_by_text('Error de conexión').count() == 1)
    subprocess.Popen(f'cd {CARPETA_BACKEND} && nohup node src/server.js >> {LOG} 2>&1 &', shell=True)
    pg.wait_for_timeout(2500)
    pg.get_by_role('button', name='Reintentar').click()
    pg.locator('tbody tr').first.wait_for(timeout=5000)
    pg.wait_for_timeout(800)
    ok('"Reintentar" carga cuando el backend vuelve (sin saltar al login)', pg.url.endswith('/admin/materiales') and pg.locator('tbody tr').count() == 10, pg.url)

    # ---------- Celular ----------
    movil = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, storage_state=pg.context.storage_state()).new_page()
    movil.goto(BASE + '/admin/productos')
    movil.locator('article.tarjeta-producto').first.wait_for()
    movil.wait_for_timeout(1000)
    ok('Celular: sin desbordamiento horizontal', movil.evaluate('document.documentElement.scrollWidth') <= 392)
    ok('Celular: dos tarjetas por fila', movil.evaluate('getComputedStyle(document.querySelector(".grilla-productos")).gridTemplateColumns.split(" ").length') == 2)
    ok('Celular: los filtros empiezan plegados ("Filtros")', movil.locator('.filtros-cuerpo').is_hidden() and movil.locator('.filtros-alternar').is_visible())
    movil.locator('.filtros-alternar').click()
    ok('Celular: el botón "Filtros" despliega las secciones', movil.locator('.filtros-cuerpo').is_visible())
    movil.screenshot(path=f'{CAP}/e2e_movil_productos.png')
    movil.close()

    # ---------- Movimiento reducido ----------
    reducido = nav.new_context(viewport={'width': 1366, 'height': 900}, reduced_motion='reduce', storage_state=pg.context.storage_state()).new_page()
    reducido.goto(BASE + '/admin/productos')
    reducido.wait_for_selector('.pagina', state='attached')
    reducido.wait_for_timeout(100)
    tr = reducido.evaluate('getComputedStyle(document.querySelector(".pagina")).transform')
    ok('Movimiento reducido: la página no se desplaza al entrar', tr in ('none', 'matrix(1, 0, 0, 1, 0, 0)'), tr)
    reducido.close()
    creados = [m for m in api(pg, 'GET', '/movimientos') if m['motivo'] == 'Registrado desde la ficha del producto']
    for m in sorted(creados, key=lambda m: m['tipo'] != 'salida'):
        api(pg, 'DELETE', f"/movimientos/{m['id_movimiento']}")
    ok('Limpieza por la API (con sesión y CSRF): movimientos de la ficha borrados', len(creados) == 2, str(len(creados)))
    nav.close()

# Borra por la API los 2 movimientos que se crearon desde la ficha (primero la salida).

print('Errores de consola del navegador:', errores_consola or 'ninguno')
fallas = [r for r in resultados if not r[1]]
print(f'\nTotal: {len(resultados)} pruebas, {len(resultados) - len(fallas)} correctas, {len(fallas)} con falla.')
