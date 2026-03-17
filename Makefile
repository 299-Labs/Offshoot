# Build and deployment commands
install:
	pip install -r requirements.txt

run:
	streamlit run src/app.py --server.port 8501 --server.baseUrlPath /offshoot

lint:
	ruff check src/

test:
	pytest tests/