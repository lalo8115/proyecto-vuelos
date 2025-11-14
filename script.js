// Variables globales para el modelo y la configuración
let model;
let modelConfig;
const resultadoEl = document.getElementById('resultado');
const loaderEl = document.getElementById('loader');

// 1. FUNCIÓN PARA CARGAR EL MODELO Y LA CONFIGURACIÓN
async function CargarModelo() {
    console.log("Cargando modelo y configuración...");
    loaderEl.style.display = 'block';
    
    try {
        // Carga el modelo desde la carpeta 'modelo_web'
        model = await tf.loadLayersModel('modelo_web/model.json?v=2');
        
        // Carga el archivo de configuración JSON
        const response = await fetch('model_config.json');
        modelConfig = await response.json();
        
        console.log("Modelo y configuración cargados.");
        resultadoEl.innerText = "Modelo listo. Ingresa los datos de tu vuelo.";
    } catch (error) {
        console.error("Error al cargar:", error);
        resultadoEl.innerText = "Error al cargar el modelo. Revisa la consola.";
        resultadoEl.style.color = "red";
    } finally {
        loaderEl.style.display = 'none';
    }
}

// Llama a la función de carga cuando la página se abre
CargarModelo();

// 2. FUNCIÓN PRINCIPAL DE PREDICCIÓN (Se llama con el botón)
async function predecir() {
    // Validar que el modelo esté cargado
    if (!model || !modelConfig) {
        resultadoEl.innerText = "Error: El modelo no está cargado.";
        resultadoEl.style.color = "red";
        return;
    }

    // --- A. OBTENER DATOS DEL FORMULARIO ---
    const flight = document.getElementById('flight').value;
    const origen = document.getElementById('origen').value.toUpperCase();
    const destino = document.getElementById('destino').value.toUpperCase();
    const fechaInput = document.getElementById('fecha').value;
    const horaInput = document.getElementById('hora').value;

    if (!flight || !origen || !destino || !fechaInput || !horaInput) {
        resultadoEl.innerText = "Por favor, completa todos los campos.";
        resultadoEl.style.color = "orange";
        return;
    }

    loaderEl.style.display = 'block';
    resultadoEl.innerText = "";

    try {
        // --- B. PREPROCESAR LOS DATOS (IDÉNTICO A PYTHON) ---
        
        // 1. Procesar Fecha y Hora
        const fecha = new Date(fechaInput + 'T' + horaInput);
        const mes = fecha.getMonth() + 1; // JS (0-11) a Python (1-12)
        const diaSemana = (fecha.getDay() + 6) % 7; // JS (Dom=0) a Python (Lun=0)
        const hora = fecha.getHours();

        // 2. Escalar los datos numéricos (usando la config guardada)
        const scaler = modelConfig.scaler;
        const scaledMes = (mes - scaler.mean[scaler.features.indexOf('MES')]) / scaler.scale[scaler.features.indexOf('MES')];
        const scaledDiaSemana = (diaSemana - scaler.mean[scaler.features.indexOf('DIA_SEMANA')]) / scaler.scale[scaler.features.indexOf('DIA_SEMANA')];
        const scaledHora = (hora - scaler.mean[scaler.features.indexOf('HORA_SALIDA')]) / scaler.scale[scaler.features.indexOf('HORA_SALIDA')];

        // 3. Crear el array de entrada (One-Hot Encoding)
        const allColumns = modelConfig.columns;
        // Creamos un array largo de ceros
        let inputData = new Array(allColumns.length).fill(0);

        // 4. Poner los valores en las posiciones correctas
        // Poner los numéricos escalados
        inputData[allColumns.indexOf('MES')] = scaledMes;
        inputData[allColumns.indexOf('DIA_SEMANA')] = scaledDiaSemana;
        inputData[allColumns.indexOf('HORA_SALIDA')] = scaledHora;

        // Poner los categóricos (One-Hot)
        const flightCol = 'Flight_' + flight;
        const origenCol = 'PortFrom_' + origen;
        const destinoCol = 'PortTo_' + destino;

        if (allColumns.includes(flightCol)) inputData[allColumns.indexOf(flightCol)] = 1;
        if (allColumns.includes(origenCol)) inputData[allColumns.indexOf(origenCol)] = 1;
        if (allColumns.includes(destinoCol)) inputData[allColumns.indexOf(destinoCol)] = 1;
        
        // --- C. CREAR EL TENSOR Y PREDECIR ---
        const inputTensor = tf.tensor2d([inputData]); // [1, num_features]
        const prediction = model.predict(inputTensor);
        const probability = await prediction.data();
        const probDemora = probability[0] * 100;

        // --- D. MOSTRAR EL RESULTADO ---
        loaderEl.style.display = 'none';
        if (probDemora > 50) {
            resultadoEl.innerHTML = `⚠️ ALTA Probabilidad de Demora: <b>${probDemora.toFixed(2)}%</b>`;
            resultadoEl.style.color = "red";
        } else if (probDemora > 20) {
            resultadoEl.innerHTML = `😐 MEDIA Probabilidad de Demora: <b>${probDemora.toFixed(2)}%</b>`;
            resultadoEl.style.color = "orange";
        } else {
            resultadoEl.innerHTML = `✅ BAJA Probabilidad de Demora: <b>${probDemora.toFixed(2)}%</b>`;
            resultadoEl.style.color = "green";
        }

    } catch (error) {
        loaderEl.style.display = 'none';
        resultadoEl.innerText = `Error: ${error.message}. ¿Ingresaste un vuelo/ruta que sí estaba en el Excel?`;
        resultadoEl.style.color = "red";
        console.error(error);
    }

}
