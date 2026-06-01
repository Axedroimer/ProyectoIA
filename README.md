# IA Finanzas

Proyecto para construir un sistema en Python y Jupyter Notebook que permita registrar, procesar, analizar y predecir comportamientos financieros personales con apoyo de inteligencia artificial.

## Guia principal

La referencia principal del proyecto es el documento [Plan_Trabajo-Miguel_Cuadros-IA_Finanzas.docx](C:/Users/migue/Downloads/IA Finanzas/docs/Plan_Trabajo-Miguel_Cuadros-IA_Finanzas.docx).

## Objetivo general

Desarrollar una base de trabajo que avance en tres etapas:

- construccion y estructuracion del dataset
- ingenieria de caracteristicas y analisis
- desarrollo del modelo de inteligencia artificial

## Estado actual

- Existe un notebook base con la primera propuesta del modelo: [Miguel_Cuadros_IA_Finanzas.ipynb](C:/Users/migue/Downloads/IA Finanzas/Miguel_Cuadros_IA_Finanzas.ipynb)
- La documentacion de Semana 1 ya estaba alineada con el plan de trabajo
- El Sprint 1 ya cuenta con dataset ampliado a 500 registros y un primer modelo multiclase de Machine Learning simple e interpretable

## Estructura del proyecto

- [app-finanzas/index.html](C:/Users/migue/Downloads/IA Finanzas/app-finanzas/index.html): interfaz visual tipo app para anexar CSV, validar datos, ver KPIs, hitos y graficos
- [docs/semana-1-trazo.md](C:/Users/migue/Downloads/IA Finanzas/docs/semana-1-trazo.md): plan operativo de la Semana 1
- [docs/semana-2-trazo.md](C:/Users/migue/Downloads/IA Finanzas/docs/semana-2-trazo.md): cierre integrado de Semana 2, Semana 3 y Sprint 1
- [docs/diccionario-datos-semana-1.md](C:/Users/migue/Downloads/IA Finanzas/docs/diccionario-datos-semana-1.md): definicion de variables y reglas base
- [data/raw/gastos_semana_1.csv](C:/Users/migue/Downloads/IA Finanzas/data/raw/gastos_semana_1.csv): dataset ampliado a 500 registros
- [data/raw/gastos_semana_1_50_backup.csv](C:/Users/migue/Downloads/IA Finanzas/data/raw/gastos_semana_1_50_backup.csv): copia del dataset inicial de 50 registros
- [data/processed/gastos_sprint1_final.csv](C:/Users/migue/Downloads/IA Finanzas/data/processed/gastos_sprint1_final.csv): dataset trabajado final del Sprint 1
- [Miguel_Cuadros_IA_Finanzas_semana2.ipynb](C:/Users/migue/Downloads/IA Finanzas/Miguel_Cuadros_IA_Finanzas_semana2.ipynb): notebook de Semana 2 con Semana 3 integrada
- [Miguel_Cuadros_IA_Finanzas_sprint1_final.ipynb](C:/Users/migue/Downloads/IA Finanzas/Miguel_Cuadros_IA_Finanzas_sprint1_final.ipynb): copia final del Sprint 1
- [data/raw](C:/Users/migue/Downloads/IA Finanzas/data/raw): datos originales
- [data/processed](C:/Users/migue/Downloads/IA Finanzas/data/processed): datos transformados

## Ruta de trabajo

### Semana 1

Construir un dataset estructurado y limpio con las variables `fecha`, `descripcion`, `categoria` y `monto`, normalizar categorias, aplicar pesos y preparar la base para el analisis posterior.

### Semana 2

Generar variables derivadas como `peso_categoria`, `frecuencia`, `porcentaje_categoria`, `alerta_incremento` y `score_financiero`, y entrenar un primer modelo simple para clasificar el tipo de gasto.

### Semana 3

Preparar el dataset final, entrenar un modelo de regresion logistica, evaluarlo y realizar predicciones interpretables.

## Siguiente paso inmediato

Usar [Miguel_Cuadros_IA_Finanzas_sprint1_final.ipynb](C:/Users/migue/Downloads/IA Finanzas/Miguel_Cuadros_IA_Finanzas_sprint1_final.ipynb) para presentar el cierre del Sprint 1 y luego mejorar la clasificacion con mas criterios o datos reales.

## Interfaz visual

La app local se encuentra en [app-finanzas/index.html](C:/Users/migue/Downloads/IA Finanzas/app-finanzas/index.html).

Para abrirla como app local con carga demo automatica:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\migue\Downloads\IA Finanzas\app-finanzas\iniciar_app.ps1"
```

Permite:

- anexar un CSV al dataset activo y validar su estructura
- analizar KPIs principales que cambian con la vista activa
- generar una lectura del sistema segun el CSV cargado
- detectar hitos recientes en movimientos financieros
- interactuar con graficos de categoria, tipos de gasto y evolucion mensual
- filtrar todo el tablero desde la barra lateral por categoria, tipo de gasto y mes
- simular un gasto nuevo con las reglas del Sprint 1
