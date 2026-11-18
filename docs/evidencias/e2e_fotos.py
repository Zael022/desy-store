"""Registro de cómo se probaron en el navegador las fotos y las subcategorías (ver docs/pruebas.md).
No hace falta ejecutarlo para usar el proyecto.

Requisitos: pip install playwright pillow, playwright install chromium; base con
npm run migrar + npm run seed + npm run crear-duena; backend con NODE_ENV=development y
MFA_MODO_CONSOLA=true guardando su salida en un archivo; frontend en http://localhost:5173.

Variables:
  DESY_LOG_BACKEND  archivo con la consola del backend (de ahí se leen los códigos)
  DESY_CLAVE_DUENA  contraseña de la dueña (no se guarda en ningún archivo)
  DESY_CAPTURAS     carpeta para las capturas (por defecto ./capturas-fotos)
"""
import os, re, sys, time, io
from playwright.sync_api import sync_playwright, expect


BASE = 'http://localhost:5173'
CAP = os.environ.get('DESY_CAPTURAS', 'capturas-fotos')
os.makedirs(CAP, exist_ok=True)
LOG = os.environ['DESY_LOG_BACKEND']
CLAVE = os.environ['DESY_CLAVE_DUENA']
res = []
consola = []

def ok(nombre, cond=True, det=''):
    res.append((nombre, bool(cond)))
    print(('OK   ' if cond else 'FALLA') + ' ' + nombre + (f' ({det})' if det and not cond else ''))

def codigo_para(correo, previos):
    fin = time.time() + 8
    patron = re.compile(r'\[MODO CONSOLA\] Correo para ' + re.escape(correo) + r'\n(.*?)(?=\n\n|\Z)', re.S)
    while time.time() < fin:
        b = patron.findall(open(LOG, encoding='utf-8').read())
        if len(b) > previos:
            return re.search(r'\b(\d{6})\b', b[-1]).group(1)
        time.sleep(0.2)
    raise RuntimeError('sin código')

def bloques(correo):
    patron = re.compile(r'\[MODO CONSOLA\] Correo para ' + re.escape(correo) + r'\n')
    return len(patron.findall(open(LOG, encoding='utf-8').read()))

def login(p, correo, clave):
    p.goto(BASE + '/login')
    p.get_by_label('Correo').fill(correo)
    p.get_by_label(re.compile(r'^Contraseña\s*\*?$')).fill(clave)
    p.get_by_role('button', name='Continuar').click()
    expect(p.get_by_role('heading', name='Verificación en dos pasos')).to_be_visible()
    previos = bloques(correo)
    p.get_by_role('button', name='Enviar código').click()
    p.get_by_label('Código de 6 dígitos').fill(codigo_para(correo, previos))
    p.get_by_role('button', name='Verificar y entrar').click()
    p.wait_for_url(re.compile(r'/(duena|admin)'))

def imagen_png():
    from PIL import Image
    b = io.BytesIO()
    Image.new('RGB', (600, 750), (190, 120, 160)).save(b, 'PNG')
    return b.getvalue()

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    p = nav.new_page(viewport={'width': 1366, 'height': 900})
    # El 401 de /api/auth/sesion es normal para un visitante (pregunta si hay sesión).
    p.on('console', lambda m: m.type == 'error' and '401' not in m.text and consola.append(m.text))
    p.on('pageerror', lambda e: consola.append(str(e)))

    # ---------- Público ----------
    p.goto(BASE + '/')
    expect(p.get_by_role('heading', name='Nuestras categorías')).to_be_visible()
    p.wait_for_load_state('networkidle')
    nombres = p.locator('.tarjeta-categoria .categoria-nombre').all_inner_texts()
    ok('Portada: solo categorías principales (Crochet sí, Peluches no)', 'Crochet' in nombres and 'Peluches' not in nombres, str(nombres))
    p.screenshot(path=f'{CAP}/01-portada.png', full_page=True)

    p.goto(BASE + '/catalogo')
    p.wait_for_load_state('networkidle')
    fotos = p.locator('.grilla-productos img.foto-producto')
    ok('Catálogo: los productos de Desy muestran foto', fotos.count() >= 12, str(fotos.count()))
    cargadas = p.evaluate("[...document.querySelectorAll('.grilla-productos img.foto-producto')].filter(i => i.complete && i.naturalWidth > 0).length")
    ok('Catálogo: las fotos cargan de verdad (naturalWidth > 0)', cargadas >= 8, str(cargadas))
    # Filtro Crochet incluye subcategorías
    p.get_by_role('button', name=re.compile(r'^Categoría')).click()
    p.get_by_role('checkbox', name=re.compile(r'^Crochet \d')).check()
    p.wait_for_timeout(400)
    titulo = p.locator('#titulo-resultados').inner_text()
    ok('Filtro "Crochet" incluye peluches, llaveros de crochet y decoración (8)', titulo.startswith('8 de'), titulo)
    sub = p.get_by_role('checkbox', name=re.compile(r'^Peluches \d'))
    ok('La subcategoría aparece marcada y bloqueada al elegir la principal', sub.is_checked() and sub.is_disabled())
    p.screenshot(path=f'{CAP}/02-catalogo-crochet.png', full_page=True)

    # Fotos con medidas: nunca son la principal (en el ZIP, la 1.ª foto de Batman tenía medidas)
    src_batman = p.get_by_role('article', name='Peluche Batman').locator('img.foto-producto').get_attribute('src')
    ok('Tarjeta de Batman: la foto principal NO es la de medidas', src_batman.endswith('cro-pel-003-2.webp'), src_batman)
    p.get_by_role('link', name='Peluche Batman').first.click()
    expect(p.get_by_role('heading', name='Peluche Batman')).to_be_visible()
    ok('Ficha de Batman: abre con la foto sin medidas', p.locator('.ficha-imagen img').get_attribute('src').endswith('cro-pel-003-2.webp'))
    p.get_by_role('button', name='Ver foto 2 (medidas)').click()
    p.wait_for_timeout(450)
    ok('Ficha: la foto con medidas queda al final y dice "Medidas"', p.locator('.galeria-medidas').is_visible())
    p.goto(BASE + '/catalogo')
    p.wait_for_load_state('networkidle')

    p.get_by_role('link', name='Peluche tortuga').first.click()
    expect(p.get_by_role('heading', name='Peluche tortuga')).to_be_visible()
    migas = p.locator('nav.migas').inner_text()
    ok('Ficha: migas con Crochet › Peluches', 'Crochet' in migas and 'Peluches' in migas)
    expect(p.locator('.galeria-miniatura')).to_have_count(3)
    principal = p.locator('.ficha-imagen img').get_attribute('src')
    p.get_by_role('button', name='Foto siguiente').click()
    p.wait_for_timeout(450)
    segunda = p.locator('.ficha-imagen img').get_attribute('src')
    ok('Galería: la flecha cambia la foto', principal != segunda, f'{principal} {segunda}')
    p.get_by_role('button', name='Ver foto 3').click()
    p.wait_for_timeout(450)
    ok('Galería: la miniatura 3 queda marcada', p.get_by_role('button', name='Ver foto 3').get_attribute('aria-pressed') == 'true')
    p.locator('.ficha-imagen').focus()
    p.keyboard.press('ArrowRight')
    p.wait_for_timeout(450)
    ok('Galería: con el teclado (→) vuelve a la primera', p.get_by_role('button', name='Ver foto 1').get_attribute('aria-pressed') == 'true')
    p.screenshot(path=f'{CAP}/03-ficha-tortuga.png', full_page=True)

    # Buscador con miniaturas
    p.get_by_role('searchbox').fill('llavero')
    p.wait_for_timeout(600)
    ok('Buscador: las sugerencias muestran foto', p.locator('.sugerencia-foto img').count() >= 3, str(p.locator('.sugerencia-foto img').count()))
    p.screenshot(path=f'{CAP}/04-buscador.png')
    p.keyboard.press('Escape')

    # ---------- Dueña: administrar fotos ----------
    login(p, 'daniela.rojas@example.com', CLAVE)
    p.goto(BASE + '/admin/productos')
    p.wait_for_load_state('networkidle')
    p.screenshot(path=f'{CAP}/05-admin-productos.png', full_page=True)
    p.get_by_role('button', name='Fotos de Aretes argolla de plata').click()
    expect(p.get_by_role('heading', name='Fotos de Aretes argolla de plata')).to_be_visible()
    expect(p.get_by_text('todavía no tiene fotos')).to_be_visible()
    p.locator('.modal-fotos input[type=file]').set_input_files([
        {'name': 'aretes-1.png', 'mimeType': 'image/png', 'buffer': imagen_png()},
        {'name': 'aretes-2.png', 'mimeType': 'image/png', 'buffer': imagen_png()},
        {'name': 'notas.txt', 'mimeType': 'text/plain', 'buffer': b'hola'}
    ])
    expect(p.locator('.foto-item')).to_have_count(2, timeout=10000)
    ok('Subir: 2 fotos válidas se agregan y el .txt se rechaza con aviso', p.get_by_text('no es JPG, PNG ni WebP').is_visible())
    p.screenshot(path=f'{CAP}/06-modal-fotos.png')
    primera = p.locator('.foto-item img').first.get_attribute('src')
    p.get_by_role('button', name='Hacer principal la foto 2').click()
    p.wait_for_timeout(600)
    ok('Hacer principal: la foto 2 pasa a primera', p.locator('.foto-item img').first.get_attribute('src') != primera)
    p.get_by_role('button', name='Borrar la foto 2').click()
    p.get_by_role('button', name='Sí, borrar la foto 2').click()
    expect(p.locator('.foto-item')).to_have_count(1)
    ok('Borrar con confirmación deja 1 foto', True)
    p.get_by_role('button', name='Cerrar').click()
    p.wait_for_timeout(500)
    tarjeta = p.get_by_role('article', name='Aretes argolla de plata')
    ok('La tarjeta del producto muestra ahora su foto', tarjeta.locator('img.foto-producto').count() == 1)

    # Medidas en la ventana de fotos (Batman: 1 normal + 1 con medidas)
    p.get_by_role('button', name='Fotos de Peluche Batman').click()
    expect(p.get_by_role('heading', name='Fotos de Peluche Batman')).to_be_visible()
    expect(p.locator('.foto-item')).to_have_count(2)
    ok('Ventana de fotos: la de medidas va al final con su insignia', p.locator('.foto-item').nth(1).locator('.insignia-medidas').is_visible())
    ok('Ventana de fotos: la de medidas no tiene botón "Hacer principal"', p.get_by_role('button', name='Hacer principal la foto 2').count() == 0)
    p.get_by_role('button', name='Marcar la foto 1 como foto con medidas').click()
    expect(p.get_by_text('Todas las fotos tienen medidas')).to_be_visible()
    ok('Marcar la única foto normal: avisa que el catálogo mostrará un ícono', True)
    p.screenshot(path=f'{CAP}/06b-fotos-medidas.png')
    sin_medidas = p.locator('.foto-item', has=p.locator('img[src$="cro-pel-003-2.webp"]'))
    sin_medidas.get_by_role('button', name=re.compile('Quitar la marca de medidas')).click()
    expect(p.get_by_text('Todas las fotos tienen medidas')).to_have_count(0)
    principal = p.locator('.foto-item.es-principal img').get_attribute('src')
    ok('Quitar la marca: esa foto vuelve a ser la principal', principal.endswith('cro-pel-003-2.webp'), principal)
    p.get_by_role('button', name='Cerrar').click()
    p.wait_for_timeout(500)

    # Ficha admin con botón Administrar fotos
    p.goto(BASE + '/admin/productos')
    p.get_by_role('link', name='Llavero Minion').first.click()
    expect(p.get_by_role('button', name=re.compile(r'Administrar fotos \(2\)'))).to_be_visible()
    p.screenshot(path=f'{CAP}/07-ficha-admin.png', full_page=True)

    # Formulario de producto: categorías con jerarquía
    p.goto(BASE + '/admin/productos')
    p.get_by_role('button', name='Nuevo producto').click()
    opciones = p.locator('#id_categoria option').all_inner_texts()
    ok('Formulario: categorías como "Crochet › Peluches"', 'Crochet › Peluches' in opciones, str(opciones))
    p.keyboard.press('Escape')

    # Categorías
    p.goto(BASE + '/admin/categorias')
    expect(p.get_by_role('cell', name='↳ Peluches')).to_be_visible()
    p.get_by_role('button', name='Editar Crochet').click()
    ok('Categoría con subcategorías: "Dentro de" bloqueado', p.locator('#id_categoria_padre').is_disabled())
    p.get_by_role('button', name='Cancelar').click()
    p.get_by_role('button', name='Editar Peluches').click()
    ok('Subcategoría: "Dentro de" muestra Crochet', p.locator('#id_categoria_padre option:checked').inner_text() == 'Crochet')
    p.screenshot(path=f'{CAP}/08-categorias.png', full_page=True)

    # ---------- Celular ----------
    m = nav.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True)
    m.goto(BASE + '/catalogo')
    m.wait_for_load_state('networkidle')
    ancho = m.evaluate('document.documentElement.scrollWidth')
    ok('Celular: el catálogo con fotos no se desborda', ancho <= 392, str(ancho))
    m.screenshot(path=f'{CAP}/09-celular-catalogo.png', full_page=False)
    m.goto(BASE + '/catalogo')
    m.get_by_role('link', name='Peluche Snoopy').first.click()
    m.wait_for_timeout(600)
    ancho = m.evaluate('document.documentElement.scrollWidth')
    ok('Celular: la ficha con galería no se desborda', ancho <= 392, str(ancho))
    m.screenshot(path=f'{CAP}/10-celular-ficha.png', full_page=True)

    ok('Sin errores en la consola del navegador', not consola, ' | '.join(consola[:3]))
    nav.close()

fallas = [n for n, c in res if not c]
print(f'\n{len(res) - len(fallas)}/{len(res)} comprobaciones correctas')
sys.exit(1 if fallas else 0)
