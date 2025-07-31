#!/bin/bash
docker-compose run --rm certbot renew
docker-compose kill -s SIGHUP nginx