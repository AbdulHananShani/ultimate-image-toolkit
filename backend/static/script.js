document.addEventListener('DOMContentLoaded', function() {
    const imageUploadInput = document.getElementById('image-upload');
    const imagePreviewElement = document.getElementById('image-preview');
    const downloadLink = document.getElementById('download-link');
    const processedImagePreview = document.getElementById('processed-image-preview');
    const formatSelect = document.getElementById('format-select');
    const convertButton = document.getElementById('convert-button');
    const compressButton = document.getElementById('compress-button');
    // FIX: Get reference to the new preview message element
    const previewMessage = document.getElementById('preview-message');

    let originalFileDetails = null;
    let currentProcessedFileDetails = null;

    imageUploadInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        // Reset UI elements
        imagePreviewElement.style.display = 'none';
        processedImagePreview.style.display = 'none';
        downloadLink.style.display = 'none';
        previewMessage.style.display = 'none';
        originalFileDetails = null;
        currentProcessedFileDetails = null;
        
        // FIX: Re-enable processing buttons when a new image is selected
        convertButton.disabled = false;
        compressButton.disabled = false;

        if (file) {
            const objectURL = URL.createObjectURL(file);
            imagePreviewElement.src = objectURL;
            imagePreviewElement.style.display = 'block';

            const formData = new FormData();
            formData.append('image', file);
            console.log('Auto-uploading original image...');
            fetch('/initial_upload', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errData => { throw new Error(errData.error || 'Server responded with an error during initial upload') });
                }
                return response.json();
            })
            .then(data => {
                console.log('Initial Upload Success:', data);
                alert(data.message);
                originalFileDetails = { filename: data.original_filename };
            })
            .catch((error) => {
                console.error('Initial Upload Error:', error);
                alert('Error during initial upload: ' + error.message);
                imagePreviewElement.style.display = 'none';
                originalFileDetails = null;
            });
        }
    });

    // FIX: This function is now smarter based on flags from the backend
    function updateUIAfterProcessing(data) {
        console.log('Processing Success:', data);
        alert(data.message);

        // Update processed image preview based on whether it's viewable
        if (data.is_viewable && data.view_url) {
            processedImagePreview.src = data.view_url + '?t=' + new Date().getTime();
            processedImagePreview.style.display = 'block';
            previewMessage.style.display = 'none';
        } else {
            // If not viewable, hide the image preview and show a message instead
            processedImagePreview.style.display = 'none';
            previewMessage.textContent = 'Preview not available for this file type.';
            previewMessage.style.display = 'block';
        }

        // Update download link
        if (data.download_url && data.processed_filename) {
            downloadLink.href = data.download_url;
            downloadLink.download = data.processed_filename;
            downloadLink.style.display = 'inline-block';
        } else {
            downloadLink.style.display = 'none';
        }

        // Update current processed file details for chaining
        currentProcessedFileDetails = {
            filename: data.processed_filename,
            view_url: data.view_url,
            download_url: data.download_url
        };

        // Disable or enable processing buttons based on whether the new file can be re-processed
        if (data.is_reprocessable) {
            convertButton.disabled = false;
            compressButton.disabled = false;
        } else {
            convertButton.disabled = true;
            compressButton.disabled = true;
            previewMessage.textContent += ' Further processing is disabled for this format.';
        }
    }

    function handleProcessingError(error) {
        console.error('Processing Error:', error);
        alert('Error during processing: ' + error.message);
    }

    convertButton.addEventListener('click', function() {
        const fileToProcess = currentProcessedFileDetails ? currentProcessedFileDetails.filename : (originalFileDetails ? originalFileDetails.filename : null);
        if (!fileToProcess) {
            alert('Please upload an image first!');
            return;
        }
        const targetFormat = formatSelect.value;
        console.log(`Requesting conversion of ${fileToProcess} to ${targetFormat}`);
        fetch('/convert_action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename_to_process: fileToProcess,
                target_format: targetFormat
            })
        })
        .then(response => {
            if (!response.ok) { return response.json().then(errData => { throw new Error(errData.error || 'Server error during conversion') }); }
            return response.json();
        })
        .then(data => { updateUIAfterProcessing(data); })
        .catch(error => { handleProcessingError(error); });
    });

    compressButton.addEventListener('click', function() {
        const fileToProcess = currentProcessedFileDetails ? currentProcessedFileDetails.filename : (originalFileDetails ? originalFileDetails.filename : null);
        if (!fileToProcess) {
            alert('Please upload an image first!');
            return;
        }
        console.log(`Requesting compression for ${fileToProcess}`);
        fetch('/compress_action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename_to_process: fileToProcess })
        })
        .then(response => {
            if (!response.ok) { return response.json().then(errData => { throw new Error(errData.error || 'Server error during compression') }); }
            return response.json();
        })
        .then(data => { updateUIAfterProcessing(data); })
        .catch(error => { handleProcessingError(error); });
    });
});