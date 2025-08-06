import os, glob, time
from flask import Flask, render_template, request, jsonify, send_from_directory, url_for
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join(app.root_path, 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

POSTS_FOLDER = os.path.join(app.root_path, 'posts')
if not os.path.exists(POSTS_FOLDER):
    os.makedirs(POSTS_FOLDER)

app.config['MAX_CONTENT_LENGTH'] = 30 * 1024 * 1024 # 30 MB upload limit
# --- Helper Function ---
def format_bytes(size):
    power = 2**10
    n = 0
    power_labels = {0: '', 1: 'KB', 2: 'MB', 3: 'GB', 4: 'TB'}
    while size > power and n < len(power_labels) -1 :
        size /= power
        n += 1
    return f"{size:.2f} {power_labels[n]}"

# --- Main App & File Serving Routes ---
@app.route("/")
def home():
    # This now simply renders the homepage.
    return render_template("index.html") 

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

@app.route('/view/<filename>')
def view_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- Tool Page Display Routes ---
@app.route('/tool/compressor')
def compressor_tool():
    return render_template('compressor_page.html')

@app.route('/tool/converter')
def converter_tool():
    return render_template('converter_page.html')

# --- START: New File Cleanup Logic ---
# We define the function here, but we will call it in a smarter way.
# Define the cleanup function as before
def cleanup_old_files():
    """Deletes files in the upload folder older than a set time."""
    print("\n--- Running Startup File Cleanup ---")
    deleted_count = 0
    try:
        folder_to_check = app.config['UPLOAD_FOLDER']
        print(f"[*] Checking folder: {folder_to_check}")
        now = time.time()
        max_age_seconds = 24 * 60 * 60 # Set to 60 seconds for testing
        print(f"[*] Deleting files older than {max_age_seconds} seconds.")
        
        files = glob.glob(os.path.join(folder_to_check, '*'))
        if not files:
            print("[!] No files found to check.")
        else:
            for f_path in files:
                if os.path.isfile(f_path):
                    if (now - os.path.getmtime(f_path)) > max_age_seconds:
                        os.remove(f_path)
                        deleted_count += 1
                        print(f"    -> DELETED: {os.path.basename(f_path)}")
        
        if deleted_count == 0:
            print("[!] No old files were found to delete.")

    except Exception as e:
        print(f"[!!!] A critical error occurred during cleanup: {e}")
    print("--- Cleanup Complete ---\n")


# --- END: FINAL FIX FOR STARTUP CLEANUP ---



# --- Processing Action Routes ---

# This is the single, powerful endpoint for our new Compressor/Resize page
# In backend/app.py, replace the existing process_image function

@app.route('/process_image', methods=['POST'])
def process_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided.'}), 400
    
    file = request.files['image']
    operations = request.form.getlist('operations[]')
    params = request.form

    if file.filename == '': return jsonify({'error': 'No image selected.'}), 400

    try:
        # Check file size first
        file.seek(0, os.SEEK_END)
        original_size_bytes = file.tell()
        if original_size_bytes > app.config['MAX_CONTENT_LENGTH']:
            return jsonify({'error': f'File is too large ({format_bytes(original_size_bytes)}). Maximum size is 30MB.'}), 413
        file.seek(0)
        
        original_filename = secure_filename(file.filename)
        
        # START: FIX - Added specific UnidentifiedImageError handling
        try:
            img = Image.open(file.stream)
        except UnidentifiedImageError:
            return jsonify({'error': f"Cannot identify '{original_filename}'. Please upload a valid image format (e.g., JPG, PNG, WEBP)."}), 400
        # END: FIX

        with img:
            processed_img = img.copy() 
            final_format = img.format or 'PNG' 
            final_save_options = {}

            for op in operations:
                if op == 'resize':
                    target_w = int(params.get('resize_width')) if params.get('resize_width') else None
                    target_h = int(params.get('resize_height')) if params.get('resize_height') else None
                    if target_w or target_h:
                        original_w, original_h = processed_img.size
                        new_w, new_h = original_w, original_h
                        if params.get('keep_aspect_ratio') == 'true':
                            if target_w: new_w, new_h = target_w, int(original_h * (target_w / original_w))
                            elif target_h: new_h, new_w = target_h, int(original_w * (target_h / original_h))
                        else:
                            new_w = target_w if target_w else original_w
                            new_h = target_h if target_h else original_h
                        if not (new_w == original_w and new_h == original_h):
                            processed_img = processed_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

                elif op == 'compress':
                    quality = int(params.get('quality', 75))
                    format_lower = final_format.lower()
                    if format_lower in ['jpeg', 'jpg']:
                        final_save_options['quality'] = quality; final_save_options['optimize'] = True
                    elif format_lower == 'webp':
                        final_save_options['quality'] = quality
                    elif format_lower == 'png':
                        final_save_options['optimize'] = True
            
            if final_format.lower() in ['jpeg', 'jpg'] and processed_img.mode != 'RGB':
                processed_img = processed_img.convert('RGB')

            name_part, ext_part = os.path.splitext(original_filename)
            processed_filename = f"{name_part}_processed{ext_part}"
            processed_save_path = os.path.join(app.config['UPLOAD_FOLDER'], processed_filename)
            processed_img.save(processed_save_path, format=final_format, **final_save_options)
            processed_size_bytes = os.path.getsize(processed_save_path)
        
        return jsonify({
            'message': 'Image processed successfully!',
            'processed_filename': processed_filename,
            'view_url': url_for('view_file', filename=processed_filename),
            'download_url': url_for('download_file', filename=processed_filename),
            'original_size_str': format_bytes(original_size_bytes),
            'processed_size_str': format_bytes(processed_size_bytes),
            'savings_str': f"{((original_size_bytes - processed_size_bytes) / original_size_bytes * 100):.1f}%"
        }), 200

    except Exception as e:
        print(f"Error during processing pipeline: {e}")
        return jsonify({'error': f'Error during processing: {str(e)}'}), 500


@app.route('/convert_action', methods=['POST'])
def convert_action():
    if 'image' not in request.files: return jsonify({'error': 'No image file provided.'}), 400
    file = request.files['image']
    target_format = request.form.get('target_format', 'jpeg').lower()
    if file.filename == '': return jsonify({'error': 'No image selected.'}), 400

    try:
        # Check file size first
        file.seek(0, os.SEEK_END)
        original_size_bytes = file.tell()
        if original_size_bytes > app.config['MAX_CONTENT_LENGTH']:
            return jsonify({'error': f'File is too large ({format_bytes(original_size_bytes)}). Maximum size is 30MB.'}), 413
        file.seek(0)
        
        original_filename = secure_filename(file.filename)

        # START: FIX - Added specific UnidentifiedImageError handling
        try:
            img = Image.open(file.stream)
        except UnidentifiedImageError:
            return jsonify({'error': f"Cannot identify file '{original_filename}'. Please upload a valid image format."}), 400
        # END: FIX

        with img:
            processed_img = img.copy()
            formats_requiring_rgb = ['jpeg', 'bmp', 'pdf', 'eps', 'pcx']
            if target_format in formats_requiring_rgb and processed_img.mode in ('RGBA', 'P'):
                if processed_img.mode == 'P' and 'transparency' in processed_img.info:
                    processed_img = processed_img.convert('RGBA').convert('RGB')
                elif processed_img.mode != 'P':
                    processed_img = processed_img.convert('RGB')

            name_part, _ = os.path.splitext(original_filename)
            processed_filename = f"{name_part}_converted_to_{target_format}.{target_format}"
            processed_save_path = os.path.join(app.config['UPLOAD_FOLDER'], processed_filename)
            processed_img.save(processed_save_path, format=target_format.upper())
            processed_size_bytes = os.path.getsize(processed_save_path)
        
        return jsonify({
            'message': f'Image converted to {target_format.upper()} successfully!',
            'processed_filename': processed_filename,
            'download_url': url_for('download_file', filename=processed_filename),
        }), 200

    except Exception as e:
        print(f"Error during conversion: {e}")
        return jsonify({'error': f'Error during conversion: {str(e)}'}), 500


if __name__ == "__main__":
    cleanup_old_files()
    app.run(debug=True)
    app.run(host="0.0.0.0", port=5000)