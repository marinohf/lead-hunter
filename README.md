# Lead Hunter

Lead Hunter es una herramienta ligera pero potente para capturar y gestionar leads con una interfaz premium y capacidades de integración con WhatsApp.

## ✨ Características

- 📝 Capturar nuevos leads desde un formulario intuitivo
- 📊 Dashboard con estadísticas en tiempo real
- 🔍 Búsqueda y filtrado avanzado por estado
- 📱 Integración con WhatsApp Business API
- 💾 Almacenamiento local en JSON (fácil de migrar a BD)
- 🎨 Interfaz premium con gradientes y efectos visuales
- 📈 Pipeline de leads con estados personalizables
- ⚡ Rendimiento rápido y responsive

## 🚀 Tech Stack

- Node.js + Express
- Vanilla JavaScript + HTML + CSS
- WhatsApp Business API (opcional)
- JSON storage (base de datos)

## 📦 Instalación

1. Clona o descarga el repositorio
2. Instala dependencias:

   ```bash
   npm install
   ```

3. (Opcional) Configura WhatsApp Business API:

   ```bash
   export WHATSAPP_TOKEN="tu_token_aqui"
   export WHATSAPP_PHONE_ID="tu_phone_id_aqui"
   ```

4. Inicia la aplicación:

   ```bash
   npm start
   ```

5. Abre http://localhost:3000

## 📱 Configuración de WhatsApp

Para habilitar el envío de mensajes por WhatsApp:

1. Crea una app en [Meta for Developers](https://developers.facebook.com)
2. Configura WhatsApp Business API
3. Obtén tu token y phone ID
4. Establece las variables de entorno `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`

## 📁 Estructura del Proyecto

```text
.
├── data/
│   └── leads.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## 🔌 API Endpoints

### Leads
- `GET /api/leads` - Listar leads (con filtros)
- `GET /api/leads/:id` - Obtener un lead
- `POST /api/leads` - Crear nuevo lead
- `PATCH /api/leads/:id` - Actualizar lead
- `POST /api/leads/:id/send-whatsapp` - Enviar mensaje por WhatsApp

### Stats
- `GET /api/stats` - Obtener estadísticas
- `GET /api/config` - Obtener configuración

## 🎯 Próximas Mejoras

- [ ] Migración a base de datos (PostgreSQL/SQLite)
- [ ] Autenticación y multi-usuario
- [ ] Exportar leads a CSV/Excel
- [ ] Integración con Zapier/Make
- [ ] Plantillas de mensajes personalizables
- [ ] Análisis y reportes
- [ ] Webhook para formularios externos

## 📄 Licencia

MIT
