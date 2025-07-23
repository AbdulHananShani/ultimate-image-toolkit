document.addEventListener('DOMContentLoaded', function () {

    // --- Get UI Elements from the converter page ---

    const imageUploadInput = document.getElementById('image-upload');
    const uploadArea = document.getElementById('image-upload-area');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const formatToSelect = document.getElementById('format-to-select');
    const convertButton = document.getElementById('convert-button');
    const downloadArea = document.getElementById('download-area');
    const downloadLink = document.getElementById('download-link');
    const resultInfoArea = document.getElementById('result-info-area');
    const resultMessage = document.getElementById('result-message');
    const resetPreviewButton = document.getElementById('reset-preview-btn');
    let currentFile = null;
    const notificationBox = document.getElementById('notification-box');
    const notificationMessage = document.getElementById('notification-message');
    let notificationTimeout;

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

    // Add a UI Reset function

    function resetUI() {
        previewContainer.style.display = 'none';
        uploadArea.style.display = 'flex';
        downloadArea.style.display = 'none';
        currentFile = null;
        imageUploadInput.value = '';
        imagePreview.src = '#';
        resetPreviewButton.style.display = 'none';
        console.log('Converter UI has been reset.');
    }
    // --- File Selection Logic ---
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
        const objectURL = URL.createObjectURL(file);
        imagePreview.src = objectURL;
        // Show the preview area
        uploadArea.style.display = 'none';
        previewContainer.style.display = 'block';
        resetPreviewButton.style.display = 'block';
        // Hide any previous results
        resultInfoArea.style.display = 'none';
        downloadArea.style.display = 'none';
    });

    resetPreviewButton.addEventListener('click', function () {
        resetUI();
    });

    // --- Conversion Button Logic ---
    convertButton.addEventListener('click', function () {
        if (!currentFile) {
            alert('Please select an image first!');
            return;
        }
        const targetFormat = formatToSelect.value;
        convertButton.disabled = true;
        convertButton.textContent = `Converting...`;
        const formData = new FormData();
        formData.append('image', currentFile);
        formData.append('target_format', targetFormat);
        // Send the request to our single converter endpoint
        fetch('/convert_action', {
            method: 'POST',
            body: formData
        })
            .then(res => {
                if (!res.ok) { return res.json().then(e => { throw new Error(e.error || 'Server error') }); }
                return res.json();
            })
            .then(data => {
                console.log('Conversion Success:', data);
                // Show a success message
                resultMessage.textContent = data.message;
                resultInfoArea.style.display = 'block';
                // Prepare and show the download link
                downloadLink.href = data.download_url;
                downloadLink.download = data.processed_filename;
                downloadArea.style.display = 'block';
            })
            .catch(error => {
                console.error('Conversion Error:', error);
                alert('Error: ' + error.message);
            })
            .finally(() => {
                convertButton.disabled = false;
                convertButton.textContent = 'Convert Image';
            });
    });
});