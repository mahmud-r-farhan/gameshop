FROM nginx:alpine

# Install envsubst (comes with gettext)
RUN apk add --no-cache gettext

# Copy entrypoint script
COPY entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy config template
COPY prod.conf.template /etc/nginx/nginx.conf.template

# Default to prod config
ENV NGINX_ENVSUBST_TEMPLATE=/etc/nginx/nginx.conf.template
ENV NGINX_ENVSUBST_OUTPUT=/etc/nginx/nginx.conf

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
