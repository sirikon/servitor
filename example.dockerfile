FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y iputils-ping
