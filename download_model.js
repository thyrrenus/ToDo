// download_model.js - Descarga los modelos ONNX localmente para ejecutar la IA 100% offline
const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_IDS = [
  'Xenova/LaMini-Flan-T5-783M',
  'Xenova/LaMini-Flan-T5-248M',
  'Xenova/LaMini-Flan-T5-77M'
];
const BASE_URL = 'https://hf-mirror.com'; // Usar el mirror para garantizar descarga sin bloqueos

const files = [
  'config.json',
  'tokenizer_config.json',
  'tokenizer.json',
  'special_tokens_map.json',
  'generation_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx'
];

// Función para descargar un archivo con reintentos y redirecciones
function downloadFile(fileUrl, targetPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(targetPath);
    
    const request = (url) => {
      https.get(url, (response) => {
        // Manejar redirecciones (código 301, 302, 307)
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let nextUrl = response.headers.location;
          if (nextUrl.startsWith('/')) {
            nextUrl = 'https://hf-mirror.com' + nextUrl;
          }
          request(nextUrl);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Fallo en descarga (${response.statusCode}) para ${url}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`✓ Descargado con éxito: ${path.basename(targetPath)}`);
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(targetPath, () => {});
        reject(err);
      });
    };

    request(fileUrl);
  });
}

async function run() {
  console.log(`🧠 Iniciando descarga local de modelos IA offline...\n`);

  for (const modelId of MODEL_IDS) {
    console.log(`--------------------------------------------------`);
    console.log(`📦 Preparando modelo: ${modelId}`);
    console.log(`--------------------------------------------------`);
    
    const targetDir = path.resolve(__dirname, 'frontend', 'public', 'models', modelId);
    
    // Crear directorios de destino
    fs.mkdirSync(path.join(targetDir, 'onnx'), { recursive: true });

    for (const file of files) {
      const fileUrl = `${BASE_URL}/${modelId}/resolve/main/${file}`;
      const targetPath = path.join(targetDir, ...file.split('/'));
      
      // Comprobar si el archivo ya existe y tiene un tamaño válido (no vacío)
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
        console.log(`  ✓ Ya existe (se omite descarga): ${file}`);
        continue;
      }

      console.log(`  Descargando: ${file} ...`);
      try {
        await downloadFile(fileUrl, targetPath);
      } catch (err) {
        console.error(`  ⚠️ Error al descargar ${file}: ${err.message}`);
        // Reintentar con el CDN oficial por si acaso
        const fallbackUrl = `https://huggingface.co/${modelId}/resolve/main/${file}`;
        console.log(`  Reintentando desde el CDN oficial: ${fallbackUrl}`);
        try {
          await downloadFile(fallbackUrl, targetPath);
        } catch (fallbackErr) {
          console.error(`  ❌ Error fatal al descargar ${file}: ${fallbackErr.message}`);
          process.exit(1);
        }
      }
    }
    console.log(`\n🎉 ¡Modelo ${modelId} guardado con éxito!`);
  }
  console.log('\n🌟 ¡Todos los modelos locales han sido procesados y están listos en frontend/public/models! 🌟');
}

run();
