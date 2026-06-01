// aiManager.js - Gestor de ciclo de vida del Web Worker e inactividad de la IA

let worker = null;
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos (300,000 ms)

// Terminar el worker y liberar RAM
export const terminateAI = () => {
  if (worker) {
    worker.terminate();
    worker = null;
    console.log('🧠 IA Local: Web Worker destruido y memoria RAM liberada con éxito.');
  }
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
};

// Reiniciar el temporizador de inactividad para liberación de RAM
const resetInactivityTimer = () => {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  inactivityTimer = setTimeout(() => {
    console.log('🧠 IA Local: 5 minutos de inactividad detectados. Auto-liberando memoria RAM del modelo...');
    terminateAI();
  }, INACTIVITY_TIMEOUT);
};

// Obtener o instanciar el Web Worker de manera perezosa (Lazy Loading)
export const getAIWorker = (onMessageCallback, onErrorCallback) => {
  resetInactivityTimer();

  if (!worker) {
    console.log('🧠 IA Local: Instanciando Web Worker (Lazy Loading)...');
    
    // Sintaxis estándar de Vite para cargar Workers usando ES Modules
    worker = new Worker(new URL('./aiWorker.js', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (event) => {
      resetInactivityTimer(); // Reiniciar timer ante cualquier actividad
      if (onMessageCallback) {
        onMessageCallback(event.data);
      }
    };

    worker.onerror = (err) => {
      console.error('🧠 IA Local: Error fatal en Web Worker:', err);
      if (onErrorCallback) {
        onErrorCallback(err);
      }
    };
  } else {
    // Si ya existe, refrescar los callbacks para la nueva llamada
    worker.onmessage = (event) => {
      resetInactivityTimer();
      if (onMessageCallback) {
        onMessageCallback(event.data);
      }
    };
  }

  return worker;
};

// Enviar una tarea de inferencia al Worker de forma segura
export const runAITask = (type, text, data = {}, onMessage, onError) => {
  try {
    const selectedModel = localStorage.getItem('aiModelSelected') || 'Xenova/LaMini-Flan-T5-248M';

    if (selectedModel === 'desactivado') {
      console.warn('🧠 IA Local: La inferencia local está desactivada en ajustes.');
      if (onError) {
        onError(new Error('La IA Local está desactivada en los Ajustes de la aplicación. Actívala en la pestaña Configuración para usar esta función.'));
      }
      return;
    }

    const activeWorker = getAIWorker(onMessage, onError);
    activeWorker.postMessage({ type, text, data, modelId: selectedModel });
  } catch (err) {
    console.error('🧠 IA Local: Error al disparar la tarea en el Worker:', err);
    if (onError) onError(err);
  }
};
