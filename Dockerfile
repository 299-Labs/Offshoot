# Use Python 3.13 Image
FROM python:3.13

# # Set the working directory
# WORKDIR /app

# # Install dependencies
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Copy the rest of the code
# COPY . .

# # Tell Streamlit to listen on the sub-path /offshoot
# ENV STREAMLIT_SERVER_BASE_URL_PATH=offshoot

# # Expose the default Streamlit port
# EXPOSE 8501

# # Run the app
# CMD ["streamlit", "run", "src/app.py", "--server.port=8501", "--server.address=0.0.0.0"]