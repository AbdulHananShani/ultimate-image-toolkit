# Use an official lightweight Python image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your application code into the container
COPY ./backend/ .

# The command to start the Gunicorn production server
CMD ["gunicorn", "--workers", "3", "--bind", "0.0.0.0:8000", "app:app"]