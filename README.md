# 🕷️ ScrappyDoo - Scraper Web Avanzado

## 📋 Descripción
ScrappyDoo es un scraper web potente y flexible construido en Node.js, diseñado para extraer y analizar datos de productos y servicios en múltiples marketplaces. Ideal para análisis de mercado, monitoreo de precios y estudio de competencia.

## ⭐ Características Principales
- 🔍 Búsqueda personalizada de cualquier producto o servicio
- 📊 Análisis de precios en múltiples marketplaces
- 📈 Análisis de competencia y tendencias
- 🤖 Resolución automática de CAPTCHA
- 🔄 Rotación automática de proxies y User-Agents
- 🛡️ Mecanismos anti-bloqueo avanzados
- 📦 Almacenamiento en MongoDB
- 🚀 Sistema de colas con Redis

## 🚀 Instalación

### Prerrequisitos
- Node.js >= 20.0.0
- MongoDB
- Redis
- Git

### Pasos de Instalación

```bash
# Clonar el repositorio
git clone https://github.com/RicochetDeveloper/scrappy-doo.git

# Entrar al directorio
cd scrappy-doo

# Instalar dependencias
npm install

# Configurar el entorno
cp .env.example .env

# Instalar navegador de Playwright
npx playwright install chromium
```

### Configuración Rápida
1. Configura las variables de entorno en `.env`:
```plaintext
# Bases de datos
MONGODB_URI=mongodb://localhost:27017/scrappy-doo
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# API y Seguridad
API_PORT=3030
API_KEY=tu_api_key_aqui
CAPTCHA_API_KEY=tu_api_key_2captcha

# Configuración de Scraping
CONCURRENT_SCRAPES=5
DELAY_BETWEEN_REQUESTS=2000
```

## 🎯 Uso Rápido

### Análisis de Mercado
```bash
# Analizar cualquier producto o servicio
node src/tests/full-analysis-test.js "término de búsqueda"

# Ejemplos:
node src/tests/full-analysis-test.js "laptop gaming"
node src/tests/full-analysis-test.js "zapatillas running"
node src/tests/full-analysis-test.js "smartwatch"
```

### API REST
```bash
# Iniciar el servidor API
npm start

# Modo desarrollo con recarga automática
npm run dev
```

### Endpoints Principales
- `POST /api/scrape`: Iniciar análisis de productos
- `GET /api/jobs/:jobId`: Consultar estado de análisis
- `GET /api/jobs`: Listar todos los análisis

## 📊 Ejemplo de Respuesta
```json
{
  "marketplace": "amazon",
  "product": {
    "title": "Laptop Gaming XYZ",
    "price": "999.99",
    "link": "https://..."
  },
  "analysis": {
    "market": {
      "position": "COMPETITIVO",
      "trend": "CRECIENTE"
    },
    "competition": {
      "level": "MEDIA",
      "competitors": 8
    },
    "recommendations": [
      "Monitorear precios semanalmente",
      "Destacar características únicas"
    ]
  }
}
```

## 🛠️ Desarrollo

### Estructura del Proyecto
```
scrappy-doo/
├── src/
│   ├── api/          # API REST
│   ├── core/         # Lógica principal
│   ├── scrapers/     # Scrapers específicos
│   ├── services/     # Servicios de análisis
│   └── utils/        # Utilidades
├── config/           # Configuraciones
└── tests/           # Pruebas
```

### Comandos de Desarrollo
```bash
# Pruebas
npm test

# Lint
npm run lint

# Build
npm run build
```

## 🤝 Contribuir
¡Las contribuciones son bienvenidas! Por favor, lee [CONTRIBUTING.md](CONTRIBUTING.md) para detalles sobre nuestro proceso de pull requests.

## 📄 Licencia
Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## ⚠️ Aviso Legal
Este software debe usarse de manera ética y legal, respetando los términos de servicio de los sitios web y las leyes de protección de datos aplicables.

## 🔌 Enlaces
- [Documentación Completa](https://github.com/RicochetDeveloper/scrappy-doo/wiki)
- [Reporte de Bugs](https://github.com/RicochetDeveloper/scrappy-doo/issues)
- [Changelog](CHANGELOG.md)
