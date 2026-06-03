# Frontend Dockerfile
FROM nginx:alpine

# Entferne default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Kopiere custom nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Kopiere Frontend-Dateien
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

# Exponiere Port
EXPOSE 80

# Nginx läuft automatisch im Vordergrund
CMD ["nginx", "-g", "daemon off;"]
