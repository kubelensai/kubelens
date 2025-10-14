#!/bin/sh

# Replace API_SERVER in nginx config
export API_SERVER=${API_SERVER:-http://server:8080}

echo "🔧 Configuring nginx with API_SERVER=${API_SERVER}"

# Use envsubst to replace environment variables in the template
envsubst '${API_SERVER}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "✅ Nginx configuration generated:"
cat /etc/nginx/conf.d/default.conf

# Execute the main command
exec "$@"

