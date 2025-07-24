# Use an official lightweight Python image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the list of required Python libraries
COPY requirements.txt .

# Install the libraries
RUN pip install --no-cache-dir -r requirements.txt

# Copy your application code into the container
COPY ./backend/ .

# Expose the port the app will run on
EXPOSE 8000

# The command to start the Gunicorn production server
CMD ["gunicorn", "--bind", "0.0.0.0:${PORT}", "--workers", "3", "app:app"]