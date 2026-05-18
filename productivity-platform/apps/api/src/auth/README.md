# 🔐 Módulo de Autenticación - Microsoft OAuth

## Descripción

Módulo completo de autenticación utilizando **Microsoft Identity Platform** (OAuth 2.0 / OpenID Connect). Permite a los usuarios iniciar sesión con sus cuentas de Microsoft (Outlook, Hotmail, Office 365, Azure AD).

## Características

- ✅ Login con Microsoft OAuth 2.0
- ✅ Creación automática de usuarios
- ✅ Vinculación de cuentas existentes
- ✅ Gestión de tokens (access + refresh)
- ✅ Refresh automático de tokens de Outlook
- ✅ JWT para sesiones de la aplicación
- ✅ Perfil completo del usuario
- ✅ Estado de conexión con Outlook

## 📋 Requisitos Previos

### 1. Registro en Azure Portal

1. Ir a [Azure Portal](https://portal.azure.com)
2. Navegar a **Azure Active Directory** → **App registrations**
3. Click en **New registration**
4. Configurar:
   - **Name**: `Productivity Platform`
   - **Supported account types**: `Accounts in any organizational directory and personal Microsoft accounts`
   - **Redirect URI**: `Web` → `http://localhost:3001/auth/microsoft/callback`

5. Después de crear, obtener:
   - **Application (client) ID** → `MICROSOFT_CLIENT_ID`
   - **Directory (tenant) ID** → `MICROSOFT_TENANT_ID` (opcional, usar 'common' si es multi-tenant)

6. Generar client secret:
   - Ir a **Certificates & secrets**
   - **New client secret**
   - Copiar el valor inmediatamente → `MICROSOFT_CLIENT_SECRET`

7. Configurar permisos API:
   - Ir a **API permissions**
   - **Add a permission** → **Microsoft Graph**
   - Seleccionar **Delegated permissions**:
     - `User.Read` - Leer perfil del usuario
     - `Calendars.ReadWrite` - Leer/escribir eventos de calendario
     - `offline_access` - Mantener acceso a datos (refresh token)

### 2. Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```bash
# Microsoft OAuth Configuration
MICROSOFT_CLIENT_ID="tu-client-id-aqui"
MICROSOFT_CLIENT_SECRET="tu-client-secret-aqui"
MICROSOFT_TENANT_ID="common"
MICROSOFT_REDIRECT_URI="http://localhost:3001/auth/microsoft/callback"
MICROSOFT_SCOPES="User.Read,Calendars.ReadWrite,offline_access"
MICROSOFT_GRAPH_API_VERSION="v1.0"

# JWT Configuration
JWT_SECRET="tu-secreto-super-seguro-cambiar-en-produccion"
JWT_EXPIRES_IN="7d"
REFRESH_TOKEN_EXPIRES_IN="30d"

# Application Configuration
FRONTEND_URL="http://localhost:3000"
PORT=3001
```

## 🚀 Endpoints Disponibles

### 1. Iniciar Autenticación

```http
GET /auth/microsoft
```

**Descripción**: Redirige al usuario a la página de login de Microsoft.

**Respuesta**: Redirect 302 a Microsoft

**Ejemplo de uso**:
```
https://api.productivity-platform.com/auth/microsoft
```

---

### 2. Callback de Microsoft

```http
GET /auth/microsoft/callback
```

**Descripción**: Endpoint de callback que recibe la respuesta de Microsoft.

**Respuesta**: Redirect 302 al frontend con tokens en hash fragment

**Formato de redirect**:
```
http://localhost:3000/auth/callback#access_token=xxx&refresh_token=yyy&expires_in=604800&token_type=Bearer&user_id=uuid&email=user@example.com
```

---

### 3. Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Respuesta exitosa**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800,
  "tokenType": "Bearer"
}
```

---

### 4. Obtener Perfil del Usuario

```http
GET /auth/me
Authorization: Bearer {access_token}
```

**Respuesta exitosa**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Juan Pérez",
    "avatarUrl": "https://...",
    "microsoftId": "microsoft-id",
    "timezone": "America/Mexico_City",
    "role": "USER",
    "settings": {},
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "projects": [...],
    "outlookTokens": [...]
  }
}
```

---

### 5. Logout

```http
POST /auth/logout
Authorization: Bearer {access_token}
```

**Respuesta**:
```json
{
  "success": true,
  "message": "Sesión cerrada correctamente"
}
```

---

### 6. Estado de Conexión con Outlook

```http
GET /auth/outlook/status
Authorization: Bearer {access_token}
```

**Respuesta**:
```json
{
  "success": true,
  "connected": true,
  "expiresAt": "2024-12-31T23:59:59Z",
  "scopes": ["User.Read", "Calendars.ReadWrite", "offline_access"],
  "isExpired": false
}
```

## 🏗️ Arquitectura del Módulo

```
src/auth/
├── auth.module.ts              # Módulo NestJS
├── auth.controller.ts          # Controlador de endpoints
├── auth.service.ts             # Lógica de negocio
├── dto/
│   ├── auth.dto.ts             # DTOs para requests
│   └── token-payload.dto.ts    # DTOs para respuestas
├── guards/
│   ├── jwt-auth.guard.ts       # Guard para JWT
│   └── microsoft-auth.guard.ts # Guard para Microsoft OAuth
└── strategies/
    ├── jwt.strategy.ts         # Estrategia Passport JWT
    └── microsoft.strategy.ts   # Estrategia Passport Microsoft
```

## 🔄 Flujo de Autenticación

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ 1. Click en "Login con Microsoft"
       ▼
┌─────────────────┐
│  Frontend (React) │
└──────┬──────────┘
       │ 2. Redirige a /auth/microsoft
       ▼
┌─────────────────────┐
│  Backend (NestJS)    │
│  MicrosoftAuthGuard  │
└──────┬──────────────┘
       │ 3. Redirige a Microsoft Login
       ▼
┌─────────────────────┐
│  Microsoft Identity  │
│  Platform            │
└──────┬──────────────┘
       │ 4. Usuario autentica
       │ 5. Microsoft redirige a callback con code
       ▼
┌─────────────────────┐
│  Backend (NestJS)    │
│  microsoft.callback  │
│  - Intercambia code por tokens
│  - Crea/actualiza usuario
│  - Genera JWT tokens
└──────┬──────────────┘
       │ 6. Redirige a frontend con tokens en hash
       ▼
┌─────────────────┐
│  Frontend (React) │
│  - Extrae tokens del hash
│  - Guarda en localStorage/cookies
│  - Actualiza estado de autenticación
└─────────────────┘
```

## 🔒 Seguridad

### Mejores Prácticas Implementadas

1. **Hash Fragment**: Los tokens se pasan en el hash de la URL (#) en lugar de query params, ya que el hash no se envía al servidor.

2. **Refresh Tokens**: Los access tokens tienen expiración corta (7 días) y se refrescan automáticamente.

3. **Outlook Token Refresh**: Los tokens de Outlook se refrescan automáticamente 5 minutos antes de expirar.

4. **Validación de Email**: Se valida y normaliza el email (lowercase, trim).

5. **Transacciones DB**: La creación de usuarios usa transacciones para consistencia.

### Pendientes para Producción

- [ ] Implementar blacklist de tokens con Redis
- [ ] Rate limiting en endpoints de auth
- [ ] CSRF protection
- [ ] Cookies httpOnly para tokens
- [ ] 2FA opcional
- [ ] Logging de auditoría

## 🧪 Testing

### Probar el flujo completo:

1. Iniciar servidores:
```bash
npm run docker:up
npm run db:migrate
npm run start:dev
```

2. Abrir navegador en:
```
http://localhost:3001/auth/microsoft
```

3. Autenticar con cuenta Microsoft

4. Verificar redirect a frontend con tokens

5. Probar endpoint protegido:
```bash
curl -H "Authorization: Bearer {access_token}" \
  http://localhost:3001/auth/me
```

## 🛠️ Troubleshooting

### Error: "AADSTS50011: The reply url specified in the request does not match"

**Solución**: Verificar que el redirect URI en Azure Portal coincide exactamente con `MICROSOFT_REDIRECT_URI` en `.env`.

### Error: "No se pudo obtener email del perfil de Microsoft"

**Solución**: Asegurar que el scope `User.Read` está configurado en Azure Portal y fue aprobado por el usuario.

### Error: "Token inválido o expirado"

**Solución**: El access token expiró. Usar el endpoint `/auth/refresh` con el refresh token.

## 📚 Recursos

- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [OAuth 2.0 Authorization Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/api/overview)
- [Passport.js Microsoft Strategy](http://www.passportjs.org/packages/passport-microsoft/)

## 📝 Notas Importantes

1. **Tokens de Outlook**: Se almacenan en la tabla `OutlookToken` y se usan para sincronización con Calendar.

2. **Usuario Nuevo**: Al crear un usuario nuevo, automáticamente se crea un proyecto "Inbox" por defecto.

3. **Vinculación de Cuentas**: Si un usuario con el mismo email ya existe, se vincula la cuenta de Microsoft.

4. **Timezone**: Se extrae automáticamente de la configuración de Outlook del usuario.

---

**Versión**: 1.0.0  
**Última actualización**: 2024  
**Maintainers**: Equipo de Desarrollo
