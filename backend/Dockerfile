FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Strip carriage returns before making the script executable. A checkout on
# Windows can deliver entrypoint.sh with CRLF endings, which turns the shebang
# into "#!/bin/sh\r" — a interpreter that doesn't exist — and the container
# fails with "exec ./entrypoint.sh: no such file or directory". .gitattributes
# prevents that at source; this makes the image build correctly regardless of
# how the file reached the build context.
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

# Migrations own the schema in a container; create_all is a local convenience.
ENV AUTO_CREATE_TABLES=false

EXPOSE 8000

# Invoked through /bin/sh explicitly rather than relying on the shebang and the
# executable bit surviving the journey into the image.
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
