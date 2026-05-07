
window.updateProgress = (message, percent) => {
    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-fill');
    
    if (statusText) statusText.innerText = message;
    if (progressBar) progressBar.style.width = percent + "%";
};

async function selectAndProcess() {
    const filePath = await window.pywebview.api.select_audio();

    if (filePath) {
        document.getElementById('selected-path').innerText = filePath;

        const response = await window.pywebview.api.start_processing(filePath);
        console.log(response.message);
    }
}