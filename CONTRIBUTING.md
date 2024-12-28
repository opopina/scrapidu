# 🤝 Guía de Contribución

## 🌟 ¿Cómo Contribuir?

1. **Fork y Clone**
   ```bash
   # Fork usando GitHub y luego:
   git clone https://github.com/TU_USUARIO/scrappy-doo.git
   cd scrappy-doo
   ```

2. **Crear Rama**
   ```bash
   # Crear rama para tu feature
   git checkout -b feature/nombre-descriptivo
   # o para un fix
   git checkout -b fix/nombre-descriptivo
   ```

3. **Desarrollar**
   - Escribe código limpio y mantenible
   - Sigue las convenciones de estilo
   - Añade pruebas para nuevas funcionalidades
   - Actualiza la documentación si es necesario

4. **Commit**
   ```bash
   git add .
   git commit -m "feat: descripción corta del cambio"
   ```
   
   Tipos de commit:
   - `feat`: Nueva característica
   - `fix`: Corrección de bug
   - `docs`: Cambios en documentación
   - `style`: Cambios de formato
   - `refactor`: Refactorización de código
   - `test`: Añadir o modificar pruebas
   - `chore`: Tareas de mantenimiento

5. **Push y Pull Request**
   ```bash
   git push origin feature/nombre-descriptivo
   ```
   Luego crea un Pull Request en GitHub.

## 📝 Convenciones de Código

### Estilo
- Usa 2 espacios para indentación
- Punto y coma al final de cada declaración
- Usa comillas simples para strings
- Nombra variables y funciones en camelCase
- Nombra clases en PascalCase
- Archivos en kebab-case.js

### Ejemplo
```javascript
class ProductScraper {
  constructor() {
    this.config = {
      timeout: 5000,
      retries: 3
    };
  }

  async scrapeProduct(url) {
    try {
      // Implementación
    } catch (error) {
      logger.error('Error:', error);
      throw error;
    }
  }
}
```

### Documentación
- Documenta todas las funciones públicas
- Usa JSDoc para documentación de código
- Mantén el README actualizado
- Añade ejemplos de uso cuando sea posible

## 🧪 Pruebas

### Ejecutar Pruebas
```bash
# Todas las pruebas
npm test

# Pruebas específicas
npm test -- src/tests/scraper-tests.js
```

### Escribir Pruebas
```javascript
describe('ProductScraper', () => {
  it('debe extraer correctamente el precio', async () => {
    const scraper = new ProductScraper();
    const result = await scraper.scrapeProduct(testUrl);
    expect(result.price).toBeDefined();
  });
});
```

## 🔍 Revisión de Código

Tu PR será revisado considerando:
- ✨ Calidad del código
- 🧪 Cobertura de pruebas
- 📝 Documentación
- 🎯 Impacto en el rendimiento
- 🔒 Seguridad

## ⚠️ Buenas Prácticas

### Scraping
- Implementa delays entre requests
- Usa User-Agents aleatorios
- Respeta robots.txt
- Implementa manejo de errores robusto
- Usa proxies cuando sea necesario

### Seguridad
- No comitees credenciales
- Usa variables de entorno
- Valida input de usuario
- Implementa rate limiting
- Maneja errores de forma segura

## 📋 Checklist PR

- [ ] Código sigue las convenciones de estilo
- [ ] Pruebas añadidas/actualizadas
- [ ] Documentación actualizada
- [ ] Cambios probados localmente
- [ ] No hay credenciales expuestas
- [ ] Rama actualizada con main

## 🎉 ¡Gracias por Contribuir!

Tu contribución hace que ScrappyDoo sea mejor para todos. Si tienes dudas, no dudes en abrir un issue o preguntar en las discusiones. 