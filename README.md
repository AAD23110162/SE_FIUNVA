**FIUNVA — Sistema Experto Multi-agente para Consultoría Tecnológica**

**Resumen:**
- **Objetivo:** Desarrollar un sistema experto moderno basado en agentes inteligentes capaces de interactuar con clientes, realizar inferencias y automatizar procesos de venta o soporte mediante IA para proyectos de electrónica, software y robótica.

**Alcance e Integraciones:**
- **Incluye:** Ingeniería del conocimiento, sistemas expertos, motores de inferencia, bases de datos, agentes inteligentes, IA moderna, explicabilidad del razonamiento y arquitectura cliente-servidor o local.

**Requerimientos Generales:**
- **Ejecución local:** El proyecto debe poder ejecutarse de forma LOCAL en una computadora personal.
- **Herramientas permitidas (ejemplos):** Python, FastAPI, Flask, Streamlit, Gradio, SQLite, MongoDB Atlas, Supabase, Ollama, LangChain, CrewAI, OpenRouter, HuggingFace, Gemini API.

**Arquitectura Recomendada:**
- **Descripción:** Sistema multi-agente con al menos 3 agentes colaborando entre sí y una base de datos central para persistencia.
- **Agentes mínimos obligatorios:**
  - **Agente 1 — Atención al Cliente:**
    - **Funcionalidad:** Leer mensajes de clientes, detectar intención, extraer información relevante y responder automáticamente.
    - **Ejemplo:** Cliente: “Hola, necesito 3 motores NEMA17 y 2 drivers.” → El agente debe interpretar cantidad, producto y posibles aclaraciones.

  - **Agente 2 — Generador de Pedido:**
    - **Funcionalidad:** Procesar la información recibida, validar datos, realizar inferencias (reglas), generar el pedido y guardar en la base de datos.
    - **Ejemplo de regla:** IF stock < cantidad_solicitada THEN sugerir reabastecimiento.

  - **Agente 3 — Supervisor / Explicador:**
    - **Funcionalidad:** Generar resumen de la venta, explicar decisiones e inferencias realizadas y solicitar validación final al usuario o operador.
    - **Ejemplo:** “Se detectó que el cliente solicitó 3 motores NEMA17. Existe stock suficiente. Se aplicó descuento por cliente frecuente.”

**Tema del Proyecto:**
- **Áreas sugeridas (no limitadas):** Ventas, diagnóstico, atención al cliente, soporte técnico, mantenimiento, medicina, automatización, educación, robótica, electrónica, mecatrónica.

**Plataformas de Integración:**
- Telegram, WhatsApp, Instagram, Facebook Messenger, Discord, página web con chatbot, aplicación Android/iOS.

**Base de Datos:**
- **Requisito:** El sistema DEBE conectarse a una base de datos.
- **Opciones sugeridas:** SQLite, PostgreSQL, MongoDB, Firebase, Supabase.
- **Fuentes de datos permitidas:** Datasets descargados, HuggingFace, Kaggle.

**Requisito IMPORTANTE — GitHub:**
- **Obligatorio:** Subir el trabajo continuamente a GitHub con commits diarios y evidencia del desarrollo.
- **No se aceptará:** Repositorios con un solo commit, commits masivos al final o repositorios vacíos. El historial será parte de la evaluación.

**Entregables (obligatorios):**
- **1. Repositorio GitHub:** Código fuente, README (actual), instrucciones básicas y evidencia continua del desarrollo.
- **2. Documento PDF:** Nombre: `GG_registro_Proy.pdf`. Debe incluir: portada, objetivo, descripción del sistema, arquitectura, base de conocimiento, inferencias utilizadas, explicación de agentes, capturas del sistema, base de datos utilizada, herramientas usadas y conclusiones.
- **3. Manual de Usuario:** Incluir dentro del PDF un manual completo con instrucciones para instalar, configurar dependencias, ejecutar agentes, conectar base de datos, ejecutar inferencias y uso del sistema. Debe ser replicable desde cero.
- **4. Video demostrativo:** Subir a YouTube mostrando el proyecto, agregar enlace dentro del PDF.
- **5. Prototipado UI (entrega posterior):** Diseño UI/UX, prototipo, flujo de interacción, mockups o implementación visual.

**Requisitos Técnicos Mínimos (a demostrar):**
- Conexión a base de datos.
- Inferencias y reglas demostrables.
- Explicabilidad del razonamiento (registro/explicaciones generadas por el agente supervisor).
- Interacción usuario-sistema (chatbot o UI).
- Arquitectura funcional (cliente-servidor o local).

**Sugerencia de Stack Inicial (ejemplo práctico):**
- **Backend / Agentes:** Python, FastAPI (API + agentes) o Flask.
- **Interfaz ligera:** Streamlit o Gradio para demo local; opcionalmente frontend web + WebSocket.
- **Persistencia:** SQLite para prototipos locales; PostgreSQL o MongoDB para despliegue más completo.
- **IA / Razonamiento:** LangChain + modelos locales o APIs (Ollama, OpenRouter, HuggingFace, Gemini API). Implementar motor de inferencia con reglas explicitas o con un sistema híbrido (reglas + LLM para NLU).

**Estructura recomendada del repositorio:**
- **/src:** Código fuente de agentes y servicios.
- **/data:** Esquemas y dumps de bases de datos o datasets.
- **/docs:** Documento `GG_registro_Proy.pdf`, manual y capturas.
- **/notebooks:** Pruebas exploratorias o notebooks de experimentación.
- **/ui:** Prototipos Streamlit/Gradio o frontend web.
- **requirements.txt / pyproject.toml:** Dependencias.

**Guía rápida para ejecutar local (resumen):**
1. Clonar repo y crear entorno virtual:

```bash
git clone <repo-url>
cd <repo>
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Inicializar base de datos (ejemplo SQLite):

```bash
python src/scripts/init_db.py  # Script que crea tablas y datos iniciales
```

3. Levantar servidor / agentes:

```bash
uvicorn src.main:app --reload  # Si se usa FastAPI
streamlit run ui/app.py        # Si se usa Streamlit para demo
```

4. Probar flujo: enviar mensaje de cliente → Agente Atención procesa → Generador crea pedido → Supervisor explica y valida.

**Evidencia y evaluación:**
- Mantener commits diarios con mensajes claros.
- Adjuntar capturas e historial de trabajo dentro de `docs/GG_registro_Proy.pdf`.
- Subir el video demostrativo y añadir el enlace en el PDF.

**Criterios de evaluación (orientativos):**
- Funcionamiento local reproducible.
- Presencia de inferencias y reglas demostradas.
- Explicabilidad coherente y trazable.
- Integración con una base de datos real.
- Historial de GitHub con progreso real.

**Siguientes pasos sugeridos:**
- Definir tema final del proyecto (ventas, diagnóstico, soporte, etc.).
- Elegir pila tecnológica definitiva y plantilla inicial.
- Implementar esquema inicial de base de conocimiento y reglas.

**Contacto / Credenciales del Proyecto:**
- Consultoría: FIUNVA — Proyectos de electrónica, software y robótica.
- Repositorio principal: subir continuamente a GitHub siguiendo las reglas de commits.

--

