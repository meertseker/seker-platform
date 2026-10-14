FROM alpine:3.22
# pg_dump 17, Supabase'in 15 ve 17 sunucularını yedekleyebilir (yeni istemci eski sunucuyu okur).
RUN apk add --no-cache curl postgresql17-client aws-cli tzdata
ENV TZ=Europe/Istanbul
COPY crontab /etc/crontabs/root
COPY entrypoint.sh backup.sh /app/
RUN chmod +x /app/entrypoint.sh /app/backup.sh
ENTRYPOINT ["/app/entrypoint.sh"]
