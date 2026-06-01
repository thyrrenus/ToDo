// aiWorker.js - Hilo secundario para inferencia local de IA
import { pipeline, env } from '@xenova/transformers';

// Habilitar carga de modelos locales y definir la ruta en el servidor de desarrollo
env.allowLocalModels = true;
env.localModelPath = '/models/';

// Redirigir descargas a un mirror de Hugging Face público como fallback
env.remoteHost = 'https://hf-mirror.com';


let textGenerator = null;
let currentModelId = 'Xenova/LaMini-Flan-T5-248M';

// Obtener o instanciar el pipeline del modelo
const getGenerator = async (progressCallback) => {
  if (!textGenerator) {
    textGenerator = await pipeline('text2text-generation', currentModelId, {
      progress_callback: progressCallback
    });
  }
  return textGenerator;
};

// Escuchar peticiones desde el hilo principal de React
self.addEventListener('message', async (event) => {
  const { type, text, data, modelId } = event.data;

  // Si se solicita un modelo distinto, descartar el anterior y cargar el nuevo
  if (modelId && modelId !== currentModelId) {
    console.log(`🧠 IA Local: Cambiando modelo de ${currentModelId} a ${modelId}...`);
    currentModelId = modelId;
    textGenerator = null; // Forzar recarga con el nuevo modelo
  }

  // Callback para reportar el progreso de descarga de WebAssembly y el modelo
  const progressCallback = (progressData) => {
    if (progressData.status === 'progress') {
      self.postMessage({
        type: 'progress',
        file: progressData.file,
        progress: progressData.progress,
        loaded: progressData.loaded,
        total: progressData.total
      });
    } else if (progressData.status === 'ready') {
      self.postMessage({
        type: 'ready',
        file: progressData.file
      });
    }
  };

  try {
    if (type === 'breakdown') {
      const generator = await getGenerator(progressCallback);

      const prompt = `Desglosa la tarea "${text}" en 5 subtareas cortas y accionables en español. Lista numerada de 1 a 5:`;

      const result = await generator(prompt, {
        max_new_tokens: 250,
        temperature: 0.3,
        repetition_penalty: 1.2
      });

      self.postMessage({
        type: 'breakdown-result',
        result: result[0].generated_text
      });

    } else if (type === 'classify') {
      const generator = await getGenerator(progressCallback);

      const prompt = `Clasifica la tarea "${text}" (Descripción: "${data || ''}") en una de estas 4 categorías de la Matriz de Eisenhower: "Urgente e Importante", "Importante pero No Urgente", "Urgente pero No Importante", "No Urgente y No Importante". Respuesta:`;

      const result = await generator(prompt, {
        max_new_tokens: 30,
        temperature: 0.1
      });

      const resultText = result[0].generated_text.trim();
      
      // Mapeo difuso para garantizar que devuelva ÚNICAMENTE uno de los 4 strings exactos de la Matriz
      let matchedCategory = "Importante pero No Urgente"; // Q2 por defecto
      const lower = resultText.toLowerCase();
      
      if (lower.includes("urgente") && lower.includes("importante") && !lower.includes("no urgente") && !lower.includes("no importante")) {
        matchedCategory = "Urgente e Importante";
      } else if (lower.includes("importante") && (lower.includes("no urgente") || lower.includes("pero no urgente") || lower.includes("no es urgente"))) {
        matchedCategory = "Importante pero No Urgente";
      } else if (lower.includes("urgente") && (lower.includes("no importante") || lower.includes("pero no importante") || lower.includes("no es importante"))) {
        matchedCategory = "Urgente pero No Importante";
      } else if (lower.includes("no urgente") && lower.includes("no importante")) {
        matchedCategory = "No Urgente y No Importante";
      } else {
        // Búsqueda simplificada secundaria en caso de respuestas cortas
        if (lower.includes("urgente") && !lower.includes("no urgente") && !lower.includes("no importante")) {
          matchedCategory = "Urgente e Importante";
        } else if (lower.includes("importante") && !lower.includes("no importante") && !lower.includes("no urgente")) {
          matchedCategory = "Importante pero No Urgente";
        } else if (lower.includes("no urgente") || lower.includes("no importante")) {
          matchedCategory = "No Urgente y No Importante";
        }
      }

      self.postMessage({
        type: 'classify-result',
        result: matchedCategory
      });

    } else if (type === 'coach') {
      const generator = await getGenerator(progressCallback);

      const prompt = `Escribe 3 consejos de productividad cortos en español para Carlos que completó ${data.completed} tareas, tiene ${data.pending} pendientes, ${data.overdue} retrasadas y ${data.pomodoros} pomodoros esta semana.

1.`;

      const result = await generator(prompt, {
        max_new_tokens: 220,
        temperature: 0.35,
        repetition_penalty: 1.3
      });

      self.postMessage({
        type: 'coach-result',
        result: '1. ' + result[0].generated_text.trim()
      });
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err.message
    });
  }
});
