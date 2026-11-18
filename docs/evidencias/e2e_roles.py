"""Prueba en navegador real (Chromium + Playwright) del flujo completo de cada rol.

Es el registro de cómo se probó la interfaz (ver docs/pruebas.md); no hace falta
ejecutarlo para usar el proyecto. Requisitos: pip install playwright, playwright install chromium,
base recién creada (script.sql + npm run migrar + npm run seed + npm run crear-duena),
backend con NODE_ENV=development y MFA_MODO_CONSOLA=true guardando su salida en un archivo,
y el frontend en http://localhost:5173.

Variables:
  DESY_LOG_BACKEND    archivo donde se guarda la consola del backend (de ahí se leen códigos y enlaces)
  DESY_CORREO_DUENA   correo de la dueña creada con npm run crear-duena
  DESY_CLAVE_DUENA    su contraseña (no se guarda en ningún archivo)
Las demás contraseñas se generan al azar en cada ejecución.
"""
import os, re, secrets, sys, time, json
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:5173'
LOG = os.environ.get('DESY_LOG_BACKEND', 'backend.log')
CAPTURAS = os.environ.get('DESY_CAPTURAS', 'capturas')
CORREO_DUENA = os.environ.get('DESY_CORREO_DUENA', 'daniela.rojas@example.com')
CLAVE_DUENA = os.environ['DESY_CLAVE_DUENA']
clave_al_azar = lambda: 'Desy-' + secrets.token_urlsafe(12)
resultados = []
errores_consola = []

def ok(nombre, condicion=True, detalle=''):
    resultados.append((nombre, bool(condicion), detalle))
    print(('OK   ' if condicion else 'FALLA') + ' ' + nombre + (f' ({detalle})' if detalle and not condicion else ''))

def leer_log():
    return open(LOG, encoding='utf-8').read()

def bloques_para(correo_o_tel):
    texto = leer_log()
    patron = re.compile(r'\[MODO CONSOLA\] (?:Correo|SMS) para ' + re.escape(correo_o_tel) + r'\n(.*?)(?=\n\n|\Z)', re.S)
    return patron.findall(texto)

def ultimo_codigo(destino, previos=0, espera=8):
    fin = time.time() + espera
    while time.time() < fin:
        b = bloques_para(destino)
        if len(b) > previos:
            return re.search(r'\b(\d{6})\b', b[-1]).group(1)
        time.sleep(0.2)
    raise RuntimeError(f'No llegó código para {destino}')

def ultimo_token(destino, previos=0, espera=8):
    fin = time.time() + espera
    while time.time() < fin:
        b = bloques_para(destino)
        if len(b) > previos:
            return re.search(r'token=([A-Za-z0-9_-]+)', b[-1]).group(1)
        time.sleep(0.2)
    raise RuntimeError(f'No llegó enlace para {destino}')

def visible(localizador, espera=6000):
    try:
        expect(localizador.first).to_be_visible(timeout=espera)
        return True
    except AssertionError:
        return False

def captura(pagina, nombre):
    pagina.screenshot(path=f'{CAPTURAS}/{nombre}.png', full_page=True)

def login(pagina, correo, clave, canal='correo', tel=None):
    pagina.goto(BASE + '/login')
    pagina.get_by_label('Correo').fill(correo)
    pagina.get_by_label(re.compile(r'^Contraseña\s*\*?$')).fill(clave)
    pagina.get_by_role('button', name='Continuar').click()
    expect(pagina.get_by_role('heading', name='Verificación en dos pasos')).to_be_visible()
    previos = len(bloques_para(tel or correo))
    if canal == 'sms':
        pagina.get_by_text('Mensaje de texto (SMS)').click()
    pagina.get_by_role('button', name='Enviar código').click()
    codigo = ultimo_codigo(tel or correo, previos)
    pagina.get_by_label('Código de 6 dígitos').fill(codigo)
    pagina.get_by_role('button', name='Verificar y entrar').click()

def salir(pagina):
    pagina.get_by_role('button', name='Abrir menú').click()
    pagina.get_by_role('button', name='Cerrar sesión', exact=True).click()
    expect(pagina).to_have_url(re.compile(r'/login$'))

def principal():
    os.makedirs(CAPTURAS, exist_ok=True)
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        contexto = navegador.new_context(viewport={'width': 1366, 'height': 900}, locale='es-CR')
        pagina = contexto.new_page()
        pagina.on('console', lambda m: m.type == 'error' and errores_consola.append(m.text))
        pagina.on('pageerror', lambda e: errores_consola.append(str(e)))

        # ---------- Visitante ----------
        pagina.goto(BASE + '/')
        expect(pagina.get_by_role('heading', name='Nuestras categorías')).to_be_visible()
        ok('Visitante: bienvenida muestra categorías y novedades', pagina.get_by_role('heading', name='Novedades').is_visible())
        captura(pagina, '01-bienvenida')
        pagina.goto(BASE + '/catalogo')
        expect(pagina.get_by_role('heading', name=re.compile(r'de \d+ productos'))).to_be_visible()
        texto = pagina.locator('.grilla-productos').inner_text()
        ok('Catálogo: muestra disponibilidad y no el stock exacto', ('Disponible' in texto or 'Pocas unidades' in texto) and '/ 67' not in texto)
        captura(pagina, '02-catalogo')
        pagina.goto(BASE + '/admin/productos')
        expect(pagina).to_have_url(re.compile(r'/login$'))
        expect(pagina.get_by_text('Inicie sesión para continuar.')).to_be_visible()
        ok('Visitante: /admin/productos lleva al login', True)
        # Login con contraseña incorrecta: mensaje genérico
        pagina.get_by_label('Correo').fill(CORREO_DUENA)
        pagina.get_by_label(re.compile(r'^Contraseña\s*\*?$')).fill('incorrecta-123')
        pagina.get_by_role('button', name='Continuar').click()
        expect(pagina.get_by_text('Correo o contraseña incorrectos.')).to_be_visible()
        ok('Login incorrecto: mensaje genérico', True)

        # ---------- Dueña ----------
        login(pagina, CORREO_DUENA, CLAVE_DUENA)
        # Venía de /admin/productos (protegida): después del MFA vuelve ahí.
        expect(pagina).to_have_url(re.compile(r'/admin/productos$'))
        ok('Dueña: después del MFA vuelve a la página protegida que había pedido', True)
        pagina.goto(BASE + '/duena')
        expect(pagina.get_by_role('heading', name='Ingresos y ganancia por día')).to_be_visible()
        ok('Dueña: dashboard ejecutivo', True)
        pagina.wait_for_timeout(800)
        ok('Dueña: dashboard con gráfico de Recharts', pagina.locator('.recharts-surface').count() >= 2)
        ok('Dueña: aviso de productos sin costo', visible(pagina.get_by_text('Productos sin costo')))
        captura(pagina, '03-duena-dashboard')
        # Filtro 7 días
        pagina.get_by_role('button', name='Últimos 7 días').click()
        pagina.wait_for_timeout(600)
        ok('Dueña: filtro de fechas actualiza el periodo', 'Periodo:' in pagina.locator('main').inner_text())

        # Costo de un producto (solo dueña)
        pagina.goto(BASE + '/admin/productos')
        pagina.get_by_role('button', name='Editar Aretes argolla de plata').click()
        pagina.get_by_label('Costo unitario (₡)').fill('4200')
        pagina.get_by_role('button', name='Guardar cambios').click()
        expect(pagina.get_by_text('Producto actualizado correctamente.')).to_be_visible()
        ok('Dueña: registra el costo unitario de un producto', True)

        # Configuración
        pagina.goto(BASE + '/duena/configuracion')
        pagina.get_by_label('Umbral de “pocas unidades”').fill('6')
        pagina.get_by_role('button', name='Guardar configuración').click()
        expect(pagina.get_by_text('Configuración guardada.')).to_be_visible()
        ok('Dueña: cambia la configuración', True)

        # Usuarios: reenviar invitaciones del seed
        pagina.goto(BASE + '/admin/usuarios')
        expect(pagina.get_by_role('cell', name='mariana.solis@example.com')).to_be_visible()
        captura(pagina, '04-usuarios')
        tokens = {}
        for nombre, correo in [('Mariana Solís', 'mariana.solis@example.com'), ('Andrés Vargas', 'andres.vargas@example.com'), ('Brillos del Pacífico S.A.', 'ventas@brillospacifico.example.com')]:
            previos = len(bloques_para(correo))
            pagina.get_by_role('button', name=f'Reenviar invitación a {nombre}').click()
            pagina.get_by_role('button', name='Sí, reenviar').click()
            expect(pagina.get_by_text(f'Invitación reenviada a {correo}.')).to_be_visible()
            tokens[correo] = ultimo_token(correo, previos)
        ok('Dueña: reenvía 3 invitaciones (enlace en el correo)', len(tokens) == 3)
        # Editar una cuenta con invitación pendiente: corregir su correo.
        pagina.get_by_role('button', name='Corregir el correo de Taller Artesanal Manos de Mar').click()
        pagina.get_by_label('Correo correcto').fill('pedidos.manosdemar@example.com')
        pagina.get_by_role('button', name='Guardar correo').click()
        expect(pagina.get_by_text('Correo corregido. Reenvíe la invitación', exact=False)).to_be_visible()
        ok('Dueña: corrige el correo de una invitación pendiente', visible(pagina.get_by_role('cell', name='pedidos.manosdemar@example.com')))
        salir(pagina)

        # ---------- Invitaciones aceptadas ----------
        claves = {}
        for correo, token in tokens.items():
            pagina.goto(f'{BASE}/invitacion?token={token}')
            expect(pagina.get_by_role('heading', name='Activar su cuenta')).to_be_visible()
            clave = clave_al_azar()
            pagina.get_by_label('Elija su contraseña').fill(clave)
            pagina.get_by_label('Repita la contraseña').fill(clave)
            pagina.get_by_role('button', name='Activar cuenta').click()
            expect(pagina).to_have_url(re.compile(r'/login$'))
            claves[correo] = clave
        ok('Invitaciones: las 3 cuentas definen su contraseña', len(claves) == 3)
        # Reusar el mismo enlace falla
        pagina.goto(f'{BASE}/invitacion?token={tokens["mariana.solis@example.com"]}')
        expect(pagina.get_by_text('La invitación no es válida o ya expiró.', exact=False)).to_be_visible()
        ok('Invitación: el enlace no sirve dos veces', True)

        # ---------- Ventas ----------
        login(pagina, 'mariana.solis@example.com', claves['mariana.solis@example.com'])
        expect(pagina).to_have_url(re.compile(r'/pos$'))
        ok('Ventas: redirige al punto de venta', True)
        pagina.get_by_label('Buscar productos para la venta').fill('scrunchie')
        pagina.wait_for_timeout(700)
        pagina.get_by_role('button', name='Agregar Scrunchie de satín').click()
        pagina.get_by_label('Buscar productos para la venta').fill('anillo')
        pagina.wait_for_timeout(700)
        boton_anillo = pagina.get_by_role('button', name='Agregar Anillo ajustable minimalista')
        boton_anillo.click()
        # Pedir más de lo que hay (stock 4): alerta
        pagina.locator('.pos-linea', has_text='Anillo').get_by_label('Cantidad', exact=True).fill('9')
        expect(pagina.get_by_text(re.compile(r'Solo quedan \d+ unidad'))).to_be_visible()
        ok('Ventas: alerta cuando la cantidad supera el stock', pagina.get_by_role('button', name='Confirmar venta').is_disabled())
        pagina.locator('.pos-linea', has_text='Anillo').get_by_label('Cantidad', exact=True).fill('1')
        pagina.get_by_label('Buscar cliente registrado').fill('cami')
        pagina.get_by_role('button', name=re.compile('Camila Mora')).click()
        captura(pagina, '05-pos')
        pagina.get_by_role('button', name='Confirmar venta').click()
        pagina.get_by_role('button', name='Sí, confirmar venta').click()
        expect(pagina.get_by_role('heading', name=re.compile(r'Venta #\d+ registrada'))).to_be_visible()
        numero_venta = re.search(r'#(\d+)', pagina.get_by_role('heading', name=re.compile(r'Venta #\d+ registrada')).inner_text()).group(1)
        ok('Ventas: confirma una venta asociada a un cliente', True, numero_venta)
        captura(pagina, '06-pos-comprobante')
        pagina.get_by_role('button', name='Nueva venta').click()
        # Devolución
        pagina.goto(BASE + '/pos/ventas')
        pagina.get_by_role('button', name=f'Ver la venta #{numero_venta}').click()
        pagina.get_by_role('button', name='Registrar devolución').click()
        pagina.locator('.linea-devolucion', has_text='Scrunchie').locator('input').fill('1')
        pagina.get_by_label('Motivo').fill('Color equivocado')
        pagina.get_by_role('button', name=re.compile('Registrar devolución \\(')).click()
        expect(pagina.get_by_text(re.compile(r'Devolución #\d+ registrada'))).to_be_visible()
        ok('Ventas: registra la devolución de su venta', True)
        captura(pagina, '07-mis-ventas')
        pagina.goto(BASE + '/admin/usuarios')
        ok('Ventas: /admin/usuarios muestra "sin permiso"', visible(pagina.get_by_role('heading', name='Esta sección no es para su cuenta')))
        salir(pagina)

        # ---------- Administración ----------
        login(pagina, 'andres.vargas@example.com', claves['andres.vargas@example.com'])
        expect(pagina).to_have_url(re.compile(r'/admin$'))
        expect(pagina.get_by_role('heading', name='Alertas de stock bajo')).to_be_visible()
        ok('Administración: redirige al panel administrativo', True)
        captura(pagina, '08-panel-admin')
        pagina.goto(BASE + '/admin/abastecimiento')
        pagina.get_by_role('button', name='Nueva solicitud').click()
        pagina.locator('#id_proveedor').select_option(label='Brillos del Pacífico S.A.')
        pagina.locator('.linea-devolucion', has_text='Collar corazón').locator('input').fill('5')
        pagina.get_by_role('button', name='Enviar solicitud').click()
        expect(pagina.get_by_text(re.compile(r'Solicitud #\d+ enviada'))).to_be_visible()
        id_solicitud = re.search(r'#(\d+)', pagina.get_by_text(re.compile(r'Solicitud #\d+ enviada')).inner_text()).group(1)
        ok('Administración: crea una solicitud de abastecimiento', True, id_solicitud)
        pagina.goto(BASE + '/duena')
        ok('Administración: /duena muestra "sin permiso"', visible(pagina.get_by_role('heading', name='Esta sección no es para su cuenta')))
        pagina.goto(BASE + '/admin/productos/1')
        ok('Administración: no ve el costo unitario', 'Costo unitario' not in pagina.locator('main').inner_text())
        pagina.goto(BASE + '/admin/usuarios')
        pagina.get_by_role('button', name='Nueva cuenta').click()
        expect(pagina.locator('#rol')).to_be_visible()
        opciones = pagina.locator('#rol option').all_inner_texts()
        ok('Administración: solo puede crear cuentas de Ventas y Proveedor', [o for o in opciones if not o.startswith('Seleccione')] == ['Ventas', 'Proveedor'], str(opciones))
        pagina.keyboard.press('Escape')
        salir(pagina)

        # ---------- Proveedor ----------
        login(pagina, 'ventas@brillospacifico.example.com', claves['ventas@brillospacifico.example.com'])
        expect(pagina).to_have_url(re.compile(r'/proveedor$'))
        ok('Proveedor: redirige a su portal', True)
        pagina.get_by_role('button', name=f'Ver la solicitud #{id_solicitud}').click()
        pagina.get_by_role('button', name='Aceptar').click()
        pagina.get_by_label('Comentario (opcional)').fill('Sale el lunes')
        pagina.get_by_role('button', name='Sí, aceptar').click()
        expect(pagina.get_by_text('Solicitud aceptada.')).to_be_visible()
        ok('Proveedor: acepta la solicitud', True)
        pagina.wait_for_timeout(500)
        pagina.keyboard.press('Escape')
        ok('Proveedor: Escape cierra el detalle después de responder', visible(pagina.locator('.modal'), 100) is False or (pagina.wait_for_timeout(800) or pagina.locator('.modal').count() == 0))
        if pagina.locator('.modal').count():
            pagina.get_by_role('button', name='Cerrar', exact=True).click()
        expect(pagina.locator('.modal')).to_have_count(0)
        pagina.get_by_role('tab', name='Mis productos').click()
        visible(pagina.get_by_role('cell', name='Collar corazón de acero'))
        texto_productos = pagina.locator('main').inner_text()
        ok('Proveedor: ve solo sus productos', 'Collar corazón de acero' in texto_productos and 'Aretes argolla de plata' not in texto_productos)
        captura(pagina, '09-portal-proveedor')
        salir(pagina)

        # ---------- Administración recibe ----------
        login(pagina, 'andres.vargas@example.com', claves['andres.vargas@example.com'])
        pagina.goto(BASE + '/admin/abastecimiento')
        pagina.get_by_role('button', name=f'Ver la solicitud #{id_solicitud}').click()
        pagina.get_by_role('button', name='Marcar como recibida').click()
        pagina.get_by_role('button', name='Sí, registrar entradas').click()
        expect(pagina.get_by_text(re.compile(r'recibida: las unidades entraron'))).to_be_visible()
        ok('Administración: recibe la solicitud (entradas de inventario)', True)
        pagina.keyboard.press('Escape')
        pagina.goto(BASE + '/admin/movimientos')
        ok('Movimientos: muestran su origen (abastecimiento / venta)', visible(pagina.get_by_text(f'Abastecimiento #{id_solicitud}', exact=True)) and visible(pagina.get_by_text(f'Venta #{numero_venta}', exact=True)))
        fila_venta = pagina.locator('tr', has_text=f'Venta #{numero_venta}').first
        ok('Movimientos: los de una venta no tienen editar/eliminar', fila_venta.get_by_role('button').count() == 0)
        captura(pagina, '10-movimientos')
        # Sesión vencida: se borran las cookies
        contexto.clear_cookies()
        pagina.goto(BASE + '/admin/categorias')
        pagina.wait_for_timeout(1500)
        ok('Sesión vencida: vuelve al login con mensaje', '/login' in pagina.url, pagina.url)

        # ---------- Cliente nuevo ----------
        correo_cliente = f'cliente.{int(time.time())}@example.com'
        clave_cliente = clave_al_azar()
        clave_camila = clave_al_azar()
        pagina.goto(BASE + '/registro')
        pagina.get_by_label('Nombre completo').fill('Lucía Prueba')
        pagina.get_by_label('Correo').fill(correo_cliente)
        pagina.get_by_label('Teléfono (opcional)').fill('+506 8888 1234')
        pagina.get_by_label(re.compile(r'^Contraseña\s*\*?$')).fill(clave_cliente)
        pagina.get_by_label('Repita la contraseña').fill(clave_cliente)
        pagina.get_by_role('button', name='Crear cuenta').click()
        expect(pagina).to_have_url(re.compile(r'/verificar-correo$'))
        pagina.get_by_label('Código de 6 dígitos').fill(ultimo_codigo(correo_cliente))
        pagina.get_by_role('button', name='Verificar correo').click()
        expect(pagina.get_by_text('Correo verificado. Ya puede iniciar sesión.')).to_be_visible()
        ok('Cliente: se registra y verifica el correo', True)
        login(pagina, correo_cliente, clave_cliente)
        expect(pagina).to_have_url(re.compile(r'/cliente$'))
        ok('Cliente: redirige a su portal (sin compras)', visible(pagina.get_by_text('Todavía no hay compras')))
        # Verificar teléfono por SMS (modo consola)
        pagina.goto(BASE + '/perfil')
        pagina.get_by_role('button', name='Verificar').click()
        pagina.get_by_label('Teléfono (formato internacional)').fill('+506 8888 1234')
        previos = len(bloques_para('+50688881234'))
        pagina.get_by_role('button', name='Enviar código').click()
        pagina.get_by_label('Código de 6 dígitos').fill(ultimo_codigo('+50688881234', previos))
        pagina.get_by_role('button', name='Confirmar').click()
        expect(pagina.get_by_text('Teléfono verificado.', exact=False)).to_be_visible()
        ok('Cliente: verifica su teléfono por SMS', True)
        captura(pagina, '11-perfil')
        salir(pagina)
        login(pagina, correo_cliente, clave_cliente, canal='sms', tel='+50688881234')
        expect(pagina).to_have_url(re.compile(r'/cliente$'))
        ok('Cliente: inicia sesión con el código por SMS', True)
        salir(pagina)

        # ---------- Cliente del seed (recupera contraseña) ----------
        pagina.goto(BASE + '/recuperar')
        previos = len(bloques_para('camila.mora@example.com'))
        pagina.get_by_label('Correo de su cuenta').fill('camila.mora@example.com')
        pagina.get_by_role('button', name='Enviar enlace').click()
        expect(pagina.get_by_text('Si el correo está registrado', exact=False)).to_be_visible()
        token = ultimo_token('camila.mora@example.com', previos)
        pagina.goto(f'{BASE}/restablecer?token={token}')
        pagina.locator('#contrasena').fill(clave_camila)
        pagina.locator('#confirmacion').fill(clave_camila)
        pagina.get_by_role('button', name='Guardar contraseña').click()
        expect(pagina).to_have_url(re.compile(r'/login$'))
        login(pagina, 'camila.mora@example.com', clave_camila)
        expect(pagina).to_have_url(re.compile(r'/cliente$'))
        expect(pagina.get_by_role('cell', name=f'#{numero_venta}', exact=True)).to_be_visible()
        ok('Cliente del seed: recupera la contraseña y ve su compra nueva', True)
        pagina.get_by_role('button', name=f'Ver la compra #{numero_venta}').click()
        detalle = pagina.locator('.modal').inner_text()
        ok('Cliente: el detalle de la compra no muestra costos', 'Costo' not in detalle and 'Scrunchie' in detalle)
        captura(pagina, '12-portal-cliente')
        pagina.keyboard.press('Escape')
        pagina.goto(BASE + '/pos')
        ok('Cliente: /pos muestra "sin permiso"', visible(pagina.get_by_role('heading', name='Esta sección no es para su cuenta')))

        # ---------- Celular ----------
        celular = navegador.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, locale='es-CR')
        movil = celular.new_page()
        movil.on('pageerror', lambda e: errores_consola.append(str(e)))
        movil.goto(BASE + '/catalogo')
        expect(movil.get_by_role('heading', name=re.compile(r'de \d+ productos'))).to_be_visible()
        ancho = movil.evaluate('document.documentElement.scrollWidth')
        ok('Celular: el catálogo no se desborda horizontalmente', ancho <= 392, str(ancho))
        movil.screenshot(path=f'{CAPTURAS}/13-celular-catalogo.png', full_page=True)
        login(movil, 'mariana.solis@example.com', claves['mariana.solis@example.com'])
        expect(movil).to_have_url(re.compile(r'/pos$'))
        movil.wait_for_timeout(700)
        ancho = movil.evaluate('document.documentElement.scrollWidth')
        ok('Celular: punto de venta sin desborde', ancho <= 392, str(ancho))
        movil.screenshot(path=f'{CAPTURAS}/14-celular-pos.png', full_page=True)
        login_movil = movil.goto(BASE + '/login')
        movil.screenshot(path=f'{CAPTURAS}/15-celular-login.png')
        navegador.close()

    relevantes = [e for e in errores_consola if 'status of 401' not in e and 'status of 400' not in e and 'status of 403' not in e]
    ok('Sin errores de JavaScript en la consola', len(relevantes) == 0, json.dumps(relevantes[:5], ensure_ascii=False))
    fallas = [r for r in resultados if not r[1]]
    print(f'\nTotal: {len(resultados)} comprobaciones, {len(resultados) - len(fallas)} correctas, {len(fallas)} con falla.')
    sys.exit(1 if fallas else 0)

principal()
