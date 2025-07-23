document.addEventListener('DOMContentLoaded', function () {
    // --- Get all our UI Elements ---
    const imageUploadInput = document.getElementById('image-upload');
    const uploadArea = document.getElementById('image-upload-area');
    const comparisonContainer = document.getElementById('comparison-container');
    const originalPreview = document.getElementById('original-preview');
    const processedPreview = document.getElementById('processed-preview');
    const comparisonSlider = document.getElementById('comparison-slider');
    const sliderWrapper = document.getElementById('comparison-slider-wrapper');
    const processButton = document.getElementById('process-button');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValueSpan = document.getElementById('quality-value');
    const resizeWidthInput = document.getElementById('resize-width');
    const resizeHeightInput = document.getElementById('resize-height');
    const aspectRatioToggle = document.getElementById('aspect-ratio-toggle');
    const sizeInfoArea = document.getElementById('size-info-area');
    const originalSizeSpan = document.getElementById('original-size');
    const processedSizeSpan = document.getElementById('processed-size');
    const savingsPercentSpan = document.getElementById('savings-percent');
    const downloadArea = document.getElementById('download-area');
    const downloadButton = document.getElementById('download-button');
    const hiddenDownloadLink = document.getElementById('hidden-download-link');
    const resetResizeButton = document.getElementById('reset-resize-button');
    const resetCompressButton = document.getElementById('reset-compress-button');
    const resetPreviewButton = document.getElementById('reset-preview-btn');
    const notificationBox = document.getElementById('notification-box');
    const notificationMessage = document.getElementById('notification-message');
    let notificationTimeout;

    let currentFile = null;

    function showNotification(message, type = 'error') {
        clearTimeout(notificationTimeout);
        notificationMessage.textContent = message;
        notificationBox.className = 'notification-box';
        notificationBox.classList.add(type.toLowerCase());
        notificationBox.classList.add('show');
        notificationTimeout = setTimeout(() => {
            notificationBox.classList.remove('show');
        }, 5000);
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    //Reset UI Helper Function
    function resetUI() {
        comparisonContainer.style.display = 'none';
        uploadArea.style.display = 'flex';
        sizeInfoArea.style.display = 'none';
        downloadArea.style.display = 'none';
        resetPreviewButton.style.display = 'none'; // Hide the reset button

        currentFile = null;
        latestProcessedFilename = null;
        imageUploadInput.value = ''; // This allows uploading the same file again

        originalPreview.src = '#';
        processedPreview.src = '#';

        console.log('UI has been reset for new upload.');
    }

    const accordions = document.getElementsByClassName("accordion");
    for (let i = 0; i < accordions.length; i++) {
        accordions[i].addEventListener("click", function () {
            this.classList.toggle("active");
            const panel = this.nextElementSibling;
            panel.style.maxHeight = panel.style.maxHeight ? null : panel.scrollHeight + "px";
        });
    }
    qualitySlider.addEventListener('input', () => { qualityValueSpan.textContent = qualitySlider.value; });
    comparisonSlider.addEventListener('input', () => {
    processedPreview.style.clipPath = `inset(0 ${100 - comparisonSlider.value}% 0 0)`;
    });

    imageUploadInput.addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (!file) return;
        // START: FIX - Add Frontend Validation
        const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
        const UNSUPPORTED_TYPES = ['.heic', '.heif'];
        const fileName = file.name.toLowerCase();
        const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

        if (file.size > MAX_FILE_SIZE) {
            showNotification(`Error: File is too large (${formatBytes(file.size)}). Max size is 30MB.`);
            imageUploadInput.value = ''; // Clear the invalid selection
            return; // Stop processing
        }

        if (UNSUPPORTED_TYPES.includes(fileExtension)) {
            showNotification(`Error: ${fileExtension.toUpperCase()} files are not yet supported.`);
            imageUploadInput.value = ''; // Clear the invalid selection
            return; // Stop processing
        }
        // END: FIX
        currentFile = file;

        const tempImg = new Image();
        tempImg.onload = () => {
            const dimensions = `${tempImg.naturalWidth} x ${tempImg.naturalHeight}`;
            const size = formatBytes(currentFile.size);
            sliderWrapper.style.aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
            document.getElementById('original-dimensions-resize').textContent = dimensions;
            document.getElementById('original-size-compress').textContent = size;
            document.getElementById('resize-original-info').style.display = 'block';
            document.getElementById('compress-original-info').style.display = 'block';
            originalPreview.src = tempImg.src;
            processedPreview.src = tempImg.src;
            comparisonSlider.value = 50;
            processedPreview.style.clipPath = 'inset(0 50% 0 0)';
            uploadArea.style.display = 'none';
            comparisonContainer.style.display = 'flex';
            sizeInfoArea.style.display = 'none';
            downloadArea.style.display = 'none';
            resetPreviewButton.style.display = 'block';
        };
        tempImg.src = URL.createObjectURL(file);
    });

    resetResizeButton.addEventListener('click', () => { resizeWidthInput.value = ''; resizeHeightInput.value = ''; aspectRatioToggle.checked = true; });
    resetCompressButton.addEventListener('click', () => { const defaultValue = 75; qualitySlider.value = defaultValue; qualityValueSpan.textContent = defaultValue; });
    resetPreviewButton.addEventListener('click', function() {
        // When the 'x' is clicked, just reset the UI to the starting state.
        resetUI();
    });
    downloadButton.addEventListener('click', function () {
        hiddenDownloadLink.click();
        setTimeout(() => {
            comparisonContainer.style.display = 'none';
            uploadArea.style.display = 'flex';
            sizeInfoArea.style.display = 'none';
            downloadArea.style.display = 'none';
            currentFile = null;
            imageUploadInput.value = '';
            originalPreview.src = '#';
            processedPreview.src = '#';
        }, 500);
    });

    // Main Processing Button Listener - This is now the only one that sends data
    processButton.addEventListener('click', function () {
        if (!currentFile) {
            alert('Please select an image file first!');
            return;
        }

        processButton.disabled = true;
        processButton.textContent = 'Processing...';

        const formData = new FormData();
        formData.append('image', currentFile);

        // Gather all operations from the UI
        const resizeWidth = resizeWidthInput.value;
        const resizeHeight = resizeHeightInput.value;
        if (resizeWidth || resizeHeight) {
            formData.append('operations[]', 'resize');
            formData.append('resize_width', resizeWidth);
            formData.append('resize_height', resizeHeight);
            formData.append('keep_aspect_ratio', aspectRatioToggle.checked);
        }

        // Always apply compression based on the slider value
        formData.append('operations[]', 'compress');
        formData.append('quality', qualitySlider.value);

        // Send one request to our powerful pipeline endpoint
        fetch('/process_image', {
            method: 'POST',
            body: formData
        })
            .then(res => res.ok ? res.json() : res.json().then(e => Promise.reject(e)))
            .then(data => {
                // Update UI with the final result
                processedPreview.src = data.view_url + '?t=' + new Date().getTime();
                document.getElementById('original-size').textContent = data.original_size_str;
                document.getElementById('processed-size').textContent = data.processed_size_str;
                document.getElementById('savings-percent').textContent = data.savings_str;
                sizeInfoArea.style.display = 'block';
                hiddenDownloadLink.href = data.download_url;
                hiddenDownloadLink.download = data.processed_filename;
                downloadArea.style.display = 'block';
            })
            .catch(error => {
                console.error('Processing Error:', error);
                alert('Error: ' + error.message);
            })
            .finally(() => {
                processButton.disabled = false;
                processButton.textContent = 'Generate Image';
            });
    });
});