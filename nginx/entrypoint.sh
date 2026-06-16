#!/bin/sh
# Nginx entrypoint with envsubst support
# Replaces ${VARIABLE} placeholders in nginx config template

set -e

# If a template exists, substitute env vars and write the config
if [ -n "${NGINX_ENVSUBST_TEMPLATE}" ] && [ -f "${NGINX_ENVSUBST_TEMPLATE}" ]; then
    echo "Substituting environment variables in nginx config template..."

    # Substitute all ${VAR} placeholders with actual values
    # We pass the variable names to envsubst so it only substitutes
    # variables that have values, leaving untouched any that don't
    envsubst "$(env | sed 's/=.*//' | sed 's/^/$/' | tr '\n' ' ')" \
        < "${NGINX_ENVSUBST_TEMPLATE}" \
        > "${NGINX_ENVSUBST_OUTPUT:-/etc/nginx/nginx.conf}"

    echo "Nginx config generated at ${NGINX_ENVSUBST_OUTPUT:-/etc/nginx/nginx.conf}"
fi

# Execute the main command (nginx)
exec "$@"
