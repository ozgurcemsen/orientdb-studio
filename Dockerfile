FROM nginx

COPY ./nginx.conf /etc/nginx/conf.d/default.conf

COPY ./dist/www/*.* /usr/share/nginx/html/

EXPOSE 8080
