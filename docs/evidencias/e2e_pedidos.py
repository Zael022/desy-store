"""Registro de cómo se probaron en el navegador los pedidos de clientes (ver docs/pruebas.md).
No hace falta ejecutarlo para usar el proyecto.

Requisitos: pip install playwright, playwright install chromium; base con npm run migrar +
npm run seed; backend con NODE_ENV=development y MFA_MODO_CONSOLA=true guardando su salida
en un archivo; frontend en http://localhost:5173. Las cuentas del seed no tienen contraseña:
antes se le pone una (solo en la base de prueba) a camila.mora (cliente) y mariana.solis (ventas).

Variables:
  DESY_LOG_BACKEND  archivo con la consola del backend (de ahí se leen los códigos)
  DESY_CLAVE        contraseña puesta a las dos cuentas de prueba (no se guarda en ningún archivo)
  DESY_CAPTURAS     carpeta para las capturas (por defecto ./capturas-pedidos)
"""
import os, re, sys, time
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:5173'
LOG = os.environ['DESY_LOG_BACKEND']
CLAVE = os.environ['DESY_CLAVE']
CAP = os.environ.get('DESY_CAPTURAS', 'capturas-pedidos')
CLIENTE = 'camila.mora@example.com'
VENTAS = 'mariana.solis@example.com'
os.makedirs(CAP, exist_ok=True)
res, consola = [], []

def ok(nombre, cond=True, det=''):
    res.append((nombre, bool(cond)))
    print(('OK   ' if cond else 'FALLA') + ' ' + nombre + (f' ({det})' if det and not cond else ''))

def bloques(correo):
    return re.findall(r'\[MODO CONSOLA\] Correo para ' + re.escape(correo) + r'\n(.*?)(?=\n\n|\Z)', open(LOG, encoding='utf-8').read(), re.S)

def codigo_para(correo, previos):
    fin = time.time() + 8
    while time.time() < fin:
        b = bloques(correo)
        if len(b) > previos:
            return re.search(r'\b(\d{6})\b', b[-1]).group(1)
        time.sleep(0.2)
    raise RuntimeError('sin código')

def login(p, correo, desde_pedido=False):
    if not desde_pedido:
        p.goto(BASE + '/login')
    p.get_by_label('Correo').fill(correo)
    p.get_by_label(re.compile(r'^Contraseña\s*\*?$')).fill(CLAVE)
    p.get_by_role('button', name='Continuar').click()
    expect(p.get_by_role('heading', name='Verificación en dos pasos')).to_be_visible()
    previos = len(bloques(correo))
    p.get_by_role('button', name='Enviar código').click()
    p.get_by_label('Código de 6 dígitos').fill(codigo_para(correo, previos))
    p.get_by_role('button', name='Verificar y entrar').click()

def vigilar(p):
    p.on('console', lambda m: m.type == 'error' and '401' not in m.text and consola.append(m.text))
    p.on('pageerror', lambda e: consola.append(str(e)))

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    cli = nav.new_context(viewport={'width': 1366, 'height': 900}).new_page()
    vigilar(cli)

    # ---------- Visitante arma el pedido ----------
    cli.goto(BASE + '/catalogo')
    cli.wait_for_load_state('networkidle')
    cli.get_by_role('button', name='Agregar Peluche Snoopy al pedido').click()
    expect(cli.get_by_role('button', name='Agregar Peluche Snoopy al pedido')).to_have_text('En su pedido (1)')
    contador = cli.locator('.accesos .acceso-contador').first.inner_text()
    ok('Catálogo: "Agregar al pedido" suma 1 y la cabecera lo cuenta', contador == '1', contador)
    cli.get_by_role('link', name='Llavero kiwi').first.click()
    expect(cli.get_by_role('heading', name='Llavero kiwi')).to_be_visible()
    cli.get_by_role('button', name='Sumar uno').click()
    cli.get_by_role('button', name='Agregar al pedido').click()
    expect(cli.get_by_text('Ya tiene 2 en')).to_be_visible()
    ok('Ficha: con el selector se agregan 2 unidades', True)
    cli.screenshot(path=f'{CAP}/01-ficha-agregar.png')

    cli.goto(BASE + '/pedido')
    expect(cli.locator('.pedido-linea')).to_have_count(2)
    total = cli.locator('.pedido-resumen .pedido-total strong').inner_text()
    ok('Mi pedido: 2 productos y total de ₡15 500 (8 500 + 2 × 3 500)', '15' in total and '500' in total, total)
    cli.screenshot(path=f'{CAP}/02-mi-pedido-visitante.png', full_page=True)
    cli.get_by_role('button', name='Iniciar sesión para enviar').click()
    expect(cli.get_by_text('Inicie sesión para enviar su pedido.')).to_be_visible()
    login(cli, CLIENTE, desde_pedido=True)
    cli.wait_for_url(BASE + '/pedido')
    expect(cli.get_by_role('button', name='Enviar pedido')).to_be_visible()
    ok('Después de iniciar sesión vuelve a "Mi pedido" con lo elegido', cli.locator('.pedido-linea').count() == 2)
    cli.get_by_label('Nota para la tienda (opcional)').fill('Paso el viernes en la tarde')
    cli.get_by_role('button', name='Enviar pedido').click()
    cli.wait_for_url(BASE + '/cliente/pedidos')
    tarjeta = cli.locator('.tarjeta-pedido').first
    expect(tarjeta).to_contain_text('Esperando confirmación')
    numero = re.search(r'#(\d+)', tarjeta.locator('h3').inner_text()).group(1)
    ok('Enviado: aparece "Esperando confirmación" con su plazo y la nota', 'La tienda le confirmará antes del' in tarjeta.inner_text() and 'Paso el viernes' in tarjeta.inner_text())
    ok('El pedido en armado queda vacío al enviarlo', cli.locator('.accesos .acceso-contador').count() == 0)
    ok('Correo "Recibimos su pedido" (modo consola)', any('Recibimos su pedido' in b for b in bloques(CLIENTE)))
    cli.screenshot(path=f'{CAP}/03-mis-pedidos-pendiente.png', full_page=True)

    # ---------- Tienda: confirmar y entregar ----------
    ven = nav.new_context(viewport={'width': 1366, 'height': 900}).new_page()
    vigilar(ven)
    login(ven, VENTAS)
    ven.wait_for_url(re.compile(r'/pos'))
    ven.wait_for_timeout(800)
    aviso = ven.get_by_role('link', name=re.compile(r'Pedidos de clientes \(1\)'))
    ok('Ventas: la cabecera avisa que hay 1 pedido por confirmar', aviso.count() == 1)
    ven.goto(BASE + '/pos/pedidos')
    pedido = ven.locator('.tarjeta-pedido', has_text=f'Pedido #{numero}')
    expect(pedido).to_be_visible()
    ok('Bandeja: muestra cliente, correo y la nota', 'Camila' in pedido.inner_text() and CLIENTE in pedido.inner_text() and 'Paso el viernes' in pedido.inner_text())
    ven.screenshot(path=f'{CAP}/04-bandeja-pendientes.png', full_page=True)

    # Lo apartado se ve en el punto de venta
    ven.goto(BASE + '/pos')
    ven.get_by_label('Buscar productos para la venta').fill('kiwi')
    ven.wait_for_timeout(800)
    ok('Punto de venta: muestra las unidades apartadas', ven.get_by_text('2 apartadas en pedidos').count() >= 1)

    ven.goto(BASE + '/pos/pedidos')
    ven.locator('.tarjeta-pedido', has_text=f'Pedido #{numero}').get_by_role('button', name='Confirmar').click()
    ven.get_by_role('dialog').get_by_role('button', name='Sí, confirmar').click()
    expect(ven.get_by_text(f'Pedido #{numero} confirmado')).to_be_visible()
    ok('Confirmar: toast y aviso por correo al cliente', any('está confirmado' in b for b in bloques(CLIENTE)))
    ven.get_by_role('tab', name=re.compile('Listos para recoger')).click()
    listo = ven.locator('.tarjeta-pedido', has_text=f'Pedido #{numero}')
    expect(listo).to_contain_text('Listo para recoger')
    listo.get_by_role('button', name='Entregar y cobrar').click()
    ven.get_by_role('dialog').get_by_role('button', name='Entregado y cobrado').click()
    toast = ven.get_by_text(re.compile(f'Pedido #{numero} entregado. Se registró la venta #'))
    expect(toast).to_be_visible()
    ok('Entregar y cobrar: registra la venta', True)
    ven.get_by_role('tab', name='Historial').click()
    expect(ven.locator('.tarjeta-pedido', has_text=f'Pedido #{numero}')).to_contain_text('Entregado')
    ven.screenshot(path=f'{CAP}/05-bandeja-historial.png', full_page=True)

    # ---------- Cliente ve el resultado ----------
    cli.goto(BASE + '/cliente/pedidos')
    expect(cli.locator('.tarjeta-pedido', has_text=f'Pedido #{numero}')).to_contain_text('Entregado')
    cli.get_by_role('tab', name='Mis compras').click()
    cli.wait_for_url(BASE + '/cliente')
    expect(cli.locator('tbody tr')).not_to_have_count(0)
    ok('Cliente: el pedido entregado aparece en "Mis compras"', True)

    # ---------- Rechazar con motivo ----------
    cli.goto(BASE + '/catalogo')
    cli.get_by_role('button', name='Agregar Flor tejida en maceta al pedido').click()
    cli.goto(BASE + '/pedido')
    cli.get_by_role('button', name='Enviar pedido').click()
    cli.wait_for_url(BASE + '/cliente/pedidos')
    segundo = re.search(r'#(\d+)', cli.locator('.tarjeta-pedido').first.locator('h3').inner_text()).group(1)
    ven.goto(BASE + '/pos/pedidos')
    ven.locator('.tarjeta-pedido', has_text=f'Pedido #{segundo}').get_by_role('button', name='Rechazar').click()
    boton = ven.get_by_role('dialog').get_by_role('button', name='Rechazar pedido')
    ok('Rechazar: el botón espera a que se escriba el motivo', boton.is_disabled())
    ven.get_by_label(re.compile('Motivo para el cliente')).fill('La maceta se quebró')
    boton.click()
    expect(ven.get_by_text(f'Pedido #{segundo} rechazado')).to_be_visible()
    cli.reload()
    expect(cli.locator('.tarjeta-pedido', has_text=f'Pedido #{segundo}')).to_contain_text('Motivo: La maceta se quebró')
    ok('Cliente: ve "Rechazado" con el motivo', True)

    # ---------- El cliente cancela ----------
    cli.goto(BASE + '/catalogo')
    cli.get_by_role('button', name='Agregar Llavero Minion al pedido').click()
    cli.goto(BASE + '/pedido')
    cli.get_by_role('button', name='Enviar pedido').click()
    cli.wait_for_url(BASE + '/cliente/pedidos')
    cli.get_by_role('button', name='Cancelar pedido').first.click()
    cli.get_by_role('dialog').get_by_role('button', name='Sí, cancelar').click()
    expect(cli.get_by_text(re.compile(r'cancelado\. Las unidades se liberaron'))).to_be_visible()
    ok('Cliente: cancela su pedido y se liberan las unidades', True)
    cli.screenshot(path=f'{CAP}/06-mis-pedidos-historial.png', full_page=True)

    # ---------- Celular ----------
    m = nav.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True).new_page()
    vigilar(m)
    m.goto(BASE + '/catalogo')
    m.get_by_role('button', name='Agregar Peluche tortuga al pedido').click()
    m.get_by_role('button', name='Agregar Mini llaveros de acrílico al pedido').click()
    m.goto(BASE + '/pedido')
    m.wait_for_timeout(500)
    ancho = m.evaluate('document.documentElement.scrollWidth')
    ok('Celular: "Mi pedido" no se desborda', ancho <= 392, str(ancho))
    m.screenshot(path=f'{CAP}/07-celular-mi-pedido.png', full_page=True)

    ok('Sin errores en la consola del navegador', not consola, ' | '.join(consola[:3]))
    nav.close()

fallas = [n for n, c in res if not c]
print(f'\n{len(res) - len(fallas)}/{len(res)} comprobaciones correctas')
sys.exit(1 if fallas else 0)
