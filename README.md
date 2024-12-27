# 🕷️ ScrappyDoo - Scraper Web Avanzado

## 📋 Descripción
ScrappyDoo es un scraper web potente y flexible construido en Node.js, diseñado para extraer datos de sitios web dinámicos con características avanzadas anti-detección y alto rendimiento.

## ⭐ Características Principales
- 🔄 Rotación automática de proxies
- 👤 Rotación de User-Agents
- 🤖 Resolución automática de CAPTCHA
- 📊 Sistema de colas para scraping masivo
- 🛡️ Mecanismos anti-bloqueo
- 📦 Almacenamiento en MongoDB
- 📝 Logging detallado

## 🚀 Instalación

### Prerrequisitos
- Node.js >= 20.0.0
- MongoDB
- Redis

### Pasos de Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tuusuario/scrappy-doo.git

# Entrar al directorio
cd scrappy-doo

# Instalar dependencias
npm install

# Instalar navegador de Playwright
npx playwright install chromium
```

### Configuración
1. Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```

2. Configura las variables de entorno en el archivo `.env`:
```plaintext
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
MONGODB_URI=mongodb://127.0.0.1:27017/scrappy-doo
CAPTCHA_API_KEY=tu_api_key_2captcha

# Configuraciones de seguridad
NODE_ENV=production
RATE_LIMIT=100
CONCURRENT_SCRAPES=5
RETRY_ATTEMPTS=3
DELAY_BETWEEN_REQUESTS=2000
```

## 🚀 Uso

```bash
# Iniciar el scraper
npm start

# Modo desarrollo
npm run dev
```

## 📦 Estructura del Proyecto
```
scrappy-doo/
├── config/                  # Archivos de configuración
│   ├── proxies.json        # Lista de proxies
│   └── user-agents.json    # User agents
├── src/
│   ├── core/               # Funcionalidad principal
│   ├── scrapers/           # Scrapers específicos
│   ├── utils/              # Utilidades
│   └── database/           # Capa de datos
├── .env                    # Variables de entorno
└── package.json
```

## 🛠️ Tecnologías Utilizadas
- Node.js
- Playwright
- MongoDB
- Redis
- Bull (sistema de colas)
- Winston (logging)

- `POST /api/scrape`: Encolar nuevos trabajos de scraping
- `GET /api/jobs/:jobId`: Obtener estado de un trabajo
- `GET /api/jobs`: Listar todos los trabajos
- `POST /api/jobs/:jobId/retry`: Reintentar trabajo fallido
- `DELETE /api/jobs/:jobId`: Cancelar trabajo

### Ajustes de Rate Limiting
Modifica las siguientes variables en `.env`:
- `RATE_LIMIT`: Peticiones por minuto
- `CONCURRENT_SCRAPES`: Scrapes simultáneos
- `DELAY_BETWEEN_REQUESTS`: Delay entre peticiones (ms)

### Configuración de Proxies
- Añade más proxies en `config/proxies.json`
- El sistema rotará automáticamente entre ellos
- Los proxies bloqueados se marcan automáticamente

## 🤝 Contribuir
Las contribuciones son bienvenidas. Por favor, lee `CONTRIBUTING.md` para detalles sobre nuestro código de conducta y el proceso para enviarnos pull requests.

## 📄 Licencia
Este proyecto está bajo la Licencia MIT - ver el archivo `LICENSE` para más detalles.

## ⚠️ Aviso Legal
Este scraper debe usarse de manera ética y legal, respetando los términos de servicio de los sitios web y las leyes de protección de datos aplicables.

## 🔌 Integración con n8n

### Configuración
1. Configura las variables de n8n en `.env`:
```plaintext
N8N_WEBHOOK_URL=http://localhost:5678/webhook/scrappy-doo
N8N_API_KEY=tu_n8n_api_key
N8N_EVENTS_WEBHOOK=http://localhost:5678/webhook/scrappy-events
```

### Eventos Disponibles
- `job_created`: Cuando se crea un nuevo trabajo
- `job_completed`: Cuando un trabajo se completa exitosamente
- `job_failed`: Cuando un trabajo falla
- `job_stalled`: Cuando un trabajo se estanca

### Ejemplo de Workflow
1. Crear un nodo "Webhook" en n8n
2. Configurar la URL y la API key
3. Procesar los datos recibidos según necesidad
